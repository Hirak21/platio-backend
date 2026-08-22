from pydantic import BaseModel, Field
from typing import Optional, List


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str
    password: str


# ---------- Projects ----------
class ProjectCreate(BaseModel):
    name: str
    project_code: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    expected_end_date: Optional[str] = None
    budget: float = 0
    status: str = "active"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    expected_end_date: Optional[str] = None
    budget: Optional[float] = None
    status: Optional[str] = None


# ---------- Transactions ----------
class TransactionCreate(BaseModel):
    project_id: int
    type: str  # income | expense
    amount: float
    date: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    party: Optional[str] = None
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    party: Optional[str] = None
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


# ---------- Report filters ----------
class ReportFilters(BaseModel):
    project_id: Optional[int] = None
    type: Optional[str] = None
    category: Optional[str] = None
    party: Optional[str] = None
    payment_method: Optional[str] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
