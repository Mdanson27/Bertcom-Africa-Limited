from __future__ import annotations

import uuid
from typing import Any, ClassVar

from litestar import Controller, Request, Response, get, post
from litestar.exceptions import ClientException, NotFoundException
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.business.document_service import (
    client_statement_pdf,
    ensure_invoice_document,
    ensure_purchase_order_document,
    ensure_quotation_document,
    ensure_receipt_document,
    supplier_statement_pdf,
)
from app.domain.business.models import (
    Client,
    Invoice,
    InvoiceLineItem,
    Payment,
    PurchaseOrder,
    Quotation,
    QuotationLineItem,
    Supplier,
)
from app.domain.business.schemas import CommercialDocumentRead, InvoiceRead, QuotationConvertRequest
from app.domain.business.services import (
    line_items_read,
    load_line_items,
    next_business_number,
    replace_line_items,
    upsert_generated_document,
)
from app.presentation.guards.auth_guard import JWTAuthGuard


def _email(request: Request) -> str:
    email = str(request.scope.get("email") or "").strip().lower()
    if not email:
        raise ClientException(detail="Authenticated email is required.", status_code=401)
    return email


def _pdf_response(pdf: bytes, filename: str) -> Response[bytes]:
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _invoice_read(item: Invoice, line_items) -> InvoiceRead:
    amount = float(item.amount_ugx or 0)
    paid = float(item.paid_amount_ugx or 0)
    status = item.status
    if amount > 0 and paid >= amount:
        status = "paid"
    elif paid > 0 and status != "overdue":
        status = "partially_paid"
    return InvoiceRead(
        id=item.id,
        invoice_number=item.invoice_number,
        client_id=item.client_id,
        project_id=item.project_id,
        client_name=item.client_name,
        amount_ugx=amount,
        paid_amount_ugx=paid,
        outstanding_amount_ugx=max(0.0, amount - paid),
        status=status,
        issue_date=item.issue_date,
        due_date=item.due_date,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
        source_quotation_id=item.source_quotation_id,
        items=line_items_read(line_items),
    )


