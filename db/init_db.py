"""
db/init_db.py — Native PostgreSQL database schema initialization.
"""
from __future__ import annotations

import structlog

from db.models import Base
from db.session import engine

logger = structlog.get_logger(__name__)


async def init_db() -> None:
    """
    Create all ORM tables using SQLAlchemy Base.metadata.create_all.
    """
    logger.info("========== DATABASE INITIALIZATION ==========")
    logger.info("Tables discovered", tables=list(Base.metadata.tables.keys()))

    try:
        async with engine.begin() as conn:
            logger.info("Running Base.metadata.create_all()")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Base.metadata.create_all() completed successfully")

    except Exception as exc:
        logger.exception(
            "DATABASE INITIALIZATION FAILED",
            error=str(exc),
        )
        raise

    logger.info("Database initialization complete")