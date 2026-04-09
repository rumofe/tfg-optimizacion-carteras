from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserProfileOut(BaseModel):
    email: EmailStr
    capital_base: float | None
    tolerancia_riesgo: float | None

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    capital_base: float | None = None
    tolerancia_riesgo: float | None = None
