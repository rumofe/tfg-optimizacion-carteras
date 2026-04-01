from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    yfinance_enabled: bool = True
    alpha_vantage_api_key: Optional[str] = None
    postgres_user: str = ""
    postgres_password: str = ""
    postgres_db: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
