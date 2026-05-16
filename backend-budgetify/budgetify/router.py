from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pymongo.errors import PyMongoError

from auth_dependency import get_current_user
from db import db

from .repository import BudgetRepository
from .schemas import (
    ActionOut,
    BudgetReportOut,
    BudgetSummaryOut,
    BudgetSetupIn,
    BudgetSetupOut,
    DebtIn,
    DebtOut,
    DebtUpdateIn,
    EMIIn,
    EMIOut,
    EMIUpdateIn,
    MonthlyPaidStatusIn,
    SIPIn,
    SIPOut,
    MandatoryExpenseIn,
    MandatoryExpenseOut,
    SpendIn,
    SpendOut,
    SpendUpdateIn,
    TodayBudgetOut,
)
from .service import BudgetService


router = APIRouter(prefix="/budget", tags=["Budgetify"])
service = BudgetService(BudgetRepository())


@router.get("/health")
async def health_check():
    try:
        await db.command("ping")
    except PyMongoError as exc:
        return {"status": "error", "message": str(exc)}
    return {"status": "ok", "message": "Connected to MongoDB successfully!"}


@router.post("/setup", response_model=BudgetSetupOut)
async def budget_setup(payload: BudgetSetupIn, current_user=Depends(get_current_user)):
    return await service.setup_budget(current_user["email"], payload.dict())


@router.post("/expense", response_model=MandatoryExpenseOut)
async def add_mandatory_expense(payload: MandatoryExpenseIn, current_user=Depends(get_current_user)):
    return await service.add_mandatory_expense(current_user["email"], payload.dict())


@router.post("/emi", response_model=EMIOut)
async def add_emi(payload: EMIIn, current_user=Depends(get_current_user)):
    return await service.add_emi(current_user["email"], payload.dict())


@router.put("/emi/{id}", response_model=EMIOut)
async def update_emi(id: str, payload: EMIUpdateIn, current_user=Depends(get_current_user)):
    return await service.update_emi(current_user["email"], id, payload.dict())


@router.delete("/emi/{id}", response_model=ActionOut)
async def delete_emi(id: str, current_user=Depends(get_current_user)):
    return await service.delete_emi(current_user["email"], id)


@router.post("/sip", response_model=SIPOut)
async def add_sip(payload: SIPIn, current_user=Depends(get_current_user)):
    return await service.add_sip(current_user["email"], payload.dict())


@router.post("/debt", response_model=DebtOut)
async def add_debt(payload: DebtIn, current_user=Depends(get_current_user)):
    return await service.add_debt(current_user["email"], payload.dict())


@router.put("/debt/{id}/paid", response_model=DebtOut)
async def mark_debt_paid(id: str, current_user=Depends(get_current_user)):
    return await service.mark_debt_paid(current_user["email"], id)


@router.put("/debt/{id}", response_model=DebtOut)
async def update_debt(id: str, payload: DebtUpdateIn, current_user=Depends(get_current_user)):
    return await service.update_debt(current_user["email"], id, payload.dict())


@router.delete("/debt/{id}", response_model=ActionOut)
async def delete_debt(id: str, current_user=Depends(get_current_user)):
    return await service.delete_debt(current_user["email"], id)


@router.post("/spend", response_model=SpendOut)
async def add_spend(payload: SpendIn, current_user=Depends(get_current_user)):
    return await service.add_spend(current_user["email"], payload.dict())


@router.put("/spend/{id}", response_model=SpendOut)
async def update_spend(id: str, payload: SpendUpdateIn, current_user=Depends(get_current_user)):
    return await service.update_spend(current_user["email"], id, payload.dict())


@router.get("/spend", response_model=list[SpendOut])
async def list_spends(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    date_from: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])-\d{2}$"),
    date_to: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])-\d{2}$"),
    current_user=Depends(get_current_user),
):
    return await service.spends(current_user["email"], month, year, date_from, date_to)


@router.get("/today", response_model=TodayBudgetOut)
async def today_budget(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
):
    return await service.today(current_user["email"], month, year)


@router.get("/report", response_model=BudgetReportOut)
async def report(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
):
    return await service.report(current_user["email"], month, year)


@router.get("/summary", response_model=BudgetSummaryOut)
async def summary(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
):
    return await service.summary(current_user["email"], month, year)


@router.get("/debts", response_model=list[DebtOut])
async def list_debts(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
):
    return await service.debts(current_user["email"], month, year)


@router.get("/expenses", response_model=list[MandatoryExpenseOut])
async def list_mandatory_expenses(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
):
    return await service.mandatory_expenses(current_user["email"], month, year)


@router.get("/emi", response_model=list[EMIOut])
async def list_emi(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
):
    return await service.emis(current_user["email"], month, year)


@router.put("/emi/{id}/status", response_model=EMIOut)
async def set_emi_month_status(id: str, payload: MonthlyPaidStatusIn, current_user=Depends(get_current_user)):
    return await service.set_emi_month_status(
        current_user["email"], id, payload.month, payload.paid, payload.paid_on
    )


@router.get("/sip", response_model=list[SIPOut])
async def list_sip(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user=Depends(get_current_user),
):
    return await service.sips(current_user["email"], month, year)


@router.put("/sip/{id}/status", response_model=SIPOut)
async def set_sip_month_status(id: str, payload: MonthlyPaidStatusIn, current_user=Depends(get_current_user)):
    return await service.set_sip_month_status(
        current_user["email"], id, payload.month, payload.paid, payload.paid_on
    )
