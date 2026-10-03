import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  FileText,
  Plus,
  Receipt,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageError, PageLoading } from "@/components/common/RequestState";
import { SectionNav } from "@/components/common/SectionNav";
import { useCustomToast } from "@/hooks/useCustomToast";
import { confirmDiscardChanges, useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { getErrorMessage } from "@/lib/api";
import {
  workspaceApi,
  type BusinessSummary,
  type ClientRecord,
  type ExpenseRecord,
  type InvoiceRecord,
  type PurchaseOrderRecord,
  type QuotationRecord,
  type SupplierRecord,
} from "@/lib/workspaceApi";

type BusinessView =
  | "overview"
  | "clients"
  | "suppliers"
  | "quotations"
  | "invoices"
  | "purchase_orders"
  | "expenses";
type CreateKind = "clients" | "suppliers" | "quotation" | "invoice" | "purchase_order" | "expense";

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);

const today = () => new Date().toISOString().slice(0, 10);

export const BusinessPage: React.FC = () => {
  const { showSuccessToast, showErrorToast, showWarningToast } = useCustomToast();
  const [tab, setTab] = useState<BusinessView>("overview");
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [quotes, setQuotes] = useState<QuotationRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const formDirty = Boolean(createKind) && Object.values(form).some((value) => value.trim() !== "");
  useUnsavedChanges(formDirty);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const [s, c, sp, q, i, po, e] = await Promise.all([
        workspaceApi.businessSummary(),
        workspaceApi.clients(),
        workspaceApi.suppliers(),
        workspaceApi.quotations(),
        workspaceApi.invoices(),
        workspaceApi.purchaseOrders(),
        workspaceApi.expenses(),
      ]);
      setSummary(s);
      setClients(c);
      setSuppliers(sp);
      setQuotes(q);
      setInvoices(i);
      setPurchaseOrders(po);
      setExpenses(e);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Business records could not be loaded."));
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (kind: CreateKind) => {
    const defaults: Record<string, string> = {};
    if (kind === "quotation") defaults.issue_date = today();
    if (kind === "invoice") defaults.issue_date = today();
    if (kind === "purchase_order") defaults.order_date = today();
    if (kind === "expense") defaults.expense_date = today();
    setForm(defaults);
    setCreateKind(kind);
  };

  const closeCreate = () => {
    if (saving) return;
    if (!confirmDiscardChanges(formDirty, "Discard this unsaved business record?")) return;
    setCreateKind(null);
    setForm({});
  };

  const set = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createKind || saving) return;

    const amount = Number(form.amount || 0);
    if (
      ["quotation", "invoice", "purchase_order", "expense"].includes(createKind) &&
      (!Number.isFinite(amount) || amount <= 0)
    ) {
      showWarningToast("Enter an amount greater than zero.", "Check amount");
      return;
    }

    if ((createKind === "clients" || createKind === "suppliers") && !form.name?.trim()) {
      showWarningToast("Name is required.", "Check details");
      return;
    }

    if (
      (createKind === "quotation" || createKind === "invoice") &&
      (!form.number?.trim() || !form.client_name?.trim())
    ) {
      showWarningToast("Document number and client are required.", "Check details");
      return;
    }

    if (
      createKind === "purchase_order" &&
      (!form.number?.trim() || !form.supplier_name?.trim())
    ) {
      showWarningToast("Purchase order number and supplier are required.", "Check details");
      return;
    }

    if (createKind === "expense" && !form.description?.trim()) {
      showWarningToast("Add a short expense description.", "Check details");
      return;
    }

    setSaving(true);
    try {
      if (createKind === "clients") {
        await workspaceApi.createClient({
          name: form.name.trim(),
          contact_person: form.contact_person?.trim() || null,
          phone: form.phone?.trim() || null,
          email: form.email?.trim() || null,
        });
      } else if (createKind === "suppliers") {
        await workspaceApi.createSupplier({
          name: form.name.trim(),
          contact_person: form.contact_person?.trim() || null,
          phone: form.phone?.trim() || null,
          email: form.email?.trim() || null,
        });
      } else if (createKind === "quotation") {
        await workspaceApi.createQuotation({
          quotation_number: form.number.trim(),
          client_name: form.client_name.trim(),
          amount_ugx: amount,
          issue_date: form.issue_date || today(),
          valid_until: form.valid_until || null,
          status: "draft",
        });
      } else if (createKind === "invoice") {
        await workspaceApi.createInvoice({
          invoice_number: form.number.trim(),
          client_name: form.client_name.trim(),
          amount_ugx: amount,
          paid_amount_ugx: Number(form.paid_amount || 0),
          issue_date: form.issue_date || today(),
          due_date: form.due_date || null,
          status: "draft",
        });
      } else if (createKind === "purchase_order") {
        await workspaceApi.createPurchaseOrder({
          po_number: form.number.trim(),
          supplier_name: form.supplier_name.trim(),
          amount_ugx: amount,
          order_date: form.order_date || today(),
          expected_date: form.expected_date || null,
          status: "draft",
        });
      } else if (createKind === "expense") {
        await workspaceApi.createExpense({
          description: form.description.trim(),
          amount_ugx: amount,
          expense_date: form.expense_date || today(),
          category: form.category?.trim() || "general",
          reference: form.reference?.trim() || null,
        });
      }

      const savedKind = createKind;
      setCreateKind(null);
      setForm({});
      await load(false);
      showSuccessToast(
        savedKind === "expense" ? "Expense recorded successfully." : "Business record saved successfully.",
        "Saved",
      );
    } catch (error) {
      showErrorToast(
        getErrorMessage(error, "The business record could not be saved."),
        "Not saved",
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "clients" as const, label: "Clients", count: clients.length },
    { id: "suppliers" as const, label: "Suppliers", count: suppliers.length },
    { id: "quotations" as const, label: "Quotations", count: quotes.length },
    { id: "invoices" as const, label: "Invoices", count: invoices.length },
    { id: "purchase_orders" as const, label: "Purchase Orders", count: purchaseOrders.length },
    { id: "expenses" as const, label: "Expenses", count: expenses.length },
  ];

  const outstanding = summary?.invoice_outstanding_ugx ?? 0;

  const createAction = useMemo(() => {
    if (tab === "clients") return { kind: "clients" as const, label: "New client" };
    if (tab === "suppliers") return { kind: "suppliers" as const, label: "New supplier" };
    if (tab === "quotations") return { kind: "quotation" as const, label: "New quotation" };
    if (tab === "invoices") return { kind: "invoice" as const, label: "New invoice" };
    if (tab === "purchase_orders") return { kind: "purchase_order" as const, label: "New purchase order" };
    if (tab === "expenses") return { kind: "expense" as const, label: "Add expense" };
    return null;
  }, [tab]);

  const simpleRows =
    tab === "clients"
      ? clients.map((item) => ({
          id: item.id,
          title: item.name,
          note: item.contact_person || item.email || item.phone || "Client",
        }))
      : tab === "suppliers"
        ? suppliers.map((item) => ({
            id: item.id,
            title: item.name,
            note: item.contact_person || item.email || item.phone || "Supplier",
          }))
        : [];

  if (isLoading) {
    return <PageLoading label="Loading business records..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={loadError}
        onRetry={() => load()}
        title="Business is temporarily unavailable"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Business</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clients, sales, purchases and expenses without accounting complexity.
          </p>
        </div>
        {createAction && (
          <Button className="gap-2" onClick={() => openCreate(createAction.kind)}>
            <Plus className="h-4 w-4" /> {createAction.label}
          </Button>
        )}
      </div>

      <SectionNav
        items={tabs}
        active={tab}
        onChange={setTab}
        ariaLabel="Business sections"
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Card><p className="text-xs text-muted-foreground">Clients</p><p className="mt-2 text-2xl font-bold">{summary?.clients ?? 0}</p></Card>
            <Card><p className="text-xs text-muted-foreground">Suppliers</p><p className="mt-2 text-2xl font-bold">{summary?.suppliers ?? 0}</p></Card>
            <Card><p className="text-xs text-muted-foreground">Open quotations</p><p className="mt-2 text-2xl font-bold">{summary?.quotations_open ?? 0}</p></Card>
            <Card><p className="text-xs text-muted-foreground">Invoice outstanding</p><p className="mt-2 text-lg font-bold">{money(outstanding)}</p></Card>
            <Card><p className="text-xs text-muted-foreground">Recorded expenses</p><p className="mt-2 text-lg font-bold">{money(summary?.expenses_ugx ?? 0)}</p></Card>
          </div>
          <Card>
            <h2 className="font-semibold">Commercial operations</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Business is now a complete work area. Use the sections above to manage clients, suppliers, quotations, invoices, purchase orders and expenses without mixing them into one screen.
            </p>
          </Card>
        </div>
      )}

      {(tab === "clients" || tab === "suppliers") && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {simpleRows.length === 0 ? (
            <Card className="md:col-span-2 xl:col-span-3 py-12 text-center">
              <p className="font-medium">No {tab} yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Use the button above to add the first one.</p>
            </Card>
          ) : (
            simpleRows.map((item) => (
              <Card key={item.id}>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "quotations" && (
        <div className="space-y-3">
          {quotes.length === 0 ? (
            <Card className="py-12 text-center"><p className="font-medium">No quotations yet</p></Card>
          ) : quotes.map((item) => (
            <Card key={item.id} className="flex items-center justify-between gap-4">
              <div><p className="font-medium">{item.quotation_number}</p><p className="text-sm text-muted-foreground">{item.client_name}</p></div>
              <div className="text-right"><p className="font-semibold">{money(item.amount_ugx)}</p><p className="text-xs text-muted-foreground">{item.status}</p></div>
            </Card>
          ))}
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <Card className="py-12 text-center"><p className="font-medium">No invoices yet</p></Card>
          ) : invoices.map((item) => (
            <Card key={item.id} className="flex items-center justify-between gap-4">
              <div><p className="font-medium">{item.invoice_number}</p><p className="text-sm text-muted-foreground">{item.client_name}</p></div>
              <div className="text-right"><p className="font-semibold">{money(item.amount_ugx)}</p><p className="text-xs text-muted-foreground">{item.status}</p></div>
            </Card>
          ))}
        </div>
      )}

      {tab === "purchase_orders" && (
        <div className="space-y-3">
          {purchaseOrders.length === 0 ? <Card className="py-12 text-center"><p className="font-medium">No purchase orders yet</p></Card> : purchaseOrders.map((item) => (
            <Card key={item.id} className="flex items-center justify-between">
              <div><p className="font-medium">{item.po_number}</p><p className="text-sm text-muted-foreground">{item.supplier_name}</p></div>
              <div className="text-right"><p className="font-semibold">{money(item.amount_ugx)}</p><p className="text-xs text-muted-foreground">{item.status}</p></div>
            </Card>
          ))}
        </div>
      )}

      {tab === "expenses" && (
        <div className="space-y-3">
          {expenses.length === 0 ? <Card className="py-12 text-center"><p className="font-medium">No expenses yet</p></Card> : expenses.map((item) => (
            <Card key={item.id} className="flex items-center justify-between">
              <div><p className="font-medium">{item.description}</p><p className="text-sm text-muted-foreground">{item.category} · {item.expense_date}</p></div>
              <p className="font-semibold">{money(item.amount_ugx)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(createKind)}
        onClose={closeCreate}
        title={
          createKind === "clients" ? "New client" :
          createKind === "suppliers" ? "New supplier" :
          createKind === "quotation" ? "New quotation" :
          createKind === "invoice" ? "New invoice" :
          createKind === "purchase_order" ? "New purchase order" : "Add expense"
        }
        description="Keep it simple. You can attach documents in the Documents area."
      >
        <form className="space-y-4" onSubmit={save}>
          {(createKind === "clients" || createKind === "suppliers") && (
            <>
              <Input id="party-name" label="Name" value={form.name || ""} onChange={(e) => set("name", e.target.value)} required />
              <Input id="party-contact" label="Contact person" value={form.contact_person || ""} onChange={(e) => set("contact_person", e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="party-phone" label="Phone" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
                <Input id="party-email" label="Email" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
              </div>
            </>
          )}

          {(createKind === "quotation" || createKind === "invoice") && (
            <>
              <Input id="doc-number" label={createKind === "quotation" ? "Quotation number" : "Invoice number"} value={form.number || ""} onChange={(e) => set("number", e.target.value)} required />
              <Input id="client-name" label="Client" value={form.client_name || ""} onChange={(e) => set("client_name", e.target.value)} required />
              <Input id="doc-amount" label="Amount (UGX)" type="number" value={form.amount || ""} onChange={(e) => set("amount", e.target.value)} required />
              {createKind === "invoice" && <Input id="paid-amount" label="Already paid (UGX)" type="number" value={form.paid_amount || ""} onChange={(e) => set("paid_amount", e.target.value)} />}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="issue-date" label="Issue date" type="date" value={form.issue_date || today()} onChange={(e) => set("issue_date", e.target.value)} />
                <Input id="end-date" label={createKind === "quotation" ? "Valid until" : "Due date"} type="date" value={(createKind === "quotation" ? form.valid_until : form.due_date) || ""} onChange={(e) => set(createKind === "quotation" ? "valid_until" : "due_date", e.target.value)} />
              </div>
            </>
          )}

          {createKind === "purchase_order" && (
            <>
              <Input id="po-number" label="Purchase order number" value={form.number || ""} onChange={(e) => set("number", e.target.value)} required />
              <Input id="supplier-name" label="Supplier" value={form.supplier_name || ""} onChange={(e) => set("supplier_name", e.target.value)} required />
              <Input id="po-amount" label="Amount (UGX)" type="number" value={form.amount || ""} onChange={(e) => set("amount", e.target.value)} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="po-date" label="Order date" type="date" value={form.order_date || today()} onChange={(e) => set("order_date", e.target.value)} />
                <Input id="po-expected" label="Expected date" type="date" value={form.expected_date || ""} onChange={(e) => set("expected_date", e.target.value)} />
              </div>
            </>
          )}

          {createKind === "expense" && (
            <>
              <Input id="expense-description" label="What was paid for?" value={form.description || ""} onChange={(e) => set("description", e.target.value)} required />
              <Input id="expense-amount" label="Amount (UGX)" type="number" value={form.amount || ""} onChange={(e) => set("amount", e.target.value)} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id="expense-date" label="Date" type="date" value={form.expense_date || today()} onChange={(e) => set("expense_date", e.target.value)} />
                <Input id="expense-category" label="Category" value={form.category || ""} onChange={(e) => set("category", e.target.value)} placeholder="Transport, equipment..." />
              </div>
              <Input id="expense-reference" label="Reference / receipt no." value={form.reference || ""} onChange={(e) => set("reference", e.target.value)} />
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={closeCreate} disabled={saving}>Cancel</Button>
            <Button type="submit" isLoading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BusinessPage;
