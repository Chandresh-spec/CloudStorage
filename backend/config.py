from pydantic_settings import BaseSettings,SettingsConfigDict
from functools import lru_cache




class Settings(BaseSettings):
    pool_size:int
    max_overflow:int
    pool_recycle:int
    pool_pre_ping:bool=True,
    pool_timeout:int

    sync_database_url:str
    async_database_url:str

    model_config=SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        ignore=True
    )


@lru_cache
def get_settings():
    return Settings()


settings=get_settings()


