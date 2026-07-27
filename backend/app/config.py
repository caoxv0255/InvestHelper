from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_name: str = "投资决策优化助手"
    app_env: str = "development"
    debug: bool = True
    database_url: str = "sqlite:///./data/investment.db"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    api_prefix: str = "/api"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
