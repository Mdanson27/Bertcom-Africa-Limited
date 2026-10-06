from __future__ import annotations

import uuid
from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from typing import Any, TypeVar

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import presign_download, put_object_bytes, storage_configured
from app.domain.business.models import BusinessNumberCounter
from app.domain.business.schemas import CommercialLineItemRead
from app.domain.workspace.models import Document

T = TypeVar("T")

PREFIXES = {
    "quotation": "QTN",
    "invoice": "INV",
    "receipt": "RCT",
    "purchase_order": "PO",
}


def _decimal(value: float | Decimal) -> Decimal:
    return Decimal(str(value or 0))


def normalize_line_items(
    items: Iterable[Any],
    *,
    fallback_amount: float | Decimal = 0,
    fallback_description: str,
) -> tuple[list[tuple[str, Decimal, Decimal]], Decimal]:
    normalized: list[tuple[str, Decimal, Decimal]] = []
    for raw in items:
        description = str(raw.description or "").strip()
        quantity = _decimal(raw.quantity)
        unit_price = _decimal(raw.unit_price_ugx)
        if not description:
            raise ValueError("Each line item needs a description.")
        if quantity <= 0:
            raise ValueError("Line item quantity must be greater than zero.")
        if unit_price < 0:
            raise ValueError("Line item unit price cannot be negative.")
        normalized.append((description, quantity, unit_price))
    if not normalized and _decimal(fallback_amount) > 0:
        normalized.append((fallback_description, Decimal(1), _decimal(fallback_amount)))
    if not normalized:
        raise ValueError("At least one line item is required.")
    total = sum((qty * price for _, qty, price in normalized), Decimal(0))
    return normalized, total


async def replace_line_items(
    db_session: AsyncSession,
    model: type[T],
    fk_name: str,
    record_id: uuid.UUID,
    items: list[tuple[str, Decimal, Decimal]],
) -> None:
    fk_col = getattr(model, fk_name)
    await db_session.execute(delete(model).where(fk_col == record_id))
    for position, (description, quantity, unit_price) in enumerate(items, start=1):
        db_session.add(
            model(
                **{
                    fk_name: record_id,
                    "position": position,
                    "description": description,
                    "quantity": quantity,
                    "unit_price_ugx": unit_price,
                }
            )
        )


async def load_line_items(
    db_session: AsyncSession,
    model: type[T],
    fk_name: str,
    record_id: uuid.UUID,
) -> list[T]:
    fk_col = getattr(model, fk_name)
    position_col = model.position
    return list(
        (await db_session.execute(select(model).where(fk_col == record_id).order_by(position_col)))
        .scalars()
        .all()
    )


def line_items_read(items: Iterable[Any]) -> list[CommercialLineItemRead]:
    return [
        CommercialLineItemRead(
            id=item.id,
            position=item.position,
            description=item.description,
            quantity=float(item.quantity or 0),
            unit_price_ugx=float(item.unit_price_ugx or 0),
            amount_ugx=float((item.quantity or Decimal()) * (item.unit_price_ugx or Decimal())),
        )
        for item in items
    ]


async def next_business_number(
    db_session: AsyncSession,
    document_type: str,
    when: date,
) -> str:
    if document_type not in PREFIXES:
        raise ValueError(f"Unsupported business document type: {document_type}")
    year = when.year
    lock_key = f"bertcom-business-number:{document_type}:{year}"
    await db_session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": lock_key}
    )
    counter = (
        await db_session.execute(
            select(BusinessNumberCounter).where(
                BusinessNumberCounter.document_type == document_type,
                BusinessNumberCounter.year == year,
            )
        )
    ).scalar_one_or_none()
    if counter is None:
        counter = BusinessNumberCounter(document_type=document_type, year=year, last_value=0)
        db_session.add(counter)
        await db_session.flush()
    counter.last_value += 1
    await db_session.flush()
    return f"{PREFIXES[document_type]}-{year}-{counter.last_value:04d}"


async def upsert_generated_document(
    db_session: AsyncSession,
    *,
    pdf_bytes: bytes,
    title: str,
    filename: str,
    uploaded_by_email: str,
    related_record_type: str,
    related_record_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    supplier_id: uuid.UUID | None = None,
) -> tuple[Document | None, str | None]:
    if not storage_configured():
        return None, None
    storage_key = f"documents/generated/{related_record_type}/{related_record_id}.pdf"
    put_object_bytes(storage_key, pdf_bytes, "application/pdf")
    document = (
        await db_session.execute(
            select(Document).where(
                Document.related_record_type == related_record_type,
                Document.related_record_id == related_record_id,
                Document.category == "generated_commercial",
            )
        )
    ).scalar_one_or_none()
    if document is None:
        document = Document(
            project_id=project_id,
            client_id=client_id,
            supplier_id=supplier_id,
            title=title,
            original_filename=filename,
            category="generated_commercial",
            content_type="application/pdf",
            size_bytes=len(pdf_bytes),
            storage_key=storage_key,
            uploaded_by_email=uploaded_by_email,
            ocr_status="not_requested",
            review_status="not_reviewed",
            related_record_type=related_record_type,
            related_record_id=related_record_id,
        )
        db_session.add(document)
    else:
        document.project_id = project_id
        document.client_id = client_id
        document.supplier_id = supplier_id
        document.title = title
        document.original_filename = filename
        document.size_bytes = len(pdf_bytes)
        document.storage_key = storage_key
        document.uploaded_by_email = uploaded_by_email
    await db_session.flush()
    return document, presign_download(storage_key)
