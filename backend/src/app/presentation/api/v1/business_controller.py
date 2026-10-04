from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, ClassVar

from litestar import Controller, Request, get, post
from litestar.exceptions import ClientException, NotFoundException
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.business.models import (
    Client,
    Expense,
    Invoice,
    Payment,
    PurchaseOrder,
    Quotation,
    Supplier,
)
from app.domain.business.schemas import (
    BusinessSummary,
    ClientCreate,
    ClientRead,
    ExpenseCreate,
    ExpenseRead,
    InvoiceCreate,
    InvoiceRead,
    PaymentCreate,
    PaymentRead,
    PurchaseOrderCreate,
    PurchaseOrderRead,
    QuotationCreate,
    QuotationRead,
    SupplierCreate,
    SupplierRead,
)
from app.domain.workspace.models import Project
from app.presentation.guards.auth_guard import JWTAuthGuard


def _email(request: Request) -> str:
    email = str(request.scope.get("email") or "").strip().lower()
    if not email:
        raise ClientException(detail="Authenticated email is required.", status_code=401)
    return email


def _client_read(item: Client) -> ClientRead:
    return ClientRead(
        id=item.id,
        name=item.name,
        contact_person=item.contact_person,
        phone=item.phone,
        email=item.email,
        address=item.address,
        notes=item.notes,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _supplier_read(item: Supplier) -> SupplierRead:
    return SupplierRead(
        id=item.id,
        name=item.name,
        contact_person=item.contact_person,
        phone=item.phone,
        email=item.email,
        address=item.address,
        notes=item.notes,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _quotation_read(item: Quotation) -> QuotationRead:
    return QuotationRead(
        id=item.id,
        quotation_number=item.quotation_number,
        client_id=item.client_id,
        project_id=item.project_id,
        client_name=item.client_name,
        amount_ugx=float(item.amount_ugx or 0),
        status=item.status,
        issue_date=item.issue_date,
        valid_until=item.valid_until,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _invoice_read(item: Invoice) -> InvoiceRead:
    return InvoiceRead(
        id=item.id,
        invoice_number=item.invoice_number,
        client_id=item.client_id,
        project_id=item.project_id,
        client_name=item.client_name,
        amount_ugx=float(item.amount_ugx or 0),
        paid_amount_ugx=float(item.paid_amount_ugx or 0),
        status=item.status,
        issue_date=item.issue_date,
        due_date=item.due_date,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _payment_read(item: Payment) -> PaymentRead:
    return PaymentRead(
        id=item.id,
        project_id=item.project_id,
        invoice_id=item.invoice_id,
        amount_ugx=float(item.amount_ugx or 0),
        payment_date=item.payment_date,
        method=item.method,
        reference=item.reference,
        notes=item.notes,
        recorded_by_email=item.recorded_by_email,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _po_read(item: PurchaseOrder) -> PurchaseOrderRead:
    return PurchaseOrderRead(
        id=item.id,
        po_number=item.po_number,
        supplier_id=item.supplier_id,
        project_id=item.project_id,
        supplier_name=item.supplier_name,
        amount_ugx=float(item.amount_ugx or 0),
        status=item.status,
        order_date=item.order_date,
        expected_date=item.expected_date,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _expense_read(item: Expense) -> ExpenseRead:
    return ExpenseRead(
        id=item.id,
        project_id=item.project_id,
        supplier_id=item.supplier_id,
        category=item.category,
        description=item.description,
        amount_ugx=float(item.amount_ugx or 0),
        expense_date=item.expense_date,
        reference=item.reference,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


class BusinessController(Controller):
    path = "/business"
    guards: ClassVar[list[Any]] = [JWTAuthGuard()]

    @get(path="/clients")
    async def clients(self, db_session: AsyncSession) -> list[ClientRead]:
        rows = (
            (
                await db_session.execute(
                    select(Client).where(Client.is_active.is_(True)).order_by(Client.name)
                )
            )
            .scalars()
            .all()
        )
        return [_client_read(row) for row in rows]

    @post(path="/clients", status_code=HTTP_201_CREATED)
    async def create_client(self, data: ClientCreate, db_session: AsyncSession) -> ClientRead:
        if not data.name.strip():
            raise ClientException(detail="Client name is required.", status_code=400)
        item = Client(
            name=data.name.strip(),
            contact_person=data.contact_person,
            phone=data.phone,
            email=data.email,
            address=data.address,
            notes=data.notes,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _client_read(item)

    @get(path="/suppliers")
    async def suppliers(self, db_session: AsyncSession) -> list[SupplierRead]:
        rows = (
            (
                await db_session.execute(
                    select(Supplier).where(Supplier.is_active.is_(True)).order_by(Supplier.name)
                )
            )
            .scalars()
            .all()
        )
        return [_supplier_read(row) for row in rows]

    @post(path="/suppliers", status_code=HTTP_201_CREATED)
    async def create_supplier(self, data: SupplierCreate, db_session: AsyncSession) -> SupplierRead:
        if not data.name.strip():
            raise ClientException(detail="Supplier name is required.", status_code=400)
        item = Supplier(
            name=data.name.strip(),
            contact_person=data.contact_person,
            phone=data.phone,
            email=data.email,
            address=data.address,
            notes=data.notes,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _supplier_read(item)

    @get(path="/quotations")
    async def quotations(self, db_session: AsyncSession) -> list[QuotationRead]:
        rows = (
            (await db_session.execute(select(Quotation).order_by(Quotation.created_at.desc())))
            .scalars()
            .all()
        )
        return [_quotation_read(row) for row in rows]

    @post(path="/quotations", status_code=HTTP_201_CREATED)
    async def create_quotation(
        self, request: Request, data: QuotationCreate, db_session: AsyncSession
    ) -> QuotationRead:
        item = Quotation(
            quotation_number=data.quotation_number.strip(),
            client_id=data.client_id,
            project_id=data.project_id,
            client_name=data.client_name.strip(),
            amount_ugx=Decimal(str(max(0, data.amount_ugx))),
            status=data.status,
            issue_date=data.issue_date,
            valid_until=data.valid_until,
            notes=data.notes,
            created_by_email=_email(request),
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _quotation_read(item)

    @get(path="/invoices")
    async def invoices(self, db_session: AsyncSession) -> list[InvoiceRead]:
        rows = (
            (await db_session.execute(select(Invoice).order_by(Invoice.created_at.desc())))
            .scalars()
            .all()
        )
        return [_invoice_read(row) for row in rows]

    @post(path="/invoices", status_code=HTTP_201_CREATED)
    async def create_invoice(
        self, request: Request, data: InvoiceCreate, db_session: AsyncSession
    ) -> InvoiceRead:
        paid = max(0, data.paid_amount_ugx)
        amount = max(0, data.amount_ugx)
        status = data.status
        if paid >= amount > 0:
            status = "paid"
        elif paid > 0 and status == "draft":
            status = "partial"
        item = Invoice(
            invoice_number=data.invoice_number.strip(),
            client_id=data.client_id,
            project_id=data.project_id,
            client_name=data.client_name.strip(),
            amount_ugx=Decimal(str(amount)),
            paid_amount_ugx=Decimal(str(min(paid, amount) if amount else paid)),
            status=status,
            issue_date=data.issue_date,
            due_date=data.due_date,
            notes=data.notes,
            created_by_email=_email(request),
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _invoice_read(item)

    @get(path="/payments")
    async def payments(
        self,
        db_session: AsyncSession,
        project_id: str | None = None,
        invoice_id: str | None = None,
    ) -> list[PaymentRead]:
        stmt = select(Payment).order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        if project_id:
            try:
                stmt = stmt.where(Payment.project_id == uuid.UUID(project_id))
            except ValueError as exc:
                raise ClientException(detail="Invalid project id.", status_code=400) from exc
        if invoice_id:
            try:
                stmt = stmt.where(Payment.invoice_id == uuid.UUID(invoice_id))
            except ValueError as exc:
                raise ClientException(detail="Invalid invoice id.", status_code=400) from exc
        rows = (await db_session.execute(stmt)).scalars().all()
        return [_payment_read(row) for row in rows]

    @post(path="/payments", status_code=HTTP_201_CREATED)
    async def create_payment(
        self,
        request: Request,
        data: PaymentCreate,
        db_session: AsyncSession,
    ) -> PaymentRead:
        amount = Decimal(str(max(0, data.amount_ugx)))
        if amount <= 0:
            raise ClientException(
                detail="Payment amount must be greater than zero.", status_code=400
            )

        invoice: Invoice | None = None
        project_id = data.project_id

        if data.invoice_id:
            invoice = await db_session.get(Invoice, data.invoice_id)
            if invoice is None:
                raise NotFoundException(detail="Invoice not found.")
            if project_id and invoice.project_id and project_id != invoice.project_id:
                raise ClientException(
                    detail="Invoice does not belong to the selected project.",
                    status_code=409,
                )
            project_id = project_id or invoice.project_id
            outstanding = max(Decimal(), invoice.amount_ugx - invoice.paid_amount_ugx)
            if amount > outstanding:
                raise ClientException(
                    detail="Payment exceeds the invoice outstanding amount.",
                    status_code=409,
                )

        project: Project | None = None
        if project_id:
            project = await db_session.get(Project, project_id)
            if project is None:
                raise NotFoundException(detail="Project not found.")

        item = Payment(
            project_id=project_id,
            invoice_id=data.invoice_id,
            amount_ugx=amount,
            payment_date=data.payment_date,
            method=data.method.strip().lower() or "bank",
            reference=data.reference.strip() if data.reference else None,
            notes=data.notes,
            recorded_by_email=_email(request),
        )
        db_session.add(item)

        if invoice is not None:
            invoice.paid_amount_ugx = min(invoice.amount_ugx, invoice.paid_amount_ugx + amount)
            invoice.status = "paid" if invoice.paid_amount_ugx >= invoice.amount_ugx else "partial"

        if project is not None:
            received = (project.amount_paid_ugx or Decimal()) + amount
            project.amount_paid_ugx = (
                min(project.value_ugx, received)
                if project.value_ugx and project.value_ugx > 0
                else received
            )

        await db_session.commit()
        await db_session.refresh(item)
        return _payment_read(item)

    @get(path="/purchase-orders")
    async def purchase_orders(self, db_session: AsyncSession) -> list[PurchaseOrderRead]:
        rows = (
            (
                await db_session.execute(
                    select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
        return [_po_read(row) for row in rows]

    @post(path="/purchase-orders", status_code=HTTP_201_CREATED)
    async def create_purchase_order(
        self, request: Request, data: PurchaseOrderCreate, db_session: AsyncSession
    ) -> PurchaseOrderRead:
        item = PurchaseOrder(
            po_number=data.po_number.strip(),
            supplier_id=data.supplier_id,
            project_id=data.project_id,
            supplier_name=data.supplier_name.strip(),
            amount_ugx=Decimal(str(max(0, data.amount_ugx))),
            status=data.status,
            order_date=data.order_date,
            expected_date=data.expected_date,
            notes=data.notes,
            created_by_email=_email(request),
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _po_read(item)

    @get(path="/expenses")
    async def expenses(self, db_session: AsyncSession) -> list[ExpenseRead]:
        rows = (
            (
                await db_session.execute(
                    select(Expense).order_by(Expense.expense_date.desc(), Expense.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
        return [_expense_read(row) for row in rows]

    @post(path="/expenses", status_code=HTTP_201_CREATED)
    async def create_expense(
        self, request: Request, data: ExpenseCreate, db_session: AsyncSession
    ) -> ExpenseRead:
        item = Expense(
            project_id=data.project_id,
            supplier_id=data.supplier_id,
            category=data.category,
            description=data.description.strip(),
            amount_ugx=Decimal(str(max(0, data.amount_ugx))),
            expense_date=data.expense_date,
            reference=data.reference,
            created_by_email=_email(request),
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _expense_read(item)

    @get(path="/summary")
    async def summary(self, db_session: AsyncSession) -> BusinessSummary:
        client_count = int(
            (
                await db_session.scalar(
                    select(func.count()).select_from(Client).where(Client.is_active.is_(True))
                )
            )
            or 0
        )
        supplier_count = int(
            (
                await db_session.scalar(
                    select(func.count()).select_from(Supplier).where(Supplier.is_active.is_(True))
                )
            )
            or 0
        )
        open_quotes = int(
            (
                await db_session.scalar(
                    select(func.count())
                    .select_from(Quotation)
                    .where(Quotation.status.in_(["draft", "sent"]))
                )
            )
            or 0
        )
        outstanding = await db_session.scalar(
            select(func.coalesce(func.sum(Invoice.amount_ugx - Invoice.paid_amount_ugx), 0)).where(
                Invoice.status != "cancelled"
            )
        )
        expenses = await db_session.scalar(
            select(func.coalesce(func.sum(Expense.amount_ugx), 0)).where(
                Expense.expense_date <= datetime.now(UTC).date()
            )
        )
        return BusinessSummary(
            clients=client_count,
            suppliers=supplier_count,
            quotations_open=open_quotes,
            invoice_outstanding_ugx=float(outstanding or 0),
            expenses_ugx=float(expenses or 0),
        )
