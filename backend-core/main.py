from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo.errors import PyMongoError

from ai.router import router as ai_router
from authent import router as auth_router
from config import settings
from db import ensure_core_indexes, verify_database_connection
from link_preview.router import router as link_preview_router
from notes import router as notes_router
from search.router import router as search_router
from todolist import router as todo_router


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await verify_database_connection()
        await ensure_core_indexes()
    except RuntimeError:
        if settings.require_db_on_startup:
            raise
        logger.warning("MongoDB was unavailable during startup; continuing because REQUIRE_DB_ON_STARTUP is disabled.")
    yield


app = FastAPI(
    title="NoteKit API",
    description="Combined Auth, Notes, Todos, Budget, Search, and Assistant API",
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

app.include_router(auth_router)
app.include_router(notes_router)
app.include_router(todo_router)
app.include_router(search_router)
app.include_router(link_preview_router)
app.include_router(ai_router)

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.exception_handler(PyMongoError)
async def mongodb_exception_handler(_: Request, exc: PyMongoError):
    del exc
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


@app.get("/")
async def root():
    return {
        "message": "Welcome to NoteKit Core API",
        "environment": settings.app_env,
        "docs": "/docs",
    }
