from .database import Base
from sqlalchemy import String,ForeignKey,Enum as SQLEnum,UniqueConstraint
from sqlalchemy.orm import mapped_column,Mapped
import uuid
from enum import Enum

class statusChoice(str,Enum):
    ACTIVE='Active'
    INACTIVE='Inactive'


class User(Base):
    __tablename__ ="users"
    id:Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    name:Mapped[str]=mapped_column(String(50),unique=True,nullable=False)
    email:Mapped[str]=mapped_column(String(20),unique=True,nullable=False)
    password:Mapped[str]=mapped_column(String(100),nullable=False)
    status:Mapped[statusChoice]=mapped_column(String(10),default=statusChoice.ACTIVE)


    __table_args__ =(UniqueConstraint(
        'email',name='uq_users_username'),
        UniqueConstraint(
            'name',name='uq_user_email'
        )
    )



