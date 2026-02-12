"""
IPMCC Commander - Database Configuration
SQLite with async support via aiosqlite
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
from app.config import settings


# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=False,  # Set to True for SQL debugging
    connect_args={"check_same_thread": False}  # SQLite specific
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


async def get_db():
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables."""
    from app.models import position, cycle  # Import models to register them
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Database initialized successfully")


async def close_db():
    """Close database connections."""
    await engine.dispose()
