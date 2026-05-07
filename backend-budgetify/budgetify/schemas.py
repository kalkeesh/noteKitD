from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


MandatoryCategory = Literal[
    "rent",
    "subscriptions",
    "electricity",
    "internet",
    "insurance",
    "other",
]
DebtStatus = Literal["pending", "paid"]


class BudgetSetupIn(BaseModel):
    monthly_income: float = Field(..., gt=0)
    weekday_budget_per_day: float = Field(..., gt=0)
    weekend_budget_per_day: float = Field(..., gt=0)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    savings_target: float = Field(default=0, ge=0)
    category_budgets: Dict[str, float] = Field(default_factory=dict)


class BudgetSetupOut(BaseModel):
    id: str
    monthly_income: float
    weekday_budget_per_day: float
    weekend_budget_per_day: float
    savings_target: float = 0
    category_budgets: Dict[str, float] = Field(default_factory=dict)
    month: int
    year: int


class MandatoryExpenseIn(BaseModel):
    expense_name: str = Field(..., min_length=1, max_length=120)
    amount: float = Field(..., gt=0)
    category: MandatoryCategory
    due_date: date
    is_recurring: bool = True


class MandatoryExpenseOut(BaseModel):
    id: str
    expense_name: str
    amount: float
    category: MandatoryCategory
    due_date: date
    is_recurring: bool


class EMIIn(BaseModel):
    emi_name: str = Field(..., min_length=1, max_length=120)
    monthly_amount: float = Field(..., gt=0)
    last_payable_month: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    details: str = Field(default="", max_length=220)
    reminder_enabled: bool = False
    notification_id: str = ""


class EMIOut(BaseModel):
    id: str
    emi_name: str
    monthly_amount: float
    last_payable_month: str
    details: str = ""
    current_month_paid: bool = False
    monthly_status: Dict[str, bool] = Field(default_factory=dict)
    monthly_status_dates: Dict[str, str] = Field(default_factory=dict)
    reminder_enabled: bool = False
    notification_id: str = ""


class EMIUpdateIn(BaseModel):
    emi_name: str = Field(..., min_length=1, max_length=120)
    monthly_amount: float = Field(..., gt=0)
    last_payable_month: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    details: str = Field(default="", max_length=220)
    reminder_enabled: bool = False
    notification_id: str = ""


class SIPIn(BaseModel):
    sip_name: str = Field(..., min_length=1, max_length=120)
    monthly_amount: float = Field(..., gt=0)
    details: str = Field(default="", max_length=220)


class SIPOut(BaseModel):
    id: str
    sip_name: str
    monthly_amount: float
    details: str = ""
    current_month_paid: bool = False
    monthly_status: Dict[str, bool] = Field(default_factory=dict)
    monthly_status_dates: Dict[str, str] = Field(default_factory=dict)


class DebtIn(BaseModel):
    debt_name: str = Field(..., min_length=1, max_length=120)
    amount: float = Field(..., gt=0)
    due_date: date
    status: DebtStatus = "pending"
    installment_amount: float = Field(default=0, ge=0)
    installment_count: int = Field(default=0, ge=0)
    reminder_enabled: bool = False
    notification_id: str = ""


class DebtOut(BaseModel):
    id: str
    debt_name: str
    amount: float
    due_date: date
    status: DebtStatus
    installment_amount: float = 0
    installment_count: int = 0
    paid_at: Optional[datetime] = None
    reminder_enabled: bool = False
    notification_id: str = ""


class DebtUpdateIn(BaseModel):
    debt_name: str = Field(..., min_length=1, max_length=120)
    amount: float = Field(..., gt=0)
    due_date: date
    status: DebtStatus = "pending"
    installment_amount: float = Field(default=0, ge=0)
    installment_count: int = Field(default=0, ge=0)
    reminder_enabled: bool = False
    notification_id: str = ""


class SpendIn(BaseModel):
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=80)
    note: str = Field(default="", max_length=220)
    date: date


class SpendOut(BaseModel):
    id: str
    amount: float
    category: str
    note: str = ""
    date: date


class SpendUpdateIn(BaseModel):
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=80)
    note: str = Field(default="", max_length=220)
    date: date


class MonthlyPaidStatusIn(BaseModel):
    month: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    paid: bool
    paid_on: Optional[date] = None


class ActionOut(BaseModel):
    ok: bool


class PaymentAlert(BaseModel):
    id: str
    name: str
    amount: float
    due_date: date
    due_in_days: int
    severity: Literal["green", "yellow", "red"]
    kind: Literal["emi", "debt"]


class BudgetAlert(BaseModel):
    id: str
    title: str
    message: str
    severity: Literal["low", "medium", "high"]
    kind: Literal["overspending", "emi_due", "debt_overdue", "low_balance"]


class CategoryBudgetStatus(BaseModel):
    category: str
    limit: float
    spent: float
    remaining: float
    status: Literal["under", "near", "over"]


class TodayBudgetOut(BaseModel):
    month: int
    year: int
    today: date
    recommended_budget: float
    actual_spend: float
    remaining_budget: float
    spend_status: Literal["under", "near", "over"]
    spend_status_color: Literal["green", "yellow", "red"]
    upcoming_emi: List[EMIOut]
    upcoming_debt: List[DebtOut]
    alerts: List[PaymentAlert]
    burn_rate: float = 0
    projected_end_balance: float = 0
    savings_progress: float = 0
    risk_indicator: Literal["low", "medium", "high"] = "low"
    category_budget_status: List[CategoryBudgetStatus] = Field(default_factory=list)
    smart_alerts: List[BudgetAlert] = Field(default_factory=list)


class BudgetReportOut(BaseModel):
    month: int
    year: int
    total_spent: float
    total_saved: float
    expense_breakdown_by_category: Dict[str, float]
    EMI_ratio: float
    SIP_ratio: float
    debt_ratio: float
    savings_rate: float
    average_daily_spend: float
    weekly_spending_pattern: Dict[str, float]
    budget_health_score: int
    previous_month_total_spent: float = 0
    monthly_spend_change: float = 0


class BudgetSummaryOut(BaseModel):
    today: TodayBudgetOut
    report: BudgetReportOut
    mandatory_expenses: List[MandatoryExpenseOut]
    emis: List[EMIOut]
    sips: List[SIPOut]
    debts: List[DebtOut]
    spends: List[SpendOut]
    recent_spends: List[SpendOut]
    daily_summaries: List[Dict] = Field(default_factory=list)
