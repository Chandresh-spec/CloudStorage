from fastapi import FastAPI

from .database import Base,sync_engine
from .models import User
from .routers import authentication
print(Base.metadata.__dict__)
Base.metadata.create_all(bind=sync_engine)


app=FastAPI()



app.include_router(authentication.auth_router)