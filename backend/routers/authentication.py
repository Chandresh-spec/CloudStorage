from ..models import User
from sqlalchemy.ext.asyncio  import AsyncSession
from ..database import get_db_async
from fastapi import Depends,APIRouter,HTTPException,status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import  select
from ..schemas import RegisterInput
from ..auth import hash_password

auth_router=APIRouter(
    prefix='/api/auth',
    tags=['auth']
)



@auth_router.post('/register')
async def register(user_input:RegisterInput,db:AsyncSession=Depends(get_db_async)):

    user=User(
          email=user_input.email,
          name=user_input.name,
          password=hash_password(user_input.password)

     )

    db.add(user)


    try:
        await db.commit()
        return HTTPException(
            status_code=status.HTTP_201_CREATED,
            detail="User Created Sucessfully"

        )
            
        

    except IntegrityError as exc:
        await db.rollback()
        original=exc.orig.__cause__
        

        constraint= original.constraint_name
        print(constraint)
        


        if constraint=='users_name_key':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "field":"username",
                    "message":"Username Must be Unique"}
            )



        elif constraint=='uq_users_username':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "field":"email",
                    "message":"Email Already Exists"}
            )



    

