"""
IPMCC Commander - Configuration Settings
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
from typing import List, Optional


# Calculate the absolute path to the .env file
ENV_FILE_PATH = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/ipmcc.db"
    
    # API
    api_title: str = "IPMCC Commander API"
    api_version: str = "2.5.0"
    api_description: str = "Income Poor Man's Covered Call Trading Journal & Analysis"
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    debug: bool = False
    
    # Charles Schwab API
    schwab_app_key: Optional[str] = None
    schwab_app_secret: Optional[str] = None
    schwab_callback_url: str = "https://127.0.0.1"
    
    # External APIs
    finnhub_api_key: str = "demo"
    
    # Greeks calculation defaults
    risk_free_rate: float = 5.0  # As percentage for mibian
    
    # Validation thresholds (from IPMCC strategy)
    min_long_delta: float = 70.0
    max_long_delta: float = 90.0
    preferred_long_delta: float = 80.0
    min_long_dte: int = 180
    preferred_short_dte: int = 7
    max_short_dte: int = 14
    roll_threshold: float = 0.20  # Roll when extrinsic < 20%
    emergency_exit_threshold: float = 0.30  # Exit if loss > 30%
    
    # Paths
    base_dir: Path = Path(__file__).parent.parent
    data_dir: Path = base_dir / "data"
    
    # Config MUST be nested inside Settings class
    class Config:
        env_file = str(ENV_FILE_PATH)  # Use absolute path
        env_file_encoding = "utf-8"
        extra = "ignore"


# Global settings instance
settings = Settings()

# Ensure data directory exists
settings.data_dir.mkdir(exist_ok=True)