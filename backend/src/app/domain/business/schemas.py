from __future__ import annotations

import uuid
from datetime import date, datetime

import msgspec


class ClientCreate(msgspec.Struct, frozen=True):
    name: str
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class ClientRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    name: str
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SupplierCreate(msgspec.Struct, frozen=True):
    name: str
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class SupplierRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    name: str
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class QuotationCreate(msgspec.Struct, frozen=True):
    quotation_number: str
    client_name: str
    amount_ugx: float
    issue_date: date
    client_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    status: str = "draft"
    valid_until: date | None = None
    notes: str | None = None


class QuotationRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    quotation_number: str
    client_id: uuid.UUID | None
    project_id: uuid.UUID | None
    client_name: str
    amount_ugx: float
    status: str
    issue_date: date
    valid_until: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class InvoiceCreate(msgspec.Struct, frozen=True):
    invoice_number: str
    client_name: str
    amount_ugx: float
    issue_date: date
    client_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    paid_amount_ugx: float = 0
    status: str = "draft"
    due_date: date | None = None
    notes: str | None = None


class InvoiceRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    invoice_number: str
    client_id: uuid.UUID | None
    project_id: uuid.UUID | None
    client_name: str
    amount_ugx: float
    paid_amount_ugx: float
    status: str
    issue_date: date
    due_date: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class PaymentCreate(msgspec.Struct, frozen=True):
    amount_ugx: float
    payment_date: date
    project_id: uuid.UUID | None = None
    invoice_id: uuid.UUID | None = None
    method: str = "bank"
    reference: str | None = None
    notes: str | None = None


class PaymentRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    project_id: uuid.UUID | None
    invoice_id: uuid.UUID | None
    amount_ugx: float
    payment_date: date
    method: str
    reference: str | None
    notes: str | None
    recorded_by_email: str
    created_at: datetime
    updated_at: datetime


class PurchaseOrderCreate(msgspec.Struct, frozen=True):
    po_number: str
    supplier_name: str
    amount_ugx: float
    order_date: date
    supplier_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    status: str = "draft"
    expected_date: date | None = None
    notes: str | None = None


class PurchaseOrderRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    po_number: str
    supplier_id: uuid.UUID | None
    project_id: uuid.UUID | None
    supplier_name: str
    amount_ugx: float
    status: str
    order_date: date
    expected_date: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ExpenseCreate(msgspec.Struct, frozen=True):
    description: str
    amount_ugx: float
    expense_date: date
    project_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    category: str = "general"
    reference: str | None = None


class ExpenseRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    project_id: uuid.UUID | None
    supplier_id: uuid.UUID | None
    category: str
    description: str
    amount_ugx: float
    expense_date: date
    reference: str | None
    created_at: datetime
    updated_at: datetime


class BusinessSummary(msgspec.Struct, frozen=True):
    clients: int
    suppliers: int
    quotations_open: int
    invoice_outstanding_ugx: float
    expenses_ugx: float
