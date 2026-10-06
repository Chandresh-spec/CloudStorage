from pydantic import BaseModel, Field, EmailStr

class RegisterInput(BaseModel):
    name: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=50)
    email: EmailStr

class LoginInputSchema(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = Field(default=None, min_length=3, max_length=50)
    password: str

class RefreshTokenSchema(BaseModel):
    access_token: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    status: str



class VerifyIn(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")



class ResendIn(BaseModel):
    email: EmailStr