class CommercialDocumentsController(Controller):
    path = "/business"
    guards: ClassVar[list[Any]] = [JWTAuthGuard()]

    @post(path="/quotations/{quotation_id:uuid}/convert-to-invoice", status_code=HTTP_201_CREATED)
    async def convert_quotation_to_invoice(
        self,
        request: Request,
        quotation_id: uuid.UUID,
        data: QuotationConvertRequest,
        db_session: AsyncSession,
    ) -> InvoiceRead:
        quotation = await db_session.get(Quotation, quotation_id)
        if quotation is None:
            raise NotFoundException(detail="Quotation not found.")
        if quotation.status != "accepted":
            raise ClientException(
                detail="Only an accepted quotation can be converted to an invoice.", status_code=409
            )
        existing = (
            await db_session.execute(
                select(Invoice).where(Invoice.source_quotation_id == quotation.id)
            )
        ).scalar_one_or_none()
        if existing is not None:
            lines = await load_line_items(db_session, InvoiceLineItem, "invoice_id", existing.id)
            return _invoice_read(existing, lines)
        quote_lines = await load_line_items(
            db_session, QuotationLineItem, "quotation_id", quotation.id
        )
        if not quote_lines:
            raise ClientException(detail="Quotation has no billable line items.", status_code=409)
        invoice_number = await next_business_number(db_session, "invoice", data.issue_date)
        invoice = Invoice(
            invoice_number=invoice_number,
            client_id=quotation.client_id,
            project_id=quotation.project_id,
            source_quotation_id=quotation.id,
            client_name=quotation.client_name,
            amount_ugx=quotation.amount_ugx,
            paid_amount_ugx=0,
            status="draft",
            issue_date=data.issue_date,
            due_date=data.due_date,
            notes=data.notes or quotation.notes,
            created_by_email=_email(request),
        )
        db_session.add(invoice)
        await db_session.flush()
        normalized = [(x.description, x.quantity, x.unit_price_ugx) for x in quote_lines]
        await replace_line_items(db_session, InvoiceLineItem, "invoice_id", invoice.id, normalized)
        await db_session.commit()
        await db_session.refresh(invoice)
        lines = await load_line_items(db_session, InvoiceLineItem, "invoice_id", invoice.id)
        await ensure_invoice_document(db_session, invoice, _email(request))
        await db_session.commit()
        return _invoice_read(invoice, lines)

    async def _quotation_document(
        self, request: Request, quotation_id: uuid.UUID, db_session: AsyncSession
    ):
        item = await db_session.get(Quotation, quotation_id)
        if item is None:
            raise NotFoundException(detail="Quotation not found.")
        result = await ensure_quotation_document(db_session, item, _email(request))
        await db_session.commit()
        return item, result

    @post(path="/quotations/{quotation_id:uuid}/document")
    async def generate_quotation_document(
        self, request: Request, quotation_id: uuid.UUID, db_session: AsyncSession
    ) -> CommercialDocumentRead:
        item, (_, doc, url, filename) = await self._quotation_document(
            request, quotation_id, db_session
        )
        return CommercialDocumentRead(
            document_id=doc.id if doc else None,
            document_number=item.quotation_number,
            filename=filename,
            download_url=url,
            stored=doc is not None,
        )

    @get(path="/quotations/{quotation_id:uuid}/pdf")
    async def quotation_pdf_download(
        self, request: Request, quotation_id: uuid.UUID, db_session: AsyncSession
    ) -> Response[bytes]:
        _, (pdf, _, _, filename) = await self._quotation_document(request, quotation_id, db_session)
        return _pdf_response(pdf, filename)

    async def _invoice_document(
        self, request: Request, invoice_id: uuid.UUID, db_session: AsyncSession
    ):
        item = await db_session.get(Invoice, invoice_id)
        if item is None:
            raise NotFoundException(detail="Invoice not found.")
        result = await ensure_invoice_document(db_session, item, _email(request))
        await db_session.commit()
        return item, result

    @post(path="/invoices/{invoice_id:uuid}/document")
    async def generate_invoice_document(
        self, request: Request, invoice_id: uuid.UUID, db_session: AsyncSession
    ) -> CommercialDocumentRead:
        item, (_, doc, url, filename) = await self._invoice_document(
            request, invoice_id, db_session
        )
        return CommercialDocumentRead(
            document_id=doc.id if doc else None,
            document_number=item.invoice_number,
            filename=filename,
            download_url=url,
            stored=doc is not None,
        )

    @get(path="/invoices/{invoice_id:uuid}/pdf")
    async def invoice_pdf_download(
        self, request: Request, invoice_id: uuid.UUID, db_session: AsyncSession
    ) -> Response[bytes]:
        _, (pdf, _, _, filename) = await self._invoice_document(request, invoice_id, db_session)
        return _pdf_response(pdf, filename)

    async def _receipt_document(
        self, request: Request, payment_id: uuid.UUID, db_session: AsyncSession
    ):
        item = await db_session.get(Payment, payment_id)
        if item is None:
            raise NotFoundException(detail="Receipt/payment not found.")
        result = await ensure_receipt_document(db_session, item, _email(request))
        await db_session.commit()
        return item, result

    @post(path="/receipts/{payment_id:uuid}/document")
    async def generate_receipt_document(
        self, request: Request, payment_id: uuid.UUID, db_session: AsyncSession
    ) -> CommercialDocumentRead:
        item, (_, doc, url, filename) = await self._receipt_document(
            request, payment_id, db_session
        )
        number = item.receipt_number or filename.removesuffix(".pdf")
        return CommercialDocumentRead(
            document_id=doc.id if doc else None,
            document_number=number,
            filename=filename,
            download_url=url,
            stored=doc is not None,
        )

    @get(path="/receipts/{payment_id:uuid}/pdf")
    async def receipt_pdf_download(
        self, request: Request, payment_id: uuid.UUID, db_session: AsyncSession
    ) -> Response[bytes]:
        _, (pdf, _, _, filename) = await self._receipt_document(request, payment_id, db_session)
        return _pdf_response(pdf, filename)

    async def _po_document(
        self, request: Request, purchase_order_id: uuid.UUID, db_session: AsyncSession
    ):
        item = await db_session.get(PurchaseOrder, purchase_order_id)
        if item is None:
            raise NotFoundException(detail="Purchase order not found.")
        result = await ensure_purchase_order_document(db_session, item, _email(request))
        await db_session.commit()
        return item, result

    @post(path="/purchase-orders/{purchase_order_id:uuid}/document")
    async def generate_purchase_order_document(
        self, request: Request, purchase_order_id: uuid.UUID, db_session: AsyncSession
    ) -> CommercialDocumentRead:
        item, (_, doc, url, filename) = await self._po_document(
            request, purchase_order_id, db_session
        )
        return CommercialDocumentRead(
            document_id=doc.id if doc else None,
            document_number=item.po_number,
            filename=filename,
            download_url=url,
            stored=doc is not None,
        )

    @get(path="/purchase-orders/{purchase_order_id:uuid}/pdf")
    async def purchase_order_pdf_download(
        self, request: Request, purchase_order_id: uuid.UUID, db_session: AsyncSession
    ) -> Response[bytes]:
        _, (pdf, _, _, filename) = await self._po_document(request, purchase_order_id, db_session)
        return _pdf_response(pdf, filename)

    @post(path="/clients/{client_id:uuid}/statement/document")
    async def generate_client_statement_document(
        self, request: Request, client_id: uuid.UUID, db_session: AsyncSession
    ) -> CommercialDocumentRead:
        client = await db_session.get(Client, client_id)
        if client is None:
            raise NotFoundException(detail="Client not found.")
        pdf = await client_statement_pdf(db_session, client)
        number = f"CLIENT-STMT-{client.id.hex[:8].upper()}"
        filename = f"{number}.pdf"
        doc, url = await upsert_generated_document(
            db_session,
            pdf_bytes=pdf,
            title=f"Client Statement - {client.name}",
            filename=filename,
            uploaded_by_email=_email(request),
            related_record_type="client_statement",
            related_record_id=client.id,
            client_id=client.id,
        )
        await db_session.commit()
        return CommercialDocumentRead(
            document_id=doc.id if doc else None,
            document_number=number,
            filename=filename,
            download_url=url,
            stored=doc is not None,
        )

    @get(path="/clients/{client_id:uuid}/statement/pdf")
    async def client_statement_pdf_download(
        self, client_id: uuid.UUID, db_session: AsyncSession
    ) -> Response[bytes]:
        client = await db_session.get(Client, client_id)
        if client is None:
            raise NotFoundException(detail="Client not found.")
        pdf = await client_statement_pdf(db_session, client)
        return _pdf_response(pdf, f"CLIENT-STMT-{client.id.hex[:8].upper()}.pdf")

    @post(path="/suppliers/{supplier_id:uuid}/statement/document")
    async def generate_supplier_statement_document(
        self, request: Request, supplier_id: uuid.UUID, db_session: AsyncSession
    ) -> CommercialDocumentRead:
        supplier = await db_session.get(Supplier, supplier_id)
        if supplier is None:
            raise NotFoundException(detail="Supplier not found.")
        pdf = await supplier_statement_pdf(db_session, supplier)
        number = f"SUPPLIER-SUM-{supplier.id.hex[:8].upper()}"
        filename = f"{number}.pdf"
        doc, url = await upsert_generated_document(
            db_session,
            pdf_bytes=pdf,
            title=f"Supplier Purchase Summary - {supplier.name}",
            filename=filename,
            uploaded_by_email=_email(request),
            related_record_type="supplier_statement",
            related_record_id=supplier.id,
            supplier_id=supplier.id,
        )
        await db_session.commit()
        return CommercialDocumentRead(
            document_id=doc.id if doc else None,
            document_number=number,
            filename=filename,
            download_url=url,
            stored=doc is not None,
        )

    @get(path="/suppliers/{supplier_id:uuid}/statement/pdf")
    async def supplier_statement_pdf_download(
        self, supplier_id: uuid.UUID, db_session: AsyncSession
    ) -> Response[bytes]:
        supplier = await db_session.get(Supplier, supplier_id)
        if supplier is None:
            raise NotFoundException(detail="Supplier not found.")
        pdf = await supplier_statement_pdf(db_session, supplier)
        return _pdf_response(pdf, f"SUPPLIER-SUM-{supplier.id.hex[:8].upper()}.pdf")
