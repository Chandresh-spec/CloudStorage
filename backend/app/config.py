from pydantic_settings import BaseSettings,SettingsConfigDict
from functools import lru_cache






class Settings(BaseSettings):
    pool_size:int
    max_overflow:int
    pool_recycle:int
    pool_pre_ping:bool=True
    pool_timeout:int

    sync_database_url:str
    async_database_url:str
    #COOKIES SETTING
    httponly:bool
    secure:bool
    samesite:str
    access_max_age:int
    refresh_max_age:int
    access_path:str
    refresh_path:str


    # Redis & OTP settings
    redis_url: str = "redis://localhost:6379/0"
    otp_secret: str = "dev-otp-hmac-secret-key-change-in-prod"
    otp_cooldown: int = 30
    otp_max_attempts: int = 5
    otp_max_sends_per_hour: int = 10
    otp_ttl_seconds: int = 300

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore'
    )




@lru_cache
def get_settings():
    return Settings()


settings=get_settings()


