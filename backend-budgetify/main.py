from __future__ import annotations

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from budgetify.router import router as budget_router, service as budget_service
from config import settings
from db import verify_database_connection


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await verify_database_connection()
        await budget_service.repo.ensure_indexes()
    except RuntimeError:
        if settings.require_db_on_startup:
            raise
        logger.warning("MongoDB was unavailable during startup; continuing because REQUIRE_DB_ON_STARTUP is disabled.")
    yield


app = FastAPI(
    title="NoteKit Budgetify API",
    description="Budgetify API service",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(budget_router)


@app.exception_handler(PyMongoError)
async def mongodb_exception_handler(_: Request, exc: PyMongoError):
    del exc
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


@app.get("/")
async def root():
    return {
        "message": "Welcome to NoteKit Budgetify API",
        "environment": settings.app_env,
        "docs": "/docs",
    }
