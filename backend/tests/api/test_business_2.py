"""Business 2.0 foundation integration coverage."""

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestBusiness2Foundation:
    async def test_connected_client_supplier_receipt_and_statement_workflows(
        self,
        async_client: AsyncClient,
        registered_user: dict,
    ) -> None:
        suffix = uuid.uuid4().hex[:8]
        headers = {"Authorization": f"Bearer {registered_user['token']}"}

        client_response = await async_client.post(
            "/api/v1/business/clients",
            headers=headers,
            json={
                "name": f"Business 2 Client {suffix}",
                "contact_person": "Client Contact",
                "email": f"b2.client.{suffix}@example.com",
            },
        )
        assert client_response.status_code == 201, client_response.text
        client = client_response.json()

        supplier_response = await async_client.post(
            "/api/v1/business/suppliers",
            headers=headers,
            json={
                "name": f"Business 2 Supplier {suffix}",
                "contact_person": "Supplier Contact",
                "email": f"b2.supplier.{suffix}@example.com",
            },
        )
        assert supplier_response.status_code == 201, supplier_response.text
        supplier = supplier_response.json()

        project_response = await async_client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": f"Connected Project {suffix}",
                "client_id": client["id"],
                "client_name": client["name"],
                "status": "active",
                "value_ugx": 2_000_000,
            },
        )
        assert project_response.status_code == 201, project_response.text
        project = project_response.json()
        assert project["client_id"] == client["id"]

        document_response = await async_client.post(
            "/api/v1/documents",
            headers=headers,
            json={
                "title": f"Supporting Document {suffix}",
                "original_filename": f"support-{suffix}.pdf",
                "category": "commercial",
                "content_type": "application/pdf",
                "size_bytes": 100,
                "storage_key": f"documents/testing/{suffix}.pdf",
                "project_id": project["id"],
                "client_id": client["id"],
                "supplier_id": supplier["id"],
            },
        )
        assert document_response.status_code == 201, document_response.text
        document = document_response.json()
        assert document["client_id"] == client["id"]
        assert document["supplier_id"] == supplier["id"]

        quotation_response = await async_client.post(
            "/api/v1/business/quotations",
            headers=headers,
            json={
                "quotation_number": f"Q-B2-{suffix}",
                "client_name": client["name"],
                "client_id": client["id"],
                "project_id": project["id"],
                "amount_ugx": 1_500_000,
                "status": "sent",
                "issue_date": "2026-10-05",
                "valid_until": "2026-10-20",
            },
        )
        assert quotation_response.status_code == 201, quotation_response.text
        quotation = quotation_response.json()
        assert quotation["status"] == "sent"

        quotation_update = await async_client.patch(
            f"/api/v1/business/quotations/{quotation['id']}",
            headers=headers,
            json={"status": "accepted"},
        )
        assert quotation_update.status_code == 200, quotation_update.text
        assert quotation_update.json()["status"] == "accepted"

        invoice_response = await async_client.post(
            "/api/v1/business/invoices",
            headers=headers,
            json={
                "invoice_number": f"INV-B2-{suffix}",
                "client_name": client["name"],
                "client_id": client["id"],
                "project_id": project["id"],
                "amount_ugx": 1_200_000,
                "status": "sent",
                "issue_date": "2026-10-05",
                "due_date": "2026-10-30",
            },
        )
        assert invoice_response.status_code == 201, invoice_response.text
        invoice = invoice_response.json()
        assert invoice["outstanding_amount_ugx"] == 1_200_000

        payment_response = await async_client.post(
            "/api/v1/business/payments",
            headers=headers,
            json={
                "invoice_id": invoice["id"],
                "amount_ugx": 400_000,
                "payment_date": "2026-10-05",
                "method": "bank",
                "reference": f"PAYREF-{suffix}",
            },
        )
        assert payment_response.status_code == 201, payment_response.text
        payment = payment_response.json()
        assert payment["client_id"] == client["id"]
        assert payment["project_id"] == project["id"]

        refreshed_invoice = await async_client.get(
            "/api/v1/business/invoices",
            headers=headers,
            params={"client_id": client["id"]},
        )
        assert refreshed_invoice.status_code == 200, refreshed_invoice.text
        invoice_after_payment = next(
            row for row in refreshed_invoice.json() if row["id"] == invoice["id"]
        )
        assert invoice_after_payment["paid_amount_ugx"] == 400_000
        assert invoice_after_payment["outstanding_amount_ugx"] == 800_000
        assert invoice_after_payment["status"] == "partially_paid"

        receipt_response = await async_client.get(
            "/api/v1/business/receipts",
            headers=headers,
            params={"client_id": client["id"]},
        )
        assert receipt_response.status_code == 200, receipt_response.text
        receipt = next(row for row in receipt_response.json() if row["id"] == payment["id"])
        assert receipt["invoice_number"] == invoice["invoice_number"]
        assert receipt["amount_ugx"] == 400_000

        po_response = await async_client.post(
            "/api/v1/business/purchase-orders",
            headers=headers,
            json={
                "po_number": f"PO-B2-{suffix}",
                "supplier_name": supplier["name"],
                "supplier_id": supplier["id"],
                "project_id": project["id"],
                "amount_ugx": 500_000,
                "status": "issued",
                "order_date": "2026-10-05",
            },
        )
        assert po_response.status_code == 201, po_response.text
        purchase_order = po_response.json()

        expense_response = await async_client.post(
            "/api/v1/business/expenses",
            headers=headers,
            json={
                "description": f"Supplier Expense {suffix}",
                "amount_ugx": 150_000,
                "expense_date": "2026-10-05",
                "category": "materials",
                "project_id": project["id"],
                "supplier_id": supplier["id"],
                "supporting_document_id": document["id"],
                "reference": f"EXP-{suffix}",
            },
        )
        assert expense_response.status_code == 201, expense_response.text
        expense = expense_response.json()
        assert expense["supporting_document_id"] == document["id"]

        client_workspace = await async_client.get(
            f"/api/v1/business/clients/{client['id']}/workspace",
            headers=headers,
        )
        assert client_workspace.status_code == 200, client_workspace.text
        client_body = client_workspace.json()
        assert any(row["id"] == project["id"] for row in client_body["projects"])
        assert any(row["id"] == quotation["id"] for row in client_body["quotations"])
        assert any(row["id"] == invoice["id"] for row in client_body["invoices"])
        assert any(row["id"] == payment["id"] for row in client_body["receipts"])
        assert any(row["id"] == document["id"] for row in client_body["documents"])
        assert client_body["outstanding_balance_ugx"] == 800_000
        assert client_body["activity"]

        supplier_workspace = await async_client.get(
            f"/api/v1/business/suppliers/{supplier['id']}/workspace",
            headers=headers,
        )
        assert supplier_workspace.status_code == 200, supplier_workspace.text
        supplier_body = supplier_workspace.json()
        assert any(row["id"] == project["id"] for row in supplier_body["projects"])
        assert any(row["id"] == purchase_order["id"] for row in supplier_body["purchase_orders"])
        assert any(row["id"] == expense["id"] for row in supplier_body["expenses"])
        assert any(row["id"] == document["id"] for row in supplier_body["documents"])

        statement_response = await async_client.get(
            f"/api/v1/business/clients/{client['id']}/statement",
            headers=headers,
        )
        assert statement_response.status_code == 200, statement_response.text
        statement = statement_response.json()
        assert [row["kind"] for row in statement] == ["invoice", "receipt"]
        assert statement[-1]["running_balance_ugx"] == 800_000

        summary_response = await async_client.get("/api/v1/business/summary", headers=headers)
        assert summary_response.status_code == 200, summary_response.text
        summary = summary_response.json()
        assert summary["total_clients"] >= 1
        assert summary["active_clients"] >= 1
        assert summary["total_suppliers"] >= 1
        assert summary["outstanding_invoices"] >= 1
        assert summary["receivables_ugx"] >= 800_000
        assert summary["expenses_month_ugx"] >= 150_000
        assert summary["receipts_month_ugx"] >= 400_000
