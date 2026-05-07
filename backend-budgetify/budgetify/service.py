from __future__ import annotations

import asyncio
from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Dict, List, Tuple

from fastapi import HTTPException

from .repository import BudgetRepository, next_month_year, prev_month_year


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def day_kind(d: date) -> str:
    return "weekend" if d.weekday() >= 5 else "weekday"


class BudgetService:
    def __init__(self, repo: BudgetRepository):
        self.repo = repo

    @staticmethod
    def resolve_month_year(month: int | None, year: int | None) -> Tuple[int, int]:
        now = datetime.utcnow().date()
        return month or now.month, year or now.year

    @staticmethod
    def month_days(month: int, year: int) -> List[date]:
        days = monthrange(year, month)[1]
        return [date(year, month, d) for d in range(1, days + 1)]

    @staticmethod
    def compute_status(actual: float, recommended: float) -> Tuple[str, str]:
        if recommended <= 0:
            return ("over", "red") if actual > 0 else ("under", "green")
        ratio = actual / recommended
        if ratio <= 0.9:
            return "under", "green"
        if ratio <= 1.05:
            return "near", "yellow"
        return "over", "red"

    @staticmethod
    def severity_from_due_days(days_left: int, overdue: bool = False) -> str:
        if overdue or days_left < 0:
            return "red"
        if days_left <= 3:
            return "yellow"
        return "green"

    async def _ensure_budget_exists(self, user_email: str, month: int, year: int) -> Dict:
        budget = await self.repo.get_budget(user_email, month, year)
        if not budget:
            budget = await self.repo.clone_budget_from_previous_month(user_email, month, year)
        if not budget:
            raise HTTPException(
                status_code=404,
                detail="Please complete the setup to start using Budgetify effectively.",
            )
        await self.repo.ensure_next_month_budget(user_email, month, year)
        return budget

    async def setup_budget(self, user_email: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        saved = await self.repo.upsert_budget(user_email, payload)
        await self.repo.upsert_transaction(
            {
                "user_email": user_email,
                "type": "budget_setup",
                "amount": float(payload["monthly_income"]),
                "date": f'{payload["year"]}-{str(payload["month"]).zfill(2)}-01',
                "name": "Budget setup",
                "transaction_key": f'budget_setup:{payload["year"]}-{str(payload["month"]).zfill(2)}',
                "meta": {
                    "weekday_budget_per_day": float(payload["weekday_budget_per_day"]),
                    "weekend_budget_per_day": float(payload["weekend_budget_per_day"]),
                    "savings_target": float(payload.get("savings_target") or 0),
                    "category_budgets": payload.get("category_budgets") or {},
                },
            }
        )
        await self.repo.ensure_next_month_budget(user_email, payload["month"], payload["year"])
        return saved

    async def add_mandatory_expense(self, user_email: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        data = dict(payload)
        data["user_email"] = user_email
        data["due_date"] = payload["due_date"].isoformat()
        saved = await self.repo.add_mandatory_expense(data)
        await self.repo.upsert_transaction(
            {
                "user_email": user_email,
                "type": "mandatory_expense",
                "amount": float(payload["amount"]),
                "date": data["due_date"],
                "name": payload["expense_name"],
                "transaction_key": f'mandatory_expense:{saved["id"]}',
                "category": payload["category"],
                "meta": {"is_recurring": bool(payload.get("is_recurring", True))},
            }
        )
        return saved

    async def add_emi(self, user_email: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        data = dict(payload)
        data["user_email"] = user_email
        data["start_month"] = datetime.utcnow().date().strftime("%Y-%m")
        saved = await self.repo.add_emi(data)
        await self.repo.upsert_transaction(
            {
                "user_email": user_email,
                "type": "emi_created",
                "amount": float(payload["monthly_amount"]),
                "date": datetime.utcnow().date().isoformat(),
                "name": payload["emi_name"],
                "transaction_key": f'emi_created:{saved["id"]}',
                "meta": {
                    "last_payable_month": payload["last_payable_month"],
                    "details": payload.get("details", ""),
                },
            }
        )
        return saved

    async def update_emi(self, user_email: str, emi_id: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        emi = await self.repo.update_emi(user_email, emi_id, dict(payload))
        if not emi:
            raise HTTPException(status_code=404, detail="EMI not found")
        return emi

    async def delete_emi(self, user_email: str, emi_id: str) -> Dict:
        await self.repo.ensure_indexes()
        deleted = await self.repo.delete_emi(user_email, emi_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="EMI not found")
        await self.repo.delete_transaction_by_key(user_email, f"emi_created:{emi_id}")
        return {"ok": True}

    async def add_sip(self, user_email: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        data = dict(payload)
        data["user_email"] = user_email
        data["start_month"] = datetime.utcnow().date().strftime("%Y-%m")
        saved = await self.repo.add_sip(data)
        await self.repo.upsert_transaction(
            {
                "user_email": user_email,
                "type": "sip_created",
                "amount": float(payload["monthly_amount"]),
                "date": datetime.utcnow().date().isoformat(),
                "name": payload["sip_name"],
                "transaction_key": f'sip_created:{saved["id"]}',
                "meta": {"details": payload.get("details", "")},
            }
        )
        return saved

    async def add_debt(self, user_email: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        data = dict(payload)
        data["user_email"] = user_email
        data["due_date"] = payload["due_date"].isoformat()
        saved = await self.repo.add_debt(data)
        await self.repo.upsert_transaction(
            {
                "user_email": user_email,
                "type": "debt_created",
                "amount": float(payload["amount"]),
                "date": data["due_date"],
                "name": payload["debt_name"],
                "transaction_key": f'debt_created:{saved["id"]}',
                "meta": {
                    "installment_amount": float(payload.get("installment_amount") or 0),
                    "installment_count": int(payload.get("installment_count") or 0),
                },
            }
        )
        return saved

    async def mark_debt_paid(self, user_email: str, debt_id: str) -> Dict:
        await self.repo.ensure_indexes()
        debt = await self.repo.mark_debt_paid(user_email, debt_id)
        if not debt:
            raise HTTPException(status_code=404, detail="Debt not found")
        paid_date = (debt.get("paid_at") or datetime.utcnow()).isoformat()[:10]
        amount = float(debt.get("installment_amount") or 0) or float(debt["amount"])
        await self.repo.upsert_transaction(
            {
                "user_email": user_email,
                "type": "debt_payment",
                "amount": amount,
                "date": paid_date,
                "name": debt.get("debt_name") or "Debt",
                "reference_id": debt["id"],
                "reference_type": "debt",
                "transaction_key": f'debt_payment:{debt["id"]}',
                "meta": {"due_date": debt["due_date"]},
            }
        )
        return debt

    async def update_debt(self, user_email: str, debt_id: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        data = dict(payload)
        data["due_date"] = payload["due_date"].isoformat()
        debt = await self.repo.update_debt(user_email, debt_id, data)
        if not debt:
            raise HTTPException(status_code=404, detail="Debt not found")
        return debt

    async def delete_debt(self, user_email: str, debt_id: str) -> Dict:
        await self.repo.ensure_indexes()
        deleted = await self.repo.delete_debt(user_email, debt_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Debt not found")
        await self.repo.delete_transaction_by_key(user_email, f"debt_payment:{debt_id}")
        await self.repo.delete_transaction_by_key(user_email, f"debt_created:{debt_id}")
        return {"ok": True}

    async def set_emi_month_status(
        self, user_email: str, emi_id: str, month: str, paid: bool, paid_on: date | None
    ) -> Dict:
        await self.repo.ensure_indexes()
        emi = await self.repo.set_emi_month_status(
            user_email,
            emi_id,
            month,
            paid,
            paid_on.isoformat() if paid_on else None,
        )
        if not emi:
            raise HTTPException(status_code=404, detail="EMI not found")
        if paid:
            payment_date = (paid_on or datetime.utcnow().date()).isoformat()
            await self.repo.upsert_transaction(
                {
                    "user_email": user_email,
                    "type": "emi_payment",
                    "amount": float(emi["monthly_amount"]),
                    "date": payment_date,
                    "name": emi.get("emi_name") or "EMI",
                    "reference_id": emi["id"],
                    "reference_type": "emi",
                    "transaction_key": f"emi_payment:{emi['id']}:{month}",
                    "meta": {"month": month},
                }
            )
        else:
            await self.repo.delete_transaction_by_key(user_email, f"emi_payment:{emi['id']}:{month}")
        emi["current_month_paid"] = bool((emi.get("monthly_status") or {}).get(month, False))
        return emi

    async def set_sip_month_status(
        self, user_email: str, sip_id: str, month: str, paid: bool, paid_on: date | None
    ) -> Dict:
        await self.repo.ensure_indexes()
        sip = await self.repo.set_sip_month_status(
            user_email,
            sip_id,
            month,
            paid,
            paid_on.isoformat() if paid_on else None,
        )
        if not sip:
            raise HTTPException(status_code=404, detail="SIP not found")
        if paid:
            payment_date = (paid_on or datetime.utcnow().date()).isoformat()
            await self.repo.upsert_transaction(
                {
                    "user_email": user_email,
                    "type": "sip_payment",
                    "amount": float(sip["monthly_amount"]),
                    "date": payment_date,
                    "name": sip.get("sip_name") or "SIP",
                    "reference_id": sip["id"],
                    "reference_type": "sip",
                    "transaction_key": f"sip_payment:{sip['id']}:{month}",
                    "meta": {"month": month},
                }
            )
        else:
            await self.repo.delete_transaction_by_key(user_email, f"sip_payment:{sip['id']}:{month}")
        sip["current_month_paid"] = bool((sip.get("monthly_status") or {}).get(month, False))
        return sip

    async def _month_context(self, user_email: str, month: int | None, year: int | None) -> Dict:
        m, y = self.resolve_month_year(month, year)
        budget = await self._ensure_budget_exists(user_email, m, y)

        (
            expenses,
            emis,
            sips,
            debts,
            spends,
            daily_summaries,
            transactions,
        ) = await asyncio.gather(
            self.repo.list_mandatory_expenses(user_email, m, y),
            self.repo.list_emi(user_email, m, y),
            self.repo.list_sips(user_email, m, y),
            self.repo.list_debts(user_email, m, y),
            self.repo.month_spends(user_email, m, y),
            self.repo.list_daily_summaries(user_email, m, y),
            self.repo.list_transactions(user_email, m, y),
        )

        mandatory_total = sum(float(x["amount"]) for x in expenses)
        emi_total = sum(float(x.get("monthly_amount") or 0.0) for x in emis)
        sip_total = sum(float(x.get("monthly_amount") or 0.0) for x in sips)
        debts_due_total = sum(float(x.get("installment_amount") or 0.0) or float(x["amount"]) for x in debts if x.get("status") == "pending")
        spent_total = sum(float(x.get("total_spend") or 0.0) for x in daily_summaries)
        available_money = (
            float(budget["monthly_income"])
            - mandatory_total
            - emi_total
            - sip_total
            - debts_due_total
            - float(budget.get("savings_target") or 0)
        )

        return {
            "month": m,
            "year": y,
            "budget": budget,
            "expenses": expenses,
            "emis": emis,
            "sips": sips,
            "debts": debts,
            "spends": spends,
            "daily_summaries": daily_summaries,
            "transactions": transactions,
            "mandatory_total": float(mandatory_total),
            "emi_total": float(emi_total),
            "sip_total": float(sip_total),
            "debts_due_total": float(debts_due_total),
            "available_money": float(available_money),
            "spent_total": float(spent_total),
        }

    def _recommended_today(self, ctx: Dict, target_day: date) -> float:
        m = ctx["month"]
        y = ctx["year"]
        budget = ctx["budget"]
        spends = ctx["spends"]
        available_money = ctx["available_money"]

        remaining_days = [d for d in self.month_days(m, y) if d >= target_day]
        if not remaining_days:
            return 0.0

        spent_before_today = sum(float(s["amount"]) for s in spends if s["date"] < target_day.isoformat())
        remaining_money = max(0.0, available_money - spent_before_today)

        weekday_pref = float(budget["weekday_budget_per_day"])
        weekend_pref = float(budget["weekend_budget_per_day"])

        weights = []
        total_weight = 0.0
        for day in remaining_days:
            weight = weekday_pref if day_kind(day) == "weekday" else weekend_pref
            weights.append((day, weight))
            total_weight += max(weight, 0.0)

        if total_weight <= 0:
            return 0.0

        today_weight = next(weight for day, weight in weights if day == target_day)
        recommended = remaining_money * (today_weight / total_weight)
        return max(0.0, round(recommended, 2))

    def _category_budget_status(self, ctx: Dict) -> List[Dict]:
        category_limits = ctx["budget"].get("category_budgets") or {}
        if not category_limits:
            return []
        spent_map: Dict[str, float] = {}
        for spend in ctx["spends"]:
            category = str(spend.get("category") or "other").lower()
            spent_map[category] = spent_map.get(category, 0.0) + float(spend.get("amount") or 0)

        items = []
        for category, limit in category_limits.items():
            spent = round(spent_map.get(category, 0.0), 2)
            limit_value = float(limit or 0)
            remaining = round(limit_value - spent, 2)
            if limit_value <= 0:
                status = "under"
            else:
                ratio = spent / limit_value
                status = "under" if ratio <= 0.9 else "near" if ratio <= 1.0 else "over"
            items.append(
                {
                    "category": category,
                    "limit": round(limit_value, 2),
                    "spent": spent,
                    "remaining": remaining,
                    "status": status,
                }
            )
        return items

    def _smart_alerts(self, ctx: Dict, today: date, recommended: float, actual: float, remaining: float) -> List[Dict]:
        alerts = []
        if actual > recommended * 1.05 and recommended > 0:
            alerts.append(
                {
                    "id": f"overspending-{today.isoformat()}",
                    "title": "Overspending warning",
                    "message": "Today's spending is above the recommended budget.",
                    "severity": "high",
                    "kind": "overspending",
                }
            )

        for item in ctx["emis"]:
            due_date = date(today.year, today.month, monthrange(today.year, today.month)[1])
            days_left = (due_date - today).days
            if days_left <= 3 and not item.get("current_month_paid"):
                alerts.append(
                    {
                        "id": f"emi-{item['id']}",
                        "title": "EMI due soon",
                        "message": f"{item.get('emi_name') or 'EMI'} is due in {max(days_left, 0)} day(s).",
                        "severity": "medium",
                        "kind": "emi_due",
                    }
                )

        for item in ctx["debts"]:
            due = date.fromisoformat(item["due_date"])
            if item.get("status") == "pending" and due < today:
                alerts.append(
                    {
                        "id": f"debt-{item['id']}",
                        "title": "Debt overdue",
                        "message": f"{item.get('debt_name') or 'Debt'} is overdue.",
                        "severity": "high",
                        "kind": "debt_overdue",
                    }
                )

        if remaining <= max(recommended, 1):
            alerts.append(
                {
                    "id": f"low-balance-{today.isoformat()}",
                    "title": "Low balance",
                    "message": "Your remaining monthly budget is running low.",
                    "severity": "medium" if remaining > 0 else "high",
                    "kind": "low_balance",
                }
            )

        return alerts

    async def add_spend(self, user_email: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        spend_date: date = payload["date"]
        spend_doc = await self.repo.add_spend(
            {
                "user_email": user_email,
                "amount": float(payload["amount"]),
                "category": payload["category"],
                "note": payload.get("note", ""),
                "date": spend_date.isoformat(),
            }
        )
        await self.repo.rebuild_daily_summary(user_email, spend_date.isoformat())
        return spend_doc

    async def update_spend(self, user_email: str, spend_id: str, payload: Dict) -> Dict:
        await self.repo.ensure_indexes()
        current = await self.repo.get_spend_transaction(user_email, spend_id)
        if not current:
            raise HTTPException(status_code=404, detail="Expense not found")
        spend = await self.repo.update_spend(
            user_email,
            spend_id,
            {
                "amount": float(payload["amount"]),
                "category": payload["category"],
                "note": payload.get("note", ""),
                "date": payload["date"].isoformat(),
            },
        )
        if not spend:
            raise HTTPException(status_code=404, detail="Expense not found")
        await self.repo.rebuild_daily_summary(user_email, current["date"])
        await self.repo.rebuild_daily_summary(user_email, spend["date"])
        return spend

    async def today(self, user_email: str, month: int | None, year: int | None) -> Dict:
        await self.repo.ensure_indexes()
        ctx = await self._month_context(user_email, month, year)
        return await self._today_from_context(user_email, ctx)

    async def _today_from_context(self, user_email: str, ctx: Dict) -> Dict:
        m, y = ctx["month"], ctx["year"]
        now = datetime.utcnow().date()
        today = now if now.month == m and now.year == y else date(y, m, min(now.day, monthrange(y, m)[1]))
        day_iso = today.isoformat()

        recommended = self._recommended_today(ctx, today)
        actual_summary = await self.repo.get_daily_summary(user_email, day_iso)
        actual = round(float((actual_summary or {}).get("total_spend") or 0), 2)
        remaining = round(ctx["available_money"] - ctx["spent_total"], 2)
        status, color = self.compute_status(actual, recommended)

        elapsed_days = now.day if now.month == m and now.year == y else monthrange(y, m)[1]
        burn_rate = round(ctx["spent_total"] / max(1, elapsed_days), 2)
        projected_end_balance = round(ctx["available_money"] - burn_rate * monthrange(y, m)[1], 2)
        total_saved = max(0.0, ctx["available_money"] - ctx["spent_total"])
        savings_target = float(ctx["budget"].get("savings_target") or 0)
        savings_progress = round(clamp((total_saved / savings_target) * 100.0, 0.0, 100.0), 2) if savings_target > 0 else 100.0

        if projected_end_balance < 0 or status == "over":
            risk_indicator = "high"
        elif projected_end_balance < recommended * 3:
            risk_indicator = "medium"
        else:
            risk_indicator = "low"

        upcoming_emi = await self.repo.upcoming_emi(user_email, day_iso, limit=5)
        upcoming_debt = await self.repo.upcoming_debts(user_email, day_iso, limit=5)
        alerts = []
        for e in upcoming_emi:
            due = date.fromisoformat(e["due_date"])
            due_in = (due - today).days
            alerts.append(
                {
                    "id": e["id"],
                    "name": e.get("emi_name") or "EMI",
                    "amount": float(e.get("monthly_amount") or 0.0),
                    "due_date": e["due_date"],
                    "due_in_days": due_in,
                    "severity": self.severity_from_due_days(due_in),
                    "kind": "emi",
                }
            )
        for d in upcoming_debt:
            due = date.fromisoformat(d["due_date"])
            due_in = (due - today).days
            overdue = due_in < 0
            alerts.append(
                {
                    "id": d["id"],
                    "name": d.get("debt_name") or "Debt",
                    "amount": float(d.get("installment_amount") or 0.0) or float(d["amount"]),
                    "due_date": d["due_date"],
                    "due_in_days": due_in,
                    "severity": self.severity_from_due_days(due_in, overdue=overdue),
                    "kind": "debt",
                }
            )

        return {
            "month": m,
            "year": y,
            "today": today,
            "recommended_budget": recommended,
            "actual_spend": actual,
            "remaining_budget": remaining,
            "spend_status": status,
            "spend_status_color": color,
            "upcoming_emi": upcoming_emi,
            "upcoming_debt": upcoming_debt,
            "alerts": alerts,
            "burn_rate": burn_rate,
            "projected_end_balance": projected_end_balance,
            "savings_progress": savings_progress,
            "risk_indicator": risk_indicator,
            "category_budget_status": self._category_budget_status(ctx),
            "smart_alerts": self._smart_alerts(ctx, today, recommended, actual, remaining),
        }

    async def report(self, user_email: str, month: int | None, year: int | None) -> Dict:
        await self.repo.ensure_indexes()
        ctx = await self._month_context(user_email, month, year)
        return await self._report_from_context(user_email, ctx)

    async def _report_from_context(self, user_email: str, ctx: Dict) -> Dict:
        m, y = ctx["month"], ctx["year"]
        budget = ctx["budget"]
        transactions = ctx["transactions"]

        spend_transactions = [t for t in transactions if t.get("type") == "spend"]
        spent_total = round(sum(float(t.get("amount") or 0) for t in spend_transactions), 2)

        expense_breakdown: Dict[str, float] = {}
        weekly_pattern: Dict[str, float] = {}
        for tx in spend_transactions:
            category = str(tx.get("category") or "other").lower()
            expense_breakdown[category] = round(expense_breakdown.get(category, 0.0) + float(tx["amount"]), 2)
            d = date.fromisoformat(tx["date"])
            week_key = f"week-{d.isocalendar()[1]}"
            weekly_pattern[week_key] = round(weekly_pattern.get(week_key, 0.0) + float(tx["amount"]), 2)

        income = max(1.0, float(budget["monthly_income"]))
        total_saved = max(0.0, income - (ctx["mandatory_total"] + ctx["emi_total"] + ctx["sip_total"] + ctx["debts_due_total"] + spent_total))
        emi_ratio = (float(ctx["emi_total"]) / income) * 100.0
        sip_ratio = (float(ctx["sip_total"]) / income) * 100.0
        debt_ratio = (float(ctx["debts_due_total"]) / income) * 100.0
        savings_rate = (total_saved / income) * 100.0

        elapsed_days = monthrange(y, m)[1]
        now = datetime.utcnow().date()
        if now.month == m and now.year == y:
            elapsed_days = max(1, now.day)
        avg_daily = spent_total / max(1, elapsed_days)

        spend_score = clamp(100.0 - max(0.0, (spent_total - ctx["available_money"])) * 100.0 / max(1.0, ctx["available_money"]), 0.0, 100.0)
        debt_score = clamp(100.0 - debt_ratio, 0.0, 100.0)
        savings_score = clamp(savings_rate, 0.0, 100.0)
        emi_score = clamp(100.0 - emi_ratio, 0.0, 100.0)
        health = int(round(0.35 * spend_score + 0.25 * savings_score + 0.2 * debt_score + 0.2 * emi_score))

        prev_month, prev_year = prev_month_year(m, y)
        previous_transactions = await self.repo.list_transactions(user_email, prev_month, prev_year)
        previous_spend_total = round(sum(float(t.get("amount") or 0) for t in previous_transactions if t.get("type") == "spend"), 2)
        monthly_spend_change = round(spent_total - previous_spend_total, 2)

        return {
            "month": m,
            "year": y,
            "total_spent": spent_total,
            "total_saved": round(total_saved, 2),
            "expense_breakdown_by_category": expense_breakdown,
            "EMI_ratio": round(emi_ratio, 2),
            "SIP_ratio": round(sip_ratio, 2),
            "debt_ratio": round(debt_ratio, 2),
            "savings_rate": round(savings_rate, 2),
            "average_daily_spend": round(avg_daily, 2),
            "weekly_spending_pattern": weekly_pattern,
            "budget_health_score": int(clamp(health, 0, 100)),
            "previous_month_total_spent": previous_spend_total,
            "monthly_spend_change": monthly_spend_change,
        }

    async def summary(self, user_email: str, month: int | None, year: int | None) -> Dict:
        ctx = await self._month_context(user_email, month, year)
        today_data, report = await asyncio.gather(
            self._today_from_context(user_email, ctx),
            self._report_from_context(user_email, ctx),
        )
        return {
            "today": today_data,
            "report": report,
            "mandatory_expenses": ctx["expenses"],
            "emis": ctx["emis"],
            "sips": ctx["sips"],
            "debts": ctx["debts"],
            "spends": sorted(ctx["spends"], key=lambda item: (item["date"], item.get("created_at", "")), reverse=True),
            "recent_spends": sorted(ctx["spends"], key=lambda item: (item["date"], item.get("created_at", "")), reverse=True)[:10],
            "daily_summaries": ctx["daily_summaries"],
        }

    async def debts(self, user_email: str, month: int | None, year: int | None) -> List[Dict]:
        m, y = self.resolve_month_year(month, year)
        return await self.repo.list_debts(user_email, m, y)

    async def mandatory_expenses(self, user_email: str, month: int | None, year: int | None) -> List[Dict]:
        m, y = self.resolve_month_year(month, year)
        return await self.repo.list_mandatory_expenses(user_email, m, y)

    async def spends(
        self,
        user_email: str,
        month: int | None,
        year: int | None,
        date_from: str | None,
        date_to: str | None,
    ) -> List[Dict]:
        if (month is None) != (year is None):
            raise HTTPException(status_code=400, detail="month and year must be provided together")
        return await self.repo.list_spends(user_email, month, year, date_from, date_to)

    async def emis(self, user_email: str, month: int | None, year: int | None) -> List[Dict]:
        m, y = self.resolve_month_year(month, year)
        return await self.repo.list_emi(user_email, m, y)

    async def sips(self, user_email: str, month: int | None, year: int | None) -> List[Dict]:
        if month is None and year is None:
            return await self.repo.list_sips(user_email)
        m, y = self.resolve_month_year(month, year)
        return await self.repo.list_sips(user_email, m, y)
