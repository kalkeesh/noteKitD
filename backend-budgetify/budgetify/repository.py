from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

from bson import ObjectId

from db import db


def oid(value: str) -> ObjectId:
    return ObjectId(value)


def serialize(doc: Optional[Dict]) -> Optional[Dict]:
    if not doc:
        return None
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out["_id"])
        del out["_id"]
    return out


def ym_to_int(ym: str) -> int:
    y, m = ym.split("-")
    return int(y) * 100 + int(m)


def valid_ym(ym: str) -> bool:
    if not isinstance(ym, str) or len(ym) != 7 or ym[4] != "-":
        return False
    y, m = ym.split("-")
    return y.isdigit() and m.isdigit() and 1 <= int(m) <= 12


def valid_iso_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
        return True
    except Exception:
        return False


def normalize_user_id(user_email: str) -> str:
    value = (user_email or "").strip().lower()
    if not value:
        raise ValueError("User email is required for Budgetify")
    return value


def prev_month_year(month: int, year: int) -> Tuple[int, int]:
    if month == 1:
        return 12, year - 1
    return month - 1, year


def next_month_year(month: int, year: int) -> Tuple[int, int]:
    if month == 12:
        return 1, year + 1
    return month + 1, year


class BudgetRepository:
    _indexes_ready = False

    def __init__(self):
        self._db = db
        self._budgets = self._db["budgets"]
        self._mandatory_expenses = self._db["mandatory_expenses"]
        self._emis = self._db["emis"]
        self._sips = self._db["sips"]
        self._debts = self._db["debts"]
        self._transactions = self._db["transactions"]
        self._daily_summaries = self._db["daily_summaries"]

    async def ensure_indexes(self):
        if BudgetRepository._indexes_ready:
            return

        await self._budgets.create_index([("user_id", 1), ("month", 1), ("year", 1)], unique=True)
        await self._budgets.create_index([("user_id", 1), ("updated_at", -1)])

        await self._mandatory_expenses.create_index([("user_id", 1), ("month", 1), ("year", 1)])
        await self._mandatory_expenses.create_index([("user_id", 1), ("due_date", 1)])

        await self._emis.create_index([("user_id", 1), ("start_month_value", 1), ("last_payable_month_value", 1)])
        await self._emis.create_index([("user_id", 1), ("updated_at", -1)])

        await self._sips.create_index([("user_id", 1), ("start_month_value", 1)])
        await self._sips.create_index([("user_id", 1), ("updated_at", -1)])

        await self._debts.create_index([("user_id", 1), ("month", 1), ("year", 1)])
        await self._debts.create_index([("user_id", 1), ("due_date", 1)])
        await self._debts.create_index([("user_id", 1), ("status", 1), ("due_date", 1)])

        await self._transactions.create_index([("user_id", 1), ("month", 1), ("year", 1)])
        await self._transactions.create_index([("user_id", 1), ("date", 1)])
        await self._transactions.create_index([("user_id", 1), ("type", 1), ("date", 1)])
        await self._transactions.create_index([("user_id", 1), ("transaction_key", 1)], unique=True, sparse=True)

        await self._daily_summaries.create_index([("user_id", 1), ("date", 1)], unique=True)
        await self._daily_summaries.create_index([("user_id", 1), ("month", 1), ("year", 1)])

        BudgetRepository._indexes_ready = True

    async def upsert_budget(self, user_email: str, payload: Dict) -> Dict:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        category_budgets = {
            str(key): float(value)
            for key, value in (payload.get("category_budgets") or {}).items()
            if value is not None
        }
        await self._budgets.update_one(
            {"user_id": user_id, "month": payload["month"], "year": payload["year"]},
            {
                "$set": {
                    "user_id": user_id,
                    "monthly_income": float(payload["monthly_income"]),
                    "weekday_budget_per_day": float(payload["weekday_budget_per_day"]),
                    "weekend_budget_per_day": float(payload["weekend_budget_per_day"]),
                    "savings_target": float(payload.get("savings_target") or 0),
                    "category_budgets": category_budgets,
                    "updated_at": datetime.utcnow(),
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow(),
                    "month": payload["month"],
                    "year": payload["year"],
                },
            },
            upsert=True,
        )
        doc = await self._budgets.find_one({"user_id": user_id, "month": payload["month"], "year": payload["year"]})
        return serialize(doc)

    async def get_budget(self, user_email: str, month: int, year: int) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        doc = await self._budgets.find_one({"user_id": user_id, "month": month, "year": year})
        return serialize(doc)

    async def clone_budget_from_previous_month(self, user_email: str, month: int, year: int) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        prev_month, prev_year = prev_month_year(month, year)
        previous = await self._budgets.find_one({"user_id": user_id, "month": prev_month, "year": prev_year})
        if not previous:
            return None

        await self._budgets.update_one(
            {"user_id": user_id, "month": month, "year": year},
            {
                "$setOnInsert": {
                    "user_id": user_id,
                    "month": month,
                    "year": year,
                    "monthly_income": float(previous.get("monthly_income") or 0),
                    "weekday_budget_per_day": float(previous.get("weekday_budget_per_day") or 0),
                    "weekend_budget_per_day": float(previous.get("weekend_budget_per_day") or 0),
                    "savings_target": float(previous.get("savings_target") or 0),
                    "category_budgets": previous.get("category_budgets") or {},
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )
        return await self.get_budget(user_id, month, year)

    async def ensure_next_month_budget(self, user_email: str, month: int, year: int):
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        current = await self.get_budget(user_id, month, year)
        if not current:
            return
        next_month, next_year = next_month_year(month, year)
        exists = await self.get_budget(user_id, next_month, next_year)
        if exists:
            return
        await self._budgets.insert_one(
            {
                "user_id": user_id,
                "month": next_month,
                "year": next_year,
                "monthly_income": float(current.get("monthly_income") or 0),
                "weekday_budget_per_day": float(current.get("weekday_budget_per_day") or 0),
                "weekend_budget_per_day": float(current.get("weekend_budget_per_day") or 0),
                "savings_target": float(current.get("savings_target") or 0),
                "category_budgets": current.get("category_budgets") or {},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )

    async def add_mandatory_expense(self, payload: Dict) -> Dict:
        await self.ensure_indexes()
        user_id = normalize_user_id(payload["user_email"])
        due_date = payload["due_date"]
        doc = {
            "user_id": user_id,
            "expense_name": payload["expense_name"],
            "amount": float(payload["amount"]),
            "category": payload["category"],
            "due_date": due_date,
            "month": int(due_date[5:7]),
            "year": int(due_date[:4]),
            "is_recurring": bool(payload.get("is_recurring", True)),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await self._mandatory_expenses.insert_one(doc)
        return self._normalize_expense_doc(serialize(await self._mandatory_expenses.find_one({"_id": result.inserted_id})))

    async def list_mandatory_expenses(self, user_email: str, month: int, year: int) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        cursor = self._mandatory_expenses.find({"user_id": user_id, "month": month, "year": year, "is_recurring": True})
        return [self._normalize_expense_doc(serialize(doc)) async for doc in cursor]

    async def add_emi(self, payload: Dict) -> Dict:
        await self.ensure_indexes()
        user_id = normalize_user_id(payload["user_email"])
        start_month = payload.get("start_month") or datetime.utcnow().date().strftime("%Y-%m")
        doc = {
            "user_id": user_id,
            "emi_name": payload["emi_name"],
            "monthly_amount": float(payload["monthly_amount"]),
            "last_payable_month": payload["last_payable_month"],
            "last_payable_month_value": ym_to_int(payload["last_payable_month"]),
            "start_month": start_month,
            "start_month_value": ym_to_int(start_month),
            "details": payload.get("details", ""),
            "monthly_status": payload.get("monthly_status") or {},
            "monthly_status_dates": payload.get("monthly_status_dates") or {},
            "reminder_enabled": bool(payload.get("reminder_enabled", False)),
            "notification_id": payload.get("notification_id", "") or "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await self._emis.insert_one(doc)
        return self._normalize_emi_doc(serialize(await self._emis.find_one({"_id": result.inserted_id})))

    async def list_emi(self, user_email: str, month: int, year: int) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        target_ym = f"{year}-{str(month).zfill(2)}"
        target_value = ym_to_int(target_ym)
        cursor = self._emis.find(
            {
                "user_id": user_id,
                "start_month_value": {"$lte": target_value},
                "last_payable_month_value": {"$gte": target_value},
            }
        )
        docs = [self._normalize_emi_doc(serialize(doc)) async for doc in cursor]
        for doc in docs:
            doc["current_month_paid"] = bool((doc.get("monthly_status") or {}).get(target_ym, False))
        return docs

    async def update_emi(self, user_email: str, emi_id: str, payload: Dict) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        update = {
            "emi_name": payload["emi_name"],
            "monthly_amount": float(payload["monthly_amount"]),
            "last_payable_month": payload["last_payable_month"],
            "last_payable_month_value": ym_to_int(payload["last_payable_month"]),
            "details": payload.get("details", ""),
            "reminder_enabled": bool(payload.get("reminder_enabled", False)),
            "notification_id": payload.get("notification_id", "") or "",
            "updated_at": datetime.utcnow(),
        }
        await self._emis.update_one({"_id": oid(emi_id), "user_id": user_id}, {"$set": update})
        return self._normalize_emi_doc(serialize(await self._emis.find_one({"_id": oid(emi_id), "user_id": user_id})))

    async def delete_emi(self, user_email: str, emi_id: str) -> bool:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        result = await self._emis.delete_one({"_id": oid(emi_id), "user_id": user_id})
        return result.deleted_count > 0

    async def upcoming_emi(self, user_email: str, today_iso: str, limit: int = 5) -> List[Dict]:
        today = date.fromisoformat(today_iso)
        active = await self.list_emi(user_email, today.month, today.year)
        due_date = date(today.year, today.month, monthrange(today.year, today.month)[1]).isoformat()
        out = []
        for item in active:
            enriched = dict(item)
            enriched["due_date"] = due_date
            out.append(enriched)
            if len(out) >= limit:
                break
        return out

    async def add_sip(self, payload: Dict) -> Dict:
        await self.ensure_indexes()
        user_id = normalize_user_id(payload["user_email"])
        start_month = payload.get("start_month") or datetime.utcnow().date().strftime("%Y-%m")
        doc = {
            "user_id": user_id,
            "sip_name": payload["sip_name"],
            "monthly_amount": float(payload["monthly_amount"]),
            "start_month": start_month,
            "start_month_value": ym_to_int(start_month),
            "details": payload.get("details", ""),
            "monthly_status": payload.get("monthly_status") or {},
            "monthly_status_dates": payload.get("monthly_status_dates") or {},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await self._sips.insert_one(doc)
        return self._normalize_sip_doc(serialize(await self._sips.find_one({"_id": result.inserted_id})))

    async def list_sips(self, user_email: str, month: int | None = None, year: int | None = None) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        query = {"user_id": user_id}
        if month is not None and year is not None:
            query["start_month_value"] = {"$lte": ym_to_int(f"{year}-{str(month).zfill(2)}")}
        cursor = self._sips.find(query)
        docs = [self._normalize_sip_doc(serialize(doc)) async for doc in cursor]
        if month is not None and year is not None:
            target_ym = f"{year}-{str(month).zfill(2)}"
            for doc in docs:
                doc["current_month_paid"] = bool((doc.get("monthly_status") or {}).get(target_ym, False))
        return docs

    async def add_debt(self, payload: Dict) -> Dict:
        await self.ensure_indexes()
        user_id = normalize_user_id(payload["user_email"])
        due_date = payload["due_date"]
        doc = {
            "user_id": user_id,
            "debt_name": payload["debt_name"],
            "amount": float(payload["amount"]),
            "due_date": due_date,
            "month": int(due_date[5:7]),
            "year": int(due_date[:4]),
            "status": payload.get("status", "pending"),
            "installment_amount": float(payload.get("installment_amount") or 0),
            "installment_count": int(payload.get("installment_count") or 0),
            "reminder_enabled": bool(payload.get("reminder_enabled", False)),
            "notification_id": payload.get("notification_id", "") or "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await self._debts.insert_one(doc)
        return self._normalize_debt_doc(serialize(await self._debts.find_one({"_id": result.inserted_id})))

    async def list_debts(self, user_email: str, month: int, year: int) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        cursor = self._debts.find({"user_id": user_id, "month": month, "year": year})
        return [self._normalize_debt_doc(serialize(doc)) async for doc in cursor]

    async def upcoming_debts(self, user_email: str, today_iso: str, limit: int = 5) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        today = date.fromisoformat(today_iso)
        end = date(today.year + (1 if today.month == 12 else 0), 1 if today.month == 12 else today.month + 1, 1).isoformat()
        cursor = (
            self._debts.find({"user_id": user_id, "status": "pending", "due_date": {"$gte": today_iso, "$lt": end}})
            .sort("due_date", 1)
            .limit(limit)
        )
        return [self._normalize_debt_doc(serialize(doc)) async for doc in cursor]

    async def mark_debt_paid(self, user_email: str, debt_id: str) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        paid_at = datetime.utcnow()
        await self._debts.update_one(
            {"_id": oid(debt_id), "user_id": user_id},
            {"$set": {"status": "paid", "paid_at": paid_at, "notification_id": "", "updated_at": paid_at}},
        )
        return self._normalize_debt_doc(serialize(await self._debts.find_one({"_id": oid(debt_id), "user_id": user_id})))

    async def update_debt(self, user_email: str, debt_id: str, payload: Dict) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        due_date = payload["due_date"]
        update = {
            "debt_name": payload["debt_name"],
            "amount": float(payload["amount"]),
            "due_date": due_date,
            "month": int(due_date[5:7]),
            "year": int(due_date[:4]),
            "status": payload.get("status", "pending"),
            "installment_amount": float(payload.get("installment_amount") or 0),
            "installment_count": int(payload.get("installment_count") or 0),
            "reminder_enabled": bool(payload.get("reminder_enabled", False)),
            "notification_id": payload.get("notification_id", "") or "",
            "updated_at": datetime.utcnow(),
        }
        await self._debts.update_one({"_id": oid(debt_id), "user_id": user_id}, {"$set": update})
        return self._normalize_debt_doc(serialize(await self._debts.find_one({"_id": oid(debt_id), "user_id": user_id})))

    async def delete_debt(self, user_email: str, debt_id: str) -> bool:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        result = await self._debts.delete_one({"_id": oid(debt_id), "user_id": user_id})
        return result.deleted_count > 0

    async def get_spend_transaction(self, user_email: str, spend_id: str) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        doc = await self._transactions.find_one({"_id": oid(spend_id), "user_id": user_id, "type": "spend"})
        return serialize(doc)

    async def add_spend(self, payload: Dict) -> Dict:
        await self.ensure_indexes()
        user_id = normalize_user_id(payload["user_email"])
        spend_date = payload["date"]
        doc = {
            "user_id": user_id,
            "type": "spend",
            "amount": float(payload["amount"]),
            "category": payload["category"],
            "note": payload.get("note", ""),
            "date": spend_date,
            "month": int(spend_date[5:7]),
            "year": int(spend_date[:4]),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        # Do not set transaction_key for regular spend inserts. The unique sparse
        # index on transaction_key should only apply to upserted ledger records.
        result = await self._transactions.insert_one(doc)
        return serialize(await self._transactions.find_one({"_id": result.inserted_id}))

    async def month_spends(self, user_email: str, month: int, year: int) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        cursor = self._transactions.find({"user_id": user_id, "type": "spend", "month": month, "year": year})
        return [serialize(doc) async for doc in cursor]

    async def day_spends(self, user_email: str, day_iso: str) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        cursor = self._transactions.find({"user_id": user_id, "type": "spend", "date": day_iso})
        return [serialize(doc) async for doc in cursor]

    async def list_spends(
        self,
        user_email: str,
        month: int | None = None,
        year: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        query: Dict = {"user_id": user_id, "type": "spend"}
        if month is not None and year is not None:
            query["month"] = month
            query["year"] = year
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            query["date"] = date_filter
        cursor = self._transactions.find(query).sort([("date", -1), ("created_at", -1)])
        return [serialize(doc) async for doc in cursor]

    async def update_spend(self, user_email: str, spend_id: str, payload: Dict) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        spend_date = payload["date"]
        await self._transactions.update_one(
            {"_id": oid(spend_id), "user_id": user_id, "type": "spend"},
            {
                "$set": {
                    "amount": float(payload["amount"]),
                    "category": payload["category"],
                    "note": payload.get("note", ""),
                    "date": spend_date,
                    "month": int(spend_date[5:7]),
                    "year": int(spend_date[:4]),
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return serialize(await self._transactions.find_one({"_id": oid(spend_id), "user_id": user_id, "type": "spend"}))

    async def upsert_transaction(self, payload: Dict) -> Dict:
        await self.ensure_indexes()
        user_id = normalize_user_id(payload["user_email"])
        tx_date = payload["date"]
        doc = {
            "user_id": user_id,
            "type": payload["type"],
            "amount": float(payload["amount"]),
            "date": tx_date,
            "month": int(tx_date[:7].split("-")[1]),
            "year": int(tx_date[:4]),
            "category": payload.get("category", ""),
            "note": payload.get("note", ""),
            "name": payload.get("name", ""),
            "reference_id": payload.get("reference_id", ""),
            "reference_type": payload.get("reference_type", ""),
            "transaction_key": payload.get("transaction_key"),
            "meta": payload.get("meta", {}),
            "updated_at": datetime.utcnow(),
        }
        if payload.get("transaction_key"):
            await self._transactions.update_one(
                {"user_id": user_id, "transaction_key": payload["transaction_key"]},
                {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow()}},
                upsert=True,
            )
            saved = await self._transactions.find_one({"user_id": user_id, "transaction_key": payload["transaction_key"]})
            return serialize(saved)
        doc["created_at"] = datetime.utcnow()
        result = await self._transactions.insert_one(doc)
        return serialize(await self._transactions.find_one({"_id": result.inserted_id}))

    async def delete_transaction_by_key(self, user_email: str, transaction_key: str):
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        await self._transactions.delete_one({"user_id": user_id, "transaction_key": transaction_key})

    async def set_emi_month_status(
        self,
        user_email: str,
        emi_id: str,
        month: str,
        paid: bool,
        paid_on: str | None = None,
    ) -> Optional[Dict]:
        await self.ensure_indexes()
        if not valid_ym(month):
            return None
        user_id = normalize_user_id(user_email)
        update: Dict = {"$set": {f"monthly_status.{month}": bool(paid), "updated_at": datetime.utcnow()}}
        if paid:
            resolved = paid_on if (paid_on and valid_iso_date(paid_on)) else datetime.utcnow().date().isoformat()
            update["$set"][f"monthly_status_dates.{month}"] = resolved
        else:
            update["$unset"] = {f"monthly_status_dates.{month}": ""}
        await self._emis.update_one({"_id": oid(emi_id), "user_id": user_id}, update)
        return self._normalize_emi_doc(serialize(await self._emis.find_one({"_id": oid(emi_id), "user_id": user_id})))

    async def set_sip_month_status(
        self,
        user_email: str,
        sip_id: str,
        month: str,
        paid: bool,
        paid_on: str | None = None,
    ) -> Optional[Dict]:
        await self.ensure_indexes()
        if not valid_ym(month):
            return None
        user_id = normalize_user_id(user_email)
        update: Dict = {"$set": {f"monthly_status.{month}": bool(paid), "updated_at": datetime.utcnow()}}
        if paid:
            resolved = paid_on if (paid_on and valid_iso_date(paid_on)) else datetime.utcnow().date().isoformat()
            update["$set"][f"monthly_status_dates.{month}"] = resolved
        else:
            update["$unset"] = {f"monthly_status_dates.{month}": ""}
        await self._sips.update_one({"_id": oid(sip_id), "user_id": user_id}, update)
        return self._normalize_sip_doc(serialize(await self._sips.find_one({"_id": oid(sip_id), "user_id": user_id})))

    async def rebuild_daily_summary(self, user_email: str, day_iso: str):
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        spends = await self.day_spends(user_id, day_iso)
        total_spend = round(sum(float(item.get("amount") or 0) for item in spends), 2)
        category_breakdown: Dict[str, float] = {}
        for item in spends:
            key = str(item.get("category") or "other").lower()
            category_breakdown[key] = round(category_breakdown.get(key, 0.0) + float(item.get("amount") or 0), 2)
        if total_spend == 0 and not spends:
            await self._daily_summaries.delete_one({"user_id": user_id, "date": day_iso})
            return
        await self._daily_summaries.update_one(
            {"user_id": user_id, "date": day_iso},
            {
                "$set": {
                    "user_id": user_id,
                    "date": day_iso,
                    "month": int(day_iso[5:7]),
                    "year": int(day_iso[:4]),
                    "total_spend": total_spend,
                    "transaction_count": len(spends),
                    "category_breakdown": category_breakdown,
                    "updated_at": datetime.utcnow(),
                },
                "$setOnInsert": {"created_at": datetime.utcnow()},
            },
            upsert=True,
        )

    async def get_daily_summary(self, user_email: str, day_iso: str) -> Optional[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        return serialize(await self._daily_summaries.find_one({"user_id": user_id, "date": day_iso}))

    async def list_daily_summaries(self, user_email: str, month: int, year: int) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        cursor = self._daily_summaries.find({"user_id": user_id, "month": month, "year": year})
        return [serialize(doc) async for doc in cursor]

    async def list_transactions(self, user_email: str, month: int, year: int) -> List[Dict]:
        await self.ensure_indexes()
        user_id = normalize_user_id(user_email)
        cursor = self._transactions.find({"user_id": user_id, "month": month, "year": year}).sort([("date", 1), ("created_at", 1)])
        return [serialize(doc) async for doc in cursor]

    @staticmethod
    def _normalize_debt_doc(doc: Optional[Dict]) -> Optional[Dict]:
        if not doc:
            return None
        out = dict(doc)
        if not out.get("debt_name"):
            out["debt_name"] = out.get("name", "Debt")
        if not out.get("status"):
            out["status"] = "pending"
        if out.get("installment_amount") is None:
            out["installment_amount"] = 0.0
        if out.get("installment_count") is None:
            out["installment_count"] = 0
        out["reminder_enabled"] = bool(out.get("reminder_enabled", False))
        out["notification_id"] = out.get("notification_id", "") or ""
        return out

    @staticmethod
    def _normalize_emi_doc(doc: Optional[Dict]) -> Optional[Dict]:
        if not doc:
            return None
        out = dict(doc)
        if not out.get("emi_name"):
            out["emi_name"] = out.get("name", "EMI")
        if out.get("monthly_amount") is None:
            out["monthly_amount"] = float(out.get("amount") or 0.0)
        if not out.get("last_payable_month"):
            out["last_payable_month"] = datetime.utcnow().date().strftime("%Y-%m")
        if not out.get("start_month"):
            out["start_month"] = datetime.utcnow().date().strftime("%Y-%m")
        out["reminder_enabled"] = bool(out.get("reminder_enabled", False))
        out["notification_id"] = out.get("notification_id", "") or ""
        raw_status = out.get("monthly_status") or {}
        out["monthly_status"] = {str(k): bool(v) for k, v in raw_status.items() if valid_ym(str(k))}
        raw_dates = out.get("monthly_status_dates") or {}
        out["monthly_status_dates"] = {
            str(k): str(v)
            for k, v in raw_dates.items()
            if valid_ym(str(k)) and valid_iso_date(str(v))
        }
        return out

    @staticmethod
    def _normalize_expense_doc(doc: Optional[Dict]) -> Optional[Dict]:
        if not doc:
            return None
        out = dict(doc)
        if not out.get("expense_name"):
            out["expense_name"] = out.get("name", "Expense")
        if not out.get("category"):
            out["category"] = "other"
        if out.get("is_recurring") is None:
            out["is_recurring"] = True
        return out

    @staticmethod
    def _normalize_sip_doc(doc: Optional[Dict]) -> Optional[Dict]:
        if not doc:
            return None
        out = dict(doc)
        if not out.get("sip_name"):
            out["sip_name"] = out.get("name", "SIP")
        if out.get("monthly_amount") is None:
            out["monthly_amount"] = float(out.get("amount") or 0.0)
        if not out.get("start_month"):
            out["start_month"] = datetime.utcnow().date().strftime("%Y-%m")
        raw_status = out.get("monthly_status") or {}
        out["monthly_status"] = {str(k): bool(v) for k, v in raw_status.items() if valid_ym(str(k))}
        raw_dates = out.get("monthly_status_dates") or {}
        out["monthly_status_dates"] = {
            str(k): str(v)
            for k, v in raw_dates.items()
            if valid_ym(str(k)) and valid_iso_date(str(v))
        }
        return out
