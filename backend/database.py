from sqlalchemy.orm import sessionmaker,DeclarativeBase
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine,AsyncSession


import logging
from .config import settings


logger=logging.getLogger(__name__)


sync_engine=create_engine(
    settings.sync_database_url,
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_recycle=settings.pool_recycle,
    pool_pre_ping=settings.pool_pre_ping,
    pool_timeout=settings.pool_timeout
)

local_Session_Sync=sessionmaker(
    bind=sync_engine,
    autoflush=False,
    autocommit=False
    
)



def get_db():
    session=local_Session_Sync()
    try:
        yield session
    except Exception:
        
        logger.exception("DATABASE ROLLEDBACK DUE TO SOME ERROR")
        raise
    finally:
        session.close()





#___________________-ASYNC DRIVERS__________________________________________________________________-

async_engine=create_async_engine(
    settings.async_database_url,
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_recycle=settings.pool_recycle,
    pool_pre_ping=settings.pool_pre_ping,
    pool_timeout=settings.pool_timeout

)


Async_Local_Session=async_sessionmaker(
    bind=async_engine,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession
)


async def get_db_async():
    async with Async_Local_Session() as session:
        try:
            yield session
          
        except Exception:
            logger.exception("DATABASE ROLLEDBACK DUE TO SOME ERROR")
            raise
        finally:
            await session.close()




class Base(DeclarativeBase):
    pass