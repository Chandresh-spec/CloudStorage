from .database import Base
from sqlalchemy import String,ForeignKey,Enum as SQLEnum,UniqueConstraint
from sqlalchemy.orm import mapped_column,Mapped
import uuid
from enum import Enum

class statusChoice(str,Enum):
    ACTIVE='Active'
    INACTIVE='Inactive'


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(50), nullable=False)
    password: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[statusChoice] = mapped_column(String(10), default=statusChoice.INACTIVE)

    __table_args__ = (
        UniqueConstraint('email', name='uq_user_email'),
        UniqueConstraint('name', name='uq_users_username'),
    )

    @property
    def is_verified(self) -> bool:
        return self.status == statusChoice.ACTIVE

    @is_verified.setter
    def is_verified(self, value: bool) -> None:
        self.status = statusChoice.ACTIVE if value else statusChoice.INACTIVE
