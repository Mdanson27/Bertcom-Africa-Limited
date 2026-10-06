"""Step 2 commercial workflow and PDF document generation coverage."""

import re
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestBusinessDocumentsWorkflow:
    async def test_quote_to_invoice_payment_receipt_and_pdf_chain(
        self, async_client: AsyncClient, registered_user: dict
    ) -> None:
        suffix = uuid.uuid4().hex[:8]
        headers = {"Authorization": f"Bearer {registered_user['token']}"}

        client_res = await async_client.post(
            "/api/v1/business/clients",
            headers=headers,
            json={"name": f"Step 2 Client {suffix}", "email": f"client.{suffix}@example.com"},
        )
        assert client_res.status_code == 201, client_res.text
        client = client_res.json()

        supplier_res = await async_client.post(
            "/api/v1/business/suppliers",
            headers=headers,
            json={"name": f"Step 2 Supplier {suffix}", "email": f"supplier.{suffix}@example.com"},
        )
        assert supplier_res.status_code == 201, supplier_res.text
        supplier = supplier_res.json()

        project_res = await async_client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": f"Commercial Project {suffix}",
                "client_id": client["id"],
                "client_name": client["name"],
                "status": "active",
                "value_ugx": 5_000_000,
            },
        )
        assert project_res.status_code == 201, project_res.text
        project = project_res.json()

        quote_res = await async_client.post(
            "/api/v1/business/quotations",
            headers=headers,
            json={
                "quotation_number": "AUTO",
                "client_id": client["id"],
                "client_name": client["name"],
                "project_id": project["id"],
                "amount_ugx": 0,
                "status": "draft",
                "issue_date": "2026-10-06",
                "valid_until": "2026-10-20",
                "items": [
                    {
                        "description": "Supply of equipment",
                        "quantity": 2,
                        "unit_price_ugx": 750_000,
                    },
                    {
                        "description": "Installation service",
                        "quantity": 1,
                        "unit_price_ugx": 500_000,
                    },
                ],
            },
        )
        assert quote_res.status_code == 201, quote_res.text
        quote = quote_res.json()
        assert re.fullmatch(r"QTN-2026-\d{4}", quote["quotation_number"])
        assert quote["amount_ugx"] == 2_000_000

        quote_pdf = await async_client.get(
            f"/api/v1/business/quotations/{quote['id']}/pdf", headers=headers
        )
        assert quote_pdf.status_code == 200, quote_pdf.text
        assert quote_pdf.headers["content-type"].startswith("application/pdf")
        assert quote_pdf.content.startswith(b"%PDF")
        assert len(quote_pdf.content) > 1000

        sent = await async_client.patch(
            f"/api/v1/business/quotations/{quote['id']}", headers=headers, json={"status": "sent"}
        )
        assert sent.status_code == 200, sent.text
        accepted = await async_client.patch(
            f"/api/v1/business/quotations/{quote['id']}",
            headers=headers,
            json={"status": "accepted"},
        )
        assert accepted.status_code == 200, accepted.text

        invalid_reopen = await async_client.patch(
            f"/api/v1/business/quotations/{quote['id']}", headers=headers, json={"status": "draft"}
        )
        assert invalid_reopen.status_code == 409

        conversion = await async_client.post(
            f"/api/v1/business/quotations/{quote['id']}/convert-to-invoice",
            headers=headers,
            json={"issue_date": "2026-10-06", "due_date": "2026-10-31"},
        )
        assert conversion.status_code == 201, conversion.text
        invoice = conversion.json()
        assert re.fullmatch(r"INV-2026-\d{4}", invoice["invoice_number"])
        assert invoice["source_quotation_id"] == quote["id"]
        assert invoice["amount_ugx"] == quote["amount_ugx"]
        assert len(invoice["items"]) == 2
        assert invoice["items"][0]["description"] == "Supply of equipment"

        duplicate_conversion = await async_client.post(
            f"/api/v1/business/quotations/{quote['id']}/convert-to-invoice",
            headers=headers,
            json={"issue_date": "2026-10-06", "due_date": "2026-10-31"},
        )
        assert duplicate_conversion.status_code == 201
        assert duplicate_conversion.json()["id"] == invoice["id"]

        invoice_pdf = await async_client.get(
            f"/api/v1/business/invoices/{invoice['id']}/pdf", headers=headers
        )
        assert invoice_pdf.status_code == 200
        assert invoice_pdf.content.startswith(b"%PDF")

        sent_invoice = await async_client.patch(
            f"/api/v1/business/invoices/{invoice['id']}", headers=headers, json={"status": "sent"}
        )
        assert sent_invoice.status_code == 200, sent_invoice.text

        payment_one = await async_client.post(
            "/api/v1/business/payments",
            headers=headers,
            json={
                "invoice_id": invoice["id"],
                "amount_ugx": 750_000,
                "payment_date": "2026-10-06",
                "method": "bank",
                "reference": f"BANK-{suffix}",
            },
        )
        assert payment_one.status_code == 201, payment_one.text
        first_payment = payment_one.json()
        assert re.fullmatch(r"RCT-2026-\d{4}", first_payment["receipt_number"])

        receipt_pdf = await async_client.get(
            f"/api/v1/business/receipts/{first_payment['id']}/pdf", headers=headers
        )
        assert receipt_pdf.status_code == 200
        assert receipt_pdf.content.startswith(b"%PDF")

        invoices = await async_client.get(
            "/api/v1/business/invoices", headers=headers, params={"client_id": client["id"]}
        )
        after_partial = next(item for item in invoices.json() if item["id"] == invoice["id"])
        assert after_partial["paid_amount_ugx"] == 750_000
        assert after_partial["outstanding_amount_ugx"] == 1_250_000
        assert after_partial["status"] == "partially_paid"

        payment_two = await async_client.post(
            "/api/v1/business/payments",
            headers=headers,
            json={
                "invoice_id": invoice["id"],
                "amount_ugx": 1_250_000,
                "payment_date": "2026-10-06",
                "method": "mobile_money",
                "reference": f"MM-{suffix}",
            },
        )
        assert payment_two.status_code == 201, payment_two.text
        second_payment = payment_two.json()
        assert second_payment["receipt_number"] != first_payment["receipt_number"]

        invoices = await async_client.get(
            "/api/v1/business/invoices", headers=headers, params={"client_id": client["id"]}
        )
        paid_invoice = next(item for item in invoices.json() if item["id"] == invoice["id"])
        assert paid_invoice["paid_amount_ugx"] == 2_000_000
        assert paid_invoice["outstanding_amount_ugx"] == 0
        assert paid_invoice["status"] == "paid"

        po_res = await async_client.post(
            "/api/v1/business/purchase-orders",
            headers=headers,
            json={
                "po_number": "AUTO",
                "supplier_id": supplier["id"],
                "supplier_name": supplier["name"],
                "project_id": project["id"],
                "amount_ugx": 0,
                "status": "draft",
                "order_date": "2026-10-06",
                "items": [{"description": "Materials", "quantity": 10, "unit_price_ugx": 35_000}],
            },
        )
        assert po_res.status_code == 201, po_res.text
        po = po_res.json()
        assert re.fullmatch(r"PO-2026-\d{4}", po["po_number"])
        assert po["amount_ugx"] == 350_000
        for status in ("issued", "received", "closed"):
            status_res = await async_client.patch(
                f"/api/v1/business/purchase-orders/{po['id']}",
                headers=headers,
                json={"status": status},
            )
            assert status_res.status_code == 200, status_res.text
        po_pdf = await async_client.get(
            f"/api/v1/business/purchase-orders/{po['id']}/pdf", headers=headers
        )
        assert po_pdf.status_code == 200
        assert po_pdf.content.startswith(b"%PDF")

        client_statement_pdf = await async_client.get(
            f"/api/v1/business/clients/{client['id']}/statement/pdf", headers=headers
        )
        assert client_statement_pdf.status_code == 200
        assert client_statement_pdf.content.startswith(b"%PDF")

        supplier_statement_pdf = await async_client.get(
            f"/api/v1/business/suppliers/{supplier['id']}/statement/pdf", headers=headers
        )
        assert supplier_statement_pdf.status_code == 200
        assert supplier_statement_pdf.content.startswith(b"%PDF")
