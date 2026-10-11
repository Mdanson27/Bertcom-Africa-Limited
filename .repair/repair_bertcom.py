from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing expected block: {label}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Auth: keep production Neon-only, allow local HS256 tokens only outside prod.
# ---------------------------------------------------------------------------
p = ROOT / "backend/src/app/presentation/guards/auth_guard.py"
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    "from __future__ import annotations\n\nfrom litestar.connection import ASGIConnection",
    "from __future__ import annotations\n\nimport jwt\nfrom litestar.connection import ASGIConnection",
    "auth import",
)
s = replace_once(
    s,
    '''        # Decode & validate JWT. Neon JWKS lookup runs in a worker thread and\n        # reuses its key cache so a burst of dashboard requests cannot block\n        # the ASGI event loop or repeatedly refetch the same signing keys.\n        try:\n            payload = (\n                await decode_neon_access_token_async(token)\n                if settings.NEON_AUTH_JWKS_URL\n                else decode_access_token(token)\n            )\n        except Exception as exc:\n            raise NotAuthorizedException("Invalid or expired session token.") from exc\n''',
    '''        # Decode & validate JWT. Production is Neon-only when managed auth is\n        # configured. Development/test may also accept Bertcom's locally-issued\n        # HS256 token so the built-in local login and API test harness remain\n        # usable without weakening the production trust boundary.\n        token_is_neon = False\n        try:\n            if settings.NEON_AUTH_JWKS_URL:\n                environment = settings.ENVIRONMENT.lower()\n                algorithm = str(jwt.get_unverified_header(token).get("alg") or "").upper()\n                if environment != "production" and algorithm == "HS256":\n                    payload = decode_access_token(token)\n                else:\n                    payload = await decode_neon_access_token_async(token)\n                    token_is_neon = True\n            else:\n                payload = decode_access_token(token)\n        except Exception as exc:\n            raise NotAuthorizedException("Invalid or expired session token.") from exc\n''',
    "auth token decoder",
)
s = replace_once(
    s,
    '''        # Managed Neon Auth is intentionally email-locked to the configured\n        # AutoMinds platform administrator. Legacy local JWTs continue to honor\n        # the explicit is_superuser claim only when Neon Auth is not configured.\n        is_super: bool = (\n            bool(email and email == settings.platform_admin_email)\n            if settings.NEON_AUTH_JWKS_URL\n            else bool(payload.get("is_superuser", False))\n        )\n''',
    '''        # Managed Neon Auth is intentionally email-locked to the configured\n        # AutoMinds platform administrator. Local HS256 tokens are accepted only\n        # outside production and honor their explicit is_superuser claim.\n        is_super: bool = (\n            bool(email and email == settings.platform_admin_email)\n            if token_is_neon\n            else bool(payload.get("is_superuser", False))\n        )\n''',
    "auth superuser mapping",
)
p.write_text(s, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Business document state: source edits invalidate the archived current PDF.
# ---------------------------------------------------------------------------
p = ROOT / "backend/src/app/domain/business/services.py"
s = p.read_text(encoding="utf-8")
needle = "async def upsert_generated_document(\n"
insert = '''async def invalidate_current_generated_document(\n    db_session: AsyncSession, related_record_type: str, related_record_id: uuid.UUID\n) -> Document | None:\n    """Mark the current generated PDF stale when its source record changes.\n\n    The business record remains authoritative. A fresh PDF is created only when\n    the user explicitly previews/generates it, preventing storage failures from\n    breaking ordinary business saves and preventing stale PDFs from being sent.\n    """\n    current = await current_generated_document(db_session, related_record_type, related_record_id)\n    if current is not None:\n        current.is_current = False\n        await db_session.flush()\n    return current\n\n\n'''
if "async def invalidate_current_generated_document" not in s:
    if needle not in s:
        raise RuntimeError("Missing services insertion point")
    s = s.replace(needle, insert + needle, 1)
p.write_text(s, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Business writes: commit business/accounting atomically, never wait on S3/PDF.
# ---------------------------------------------------------------------------
p = ROOT / "backend/src/app/presentation/api/v1/business_controller.py"
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''from app.domain.business.document_service import (\n    ensure_invoice_document,\n    ensure_purchase_order_document,\n    ensure_quotation_document,\n    ensure_receipt_document,\n)\n''',
    "",
    "business document-service imports",
)
s = replace_once(
    s,
    '''    current_generated_document,\n    next_business_number,\n''',
    '''    current_generated_document,\n    invalidate_current_generated_document,\n    next_business_number,\n''',
    "business service import",
)
for label, old, new in [
    (
        "create quotation storage decoupling",
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        await ensure_quotation_document(db_session, item, _email(request))\n        await db_session.commit()\n        return _quotation_read(item)\n''',
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        return _quotation_read(item)\n''',
    ),
    (
        "update quotation invalidation",
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        await ensure_quotation_document(db_session, item, _email(request))\n        if item.status != previous_status:\n''',
        '''        if quotation_content_change:\n            await invalidate_current_generated_document(db_session, "quotation", item.id)\n        await db_session.commit()\n        await db_session.refresh(item)\n        if item.status != previous_status:\n''',
    ),
    (
        "create invoice atomic ledger",
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        await sync_invoice_ledger(db_session, item)\n        await ensure_invoice_document(db_session, item, _email(request))\n        await db_session.commit()\n        return _invoice_read(item)\n''',
        '''        await sync_invoice_ledger(db_session, item)\n        await db_session.commit()\n        await db_session.refresh(item)\n        return _invoice_read(item)\n''',
    ),
    (
        "update invoice atomic ledger",
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        await sync_invoice_ledger(db_session, item)\n        await ensure_invoice_document(db_session, item, _email(request))\n        if item.status != previous_status:\n''',
        '''        if invoice_content_change:\n            await invalidate_current_generated_document(db_session, "invoice", item.id)\n        await sync_invoice_ledger(db_session, item)\n        await db_session.commit()\n        await db_session.refresh(item)\n        if item.status != previous_status:\n''',
    ),
    (
        "payment atomic ledger and document invalidation",
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        await sync_payment_ledger(db_session, item)\n        if invoice is not None:\n            await sync_invoice_ledger(db_session, invoice)\n        await ensure_receipt_document(db_session, item, _email(request))\n        if invoice is not None:\n            await ensure_invoice_document(db_session, invoice, _email(request))\n            invoice_document = await current_generated_document(db_session, "invoice", invoice.id)\n            if invoice_document is not None:\n                await record_document_event(\n                    db_session,\n                    invoice_document,\n                    "paid" if invoice.status == "paid" else "payment_recorded",\n                    _email(request),\n                    {\n                        "receipt_number": item.receipt_number,\n                        "payment_id": str(item.id),\n                        "amount_ugx": float(item.amount_ugx or 0),\n                    },\n                )\n        await db_session.commit()\n        return _payment_read(item)\n''',
        '''        await db_session.flush()\n        await sync_payment_ledger(db_session, item)\n        invoice_document = None\n        if invoice is not None:\n            await sync_invoice_ledger(db_session, invoice)\n            invoice_document = await invalidate_current_generated_document(\n                db_session, "invoice", invoice.id\n            )\n            if invoice_document is not None:\n                await record_document_event(\n                    db_session,\n                    invoice_document,\n                    "paid" if invoice.status == "paid" else "payment_recorded",\n                    _email(request),\n                    {\n                        "receipt_number": item.receipt_number,\n                        "payment_id": str(item.id),\n                        "amount_ugx": float(item.amount_ugx or 0),\n                    },\n                )\n        await db_session.commit()\n        await db_session.refresh(item)\n        return _payment_read(item)\n''',
    ),
    (
        "create purchase order storage decoupling",
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        await ensure_purchase_order_document(db_session, item, _email(request))\n        await db_session.commit()\n        return _po_read(item)\n''',
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        return _po_read(item)\n''',
    ),
    (
        "update purchase order invalidation",
        '''        await db_session.commit()\n        await db_session.refresh(item)\n        await ensure_purchase_order_document(db_session, item, _email(request))\n        if item.status != previous_status:\n''',
        '''        if po_content_change:\n            await invalidate_current_generated_document(db_session, "purchase_order", item.id)\n        await db_session.commit()\n        await db_session.refresh(item)\n        if item.status != previous_status:\n''',
    ),
    (
        "expense atomic ledger",
        '''        db_session.add(item)\n        await db_session.commit()\n        await db_session.refresh(item)\n        await sync_expense_ledger(db_session, item)\n        await db_session.commit()\n        return _expense_read(item)\n''',
        '''        db_session.add(item)\n        await db_session.flush()\n        await sync_expense_ledger(db_session, item)\n        await db_session.commit()\n        await db_session.refresh(item)\n        return _expense_read(item)\n''',
    ),
]:
    s = replace_once(s, old, new, label)
p.write_text(s, encoding="utf-8", newline="\n")


# Quote -> invoice conversion must not block on document storage.
p = ROOT / "backend/src/app/presentation/api/v1/commercial_documents_controller.py"
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''        await db_session.commit()\n        await db_session.refresh(invoice)\n        lines = await load_line_items(db_session, InvoiceLineItem, "invoice_id", invoice.id)\n        await ensure_invoice_document(db_session, invoice, _email(request))\n        await db_session.commit()\n        return _invoice_read(invoice, lines)\n''',
    '''        await db_session.commit()\n        await db_session.refresh(invoice)\n        lines = await load_line_items(db_session, InvoiceLineItem, "invoice_id", invoice.id)\n        return _invoice_read(invoice, lines)\n''',
    "quote conversion storage decoupling",
)
p.write_text(s, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Regression expectations: only explicit Preview/Generate archives PDFs.
# ---------------------------------------------------------------------------
p = ROOT / "backend/tests/api/test_business_documents.py"
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''        assert len(quote_versions) >= 3\n        assert sum(1 for row in quote_versions if row["is_current"]) == 1\n        assert any(row["version"] == 1 for row in quote_versions)\n''',
    '''        # Ordinary workflow/status saves must not create extra archived PDFs.\n        # Only an explicit Preview/Generate action persists a document version.\n        assert len(quote_versions) == 1\n        assert sum(1 for row in quote_versions if row["is_current"]) == 1\n        assert quote_versions[0]["version"] == 1\n''',
    "archive version expectation",
)
s = replace_once(
    s,
    '''        # A revised accepted quotation creates another immutable version and must be previewed again\n        # before it can be shared externally.\n        revised = await async_client.patch(\n            f"/api/v1/business/quotations/{quote['id']}",\n            headers=headers,\n            json={"notes": "Revised commercial terms for archive test"},\n        )\n        assert revised.status_code == 200, revised.text\n        archive_after_revision = (\n            await async_client.get("/api/v1/business/documents", headers=headers)\n        ).json()\n        revised_versions = [\n            row\n            for row in archive_after_revision\n            if row["related_record_type"] == "quotation" and row["related_record_id"] == quote["id"]\n        ]\n        assert max(row["version"] for row in revised_versions) > current_quote_doc["version"]\n        revised_current = next(row for row in revised_versions if row["is_current"])\n        blocked_share = await async_client.post(\n            f"/api/v1/business/documents/{revised_current['id']}/share", headers=headers\n        )\n        assert blocked_share.status_code == 409\n        revised_preview = await async_client.post(\n            f"/api/v1/business/quotations/{quote['id']}/preview", headers=headers\n        )\n        assert revised_preview.status_code in {200, 201}\n        shared = await async_client.post(\n            f"/api/v1/business/documents/{revised_current['id']}/share", headers=headers\n        )\n        assert shared.status_code in {200, 201}, shared.text\n        assert shared.json()["download_url"].startswith("https://storage.test/")\n''',
    '''        # Editing source content invalidates the old archived PDF immediately, but does\n        # not regenerate during the save request. Explicit Preview creates the next\n        # immutable version and marks that exact version as reviewed.\n        revised = await async_client.patch(\n            f"/api/v1/business/quotations/{quote['id']}",\n            headers=headers,\n            json={"notes": "Revised commercial terms for archive test"},\n        )\n        assert revised.status_code == 200, revised.text\n        archive_after_revision = (\n            await async_client.get("/api/v1/business/documents", headers=headers)\n        ).json()\n        revised_versions = [\n            row\n            for row in archive_after_revision\n            if row["related_record_type"] == "quotation" and row["related_record_id"] == quote["id"]\n        ]\n        assert len(revised_versions) == 1\n        assert all(not row["is_current"] for row in revised_versions)\n\n        revised_preview = await async_client.post(\n            f"/api/v1/business/quotations/{quote['id']}/preview", headers=headers\n        )\n        assert revised_preview.status_code in {200, 201}\n        revised_document_id = revised_preview.json()["document_id"]\n        assert revised_document_id\n        archive_after_preview = (\n            await async_client.get("/api/v1/business/documents", headers=headers)\n        ).json()\n        revised_versions = [\n            row\n            for row in archive_after_preview\n            if row["related_record_type"] == "quotation" and row["related_record_id"] == quote["id"]\n        ]\n        assert max(row["version"] for row in revised_versions) > current_quote_doc["version"]\n        revised_current = next(row for row in revised_versions if row["is_current"])\n        assert revised_current["id"] == revised_document_id\n        shared = await async_client.post(\n            f"/api/v1/business/documents/{revised_current['id']}/share", headers=headers\n        )\n        assert shared.status_code in {200, 201}, shared.text\n        assert shared.json()["download_url"].startswith("https://storage.test/")\n''',
    "revised document expectation",
)
p.write_text(s, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Frontend API: direct authenticated PDF streams for immediate display.
# ---------------------------------------------------------------------------
p = ROOT / "frontend/src/lib/businessApi.ts"
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    'import { apiRequest } from "@/lib/api";',
    'import { apiRequest, authenticatedFetch, getApiBaseUrl } from "@/lib/api";',
    "business api import",
)
s = replace_once(
    s,
    '''const request = apiRequest;\n\n''',
    '''const request = apiRequest;\n\nconst pdfBlobUrl = async (path: string): Promise<string> => {\n  const response = await authenticatedFetch(`${getApiBaseUrl()}/api/v1${path}`, {\n    headers: { Accept: "application/pdf" },\n  });\n  if (!response.ok) throw new Error("The PDF stream is temporarily unavailable.");\n  return URL.createObjectURL(await response.blob());\n};\n\n''',
    "pdf blob helper",
)
for label, old, new in [
    (
        "quotation pdf helper",
        '''  previewQuotation: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/quotations/${id}/preview`, { method: "POST" }),\n''',
        '''  previewQuotation: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/quotations/${id}/preview`, { method: "POST" }),\n  quotationPdf: (id: string) => pdfBlobUrl(`/business/quotations/${id}/pdf`),\n''',
    ),
    (
        "invoice pdf helper",
        '''  previewInvoice: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/invoices/${id}/preview`, { method: "POST" }),\n''',
        '''  previewInvoice: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/invoices/${id}/preview`, { method: "POST" }),\n  invoicePdf: (id: string) => pdfBlobUrl(`/business/invoices/${id}/pdf`),\n''',
    ),
    (
        "receipt pdf helper",
        '''  previewReceipt: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/receipts/${id}/preview`, { method: "POST" }),\n''',
        '''  previewReceipt: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/receipts/${id}/preview`, { method: "POST" }),\n  receiptPdf: (id: string) => pdfBlobUrl(`/business/receipts/${id}/pdf`),\n''',
    ),
    (
        "purchase order pdf helper",
        '''  previewPurchaseOrder: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/purchase-orders/${id}/preview`, { method: "POST" }),\n''',
        '''  previewPurchaseOrder: (id: string) =>\n    request<CommercialDocumentRecord>(`/business/purchase-orders/${id}/preview`, { method: "POST" }),\n  purchaseOrderPdf: (id: string) => pdfBlobUrl(`/business/purchase-orders/${id}/pdf`),\n''',
    ),
]:
    s = replace_once(s, old, new, label)
p.write_text(s, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Frontend UX: stream preview first, persist exact reviewed copy in background.
# ---------------------------------------------------------------------------
p = ROOT / "frontend/src/pages/BusinessPage.tsx"
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''  const [preview, setPreview] = useState<{ url: string; title: string; filename: string } | null>(null);\n''',
    '''  const [preview, setPreview] = useState<{ url: string; title: string; filename: string } | null>(null);\n  const [finalizingPreviewId, setFinalizingPreviewId] = useState<string | null>(null);\n''',
    "preview finalization state",
)
s = replace_once(
    s,
    '''  const previewDocument = async (\n    loader: () => Promise<{ download_url: string | null; filename: string; document_id?: string | null }>,\n    title: string,\n  ) => {\n    try {\n      const document = await loader();\n      if (!document.download_url) {\n        throw new Error("Document storage is not configured, so the saved PDF cannot be previewed.");\n      }\n      setPreview({ url: document.download_url, title, filename: document.filename });\n    } catch (error) {\n      showErrorToast(getErrorMessage(error, "The PDF preview could not be opened."));\n    }\n  };\n''',
    '''  const closePreview = () => {\n    setPreview((current) => {\n      if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url);\n      return null;\n    });\n  };\n\n  const previewDocument = async (\n    recordId: string,\n    pdfLoader: () => Promise<string>,\n    archiveLoader: () => Promise<{ document_id?: string | null }>,\n    title: string,\n    filename: string,\n  ) => {\n    try {\n      const url = await pdfLoader();\n      setPreview((current) => {\n        if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url);\n        return { url, title, filename };\n      });\n      setFinalizingPreviewId(recordId);\n\n      void archiveLoader()\n        .then((saved) => {\n          if (!saved.document_id) {\n            throw new Error("The PDF opened, but its reviewed archive copy could not be saved.");\n          }\n          showSuccessToast("Preview ready. The reviewed PDF version has been saved.");\n        })\n        .catch((error) => {\n          showErrorToast(\n            getErrorMessage(\n              error,\n              "The PDF opened, but Bertcom could not save its reviewed copy. Preview it again before sending or issuing.",\n            ),\n          );\n        })\n        .finally(() => {\n          setFinalizingPreviewId((current) => current === recordId ? null : current);\n        });\n    } catch (error) {\n      showErrorToast(getErrorMessage(error, "The PDF preview could not be opened."));\n    }\n  };\n''',
    "fast preview helper",
)
for label, old, new in [
    (
        "quotation status finalization guard",
        '''<select className={`${selectClass} h-8 min-w-32`} value={item.status} onChange={(e) => void updateStatus("quotation", item.id, e.target.value)}>''',
        '''<select className={`${selectClass} h-8 min-w-32`} value={item.status} disabled={finalizingPreviewId === item.id} onChange={(e) => void updateStatus("quotation", item.id, e.target.value)}>''',
    ),
    (
        "quotation fast preview button",
        '''onClick={() => void previewDocument(() => businessApi.previewQuotation(item.id), `${item.quotation_number} preview`)}''',
        '''disabled={finalizingPreviewId === item.id} onClick={() => void previewDocument(item.id, () => businessApi.quotationPdf(item.id), () => businessApi.previewQuotation(item.id), `${item.quotation_number} preview`, `${item.quotation_number}.pdf`)}''',
    ),
    (
        "invoice status finalization guard",
        '''disabled={item.status === "paid" || item.status === "overdue" || item.status === "partially_paid"}''',
        '''disabled={finalizingPreviewId === item.id || item.status === "paid" || item.status === "overdue" || item.status === "partially_paid"}''',
    ),
    (
        "invoice fast preview button",
        '''onClick={() => void previewDocument(() => businessApi.previewInvoice(item.id), `${item.invoice_number} preview`)}''',
        '''disabled={finalizingPreviewId === item.id} onClick={() => void previewDocument(item.id, () => businessApi.invoicePdf(item.id), () => businessApi.previewInvoice(item.id), `${item.invoice_number} preview`, `${item.invoice_number}.pdf`)}''',
    ),
    (
        "receipt fast preview button",
        '''onClick={() => void previewDocument(() => businessApi.previewReceipt(item.id), `${item.receipt_reference} preview`)}''',
        '''disabled={finalizingPreviewId === item.id} onClick={() => void previewDocument(item.id, () => businessApi.receiptPdf(item.id), () => businessApi.previewReceipt(item.id), `${item.receipt_reference} preview`, `${item.receipt_reference}.pdf`)}''',
    ),
    (
        "purchase order status finalization guard",
        '''<select className={`${selectClass} h-8 min-w-28`} value={item.status} onChange={(e) => void updateStatus("purchase_order", item.id, e.target.value)}>''',
        '''<select className={`${selectClass} h-8 min-w-28`} value={item.status} disabled={finalizingPreviewId === item.id} onChange={(e) => void updateStatus("purchase_order", item.id, e.target.value)}>''',
    ),
    (
        "purchase order fast preview button",
        '''onClick={() => void previewDocument(() => businessApi.previewPurchaseOrder(item.id), `${item.po_number} preview`)}''',
        '''disabled={finalizingPreviewId === item.id} onClick={() => void previewDocument(item.id, () => businessApi.purchaseOrderPdf(item.id), () => businessApi.previewPurchaseOrder(item.id), `${item.po_number} preview`, `${item.po_number}.pdf`)}''',
    ),
    (
        "preview wording",
        '''Check the logo, party details, document number, dates, line items, totals, terms and status. This is the exact saved PDF version.''',
        '''Check the logo, party details, document number, dates, line items, totals, terms and status. The PDF opens immediately; Bertcom saves the reviewed archive version in the background.''',
    ),
    (
        "preview close handler",
        '''onClick={() => setPreview(null)}>Preview complete''',
        '''onClick={closePreview}>Preview complete''',
    ),
]:
    s = replace_once(s, old, new, label)
p.write_text(s, encoding="utf-8", newline="\n")

print("Bertcom reliability repair applied successfully")
