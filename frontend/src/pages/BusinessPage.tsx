import React, { useEffect, useMemo, useState } from "react";
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

type BusinessTab = "clients" | "sales" | "purchases" | "expenses" | "suppliers";
type CreateKind = BusinessTab | "quotation" | "invoice";

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);

const today = () => new Date().toISOString().slice(0, 10);

export const BusinessPage: React.FC = () => {
  const [tab, setTab] = useState<BusinessTab>("clients");
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

  const load = async () => {
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
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = (kind: CreateKind) => {
    const defaults: Record<string, string> = {};
    if (kind === "quotation") defaults.issue_date = today();
    if (kind === "invoice") defaults.issue_date = today();
    if (kind === "purchases") defaults.order_date = today();
    if (kind === "expenses") defaults.expense_date = today();
    setForm(defaults);
    setCreateKind(kind);
  };

  const closeCreate = () => {
    setCreateKind(null);
    setForm({});
  };

  const set = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createKind) return;
    setSaving(true);
    try {
      if (createKind === "clients") {
        await workspaceApi.createClient({
          name: form.name || "",
          contact_person: form.contact_person || null,
          phone: form.phone || null,
          email: form.email || null,
        });
      } else if (createKind === "suppliers") {
        await workspaceApi.createSupplier({
          name: form.name || "",
          contact_person: form.contact_person || null,
          phone: form.phone || null,
          email: form.email || null,
        });
      } else if (createKind === "quotation") {
        await workspaceApi.createQuotation({
          quotation_number: form.number || "",
          client_name: form.client_name || "",
          amount_ugx: Number(form.amount || 0),
          issue_date: form.issue_date || today(),
          valid_until: form.valid_until || null,
          status: "draft",
        });
      } else if (createKind === "invoice") {
        await workspaceApi.createInvoice({
          invoice_number: form.number || "",
          client_name: form.client_name || "",
          amount_ugx: Number(form.amount || 0),
          paid_amount_ugx: Number(form.paid_amount || 0),
          issue_date: form.issue_date || today(),
          due_date: form.due_date || null,
          status: "draft",
        });
      } else if (createKind === "purchases") {
        await workspaceApi.createPurchaseOrder({
          po_number: form.number || "",
          supplier_name: form.supplier_name || "",
          amount_ugx: Number(form.amount || 0),
          order_date: form.order_date || today(),
          expected_date: form.expected_date || null,
          status: "draft",
        });
      } else if (createKind === "expenses") {
        await workspaceApi.createExpense({
          description: form.description || "",
          amount_ugx: Number(form.amount || 0),
          expense_date: form.expense_date || today(),
          category: form.category || "general",
          reference: form.reference || null,
        });
      }
      closeCreate();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "clients" as const, label: "Clients", icon: UsersRound },
    { id: "sales" as const, label: "Sales", icon: FileText },
    { id: "purchases" as const, label: "Purchases", icon: ShoppingCart },
    { id: "expenses" as const, label: "Expenses", icon: Receipt },
    { id: "suppliers" as const, label: "Suppliers", icon: Building2 },
  ];

  const outstanding = summary?.invoice_outstanding_ugx ?? 0;

  const createLabel = useMemo(() => {
    if (tab === "clients") return "New client";
    if (tab === "purchases") return "New purchase order";
    if (tab === "expenses") return "Add expense";
    if (tab === "suppliers") return "New supplier";
    return "";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Business</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clients, sales, purchases and expenses without accounting complexity.
          </p>
        </div>
        {tab !== "sales" && (
          <Button className="gap-2" onClick={() => openCreate(tab)}>
            <Plus className="h-4 w-4" /> {createLabel}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card><p className="text-xs text-muted-foreground">Clients</p><p className="mt-2 text-2xl font-bold">{summary?.clients ?? "—"}</p></Card>
        <Card><p className="text-xs text-muted-foreground">Suppliers</p><p className="mt-2 text-2xl font-bold">{summary?.suppliers ?? "—"}</p></Card>
        <Card><p className="text-xs text-muted-foreground">Open quotations</p><p className="mt-2 text-2xl font-bold">{summary?.quotations_open ?? "—"}</p></Card>
        <Card><p className="text-xs text-muted-foreground">Invoice outstanding</p><p className="mt-2 text-lg font-bold">{money(outstanding)}</p></Card>
        <Card><p className="text-xs text-muted-foreground">Recorded expenses</p><p className="mt-2 text-lg font-bold">{money(summary?.expenses_ugx ?? 0)}</p></Card>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold"
                : "flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50"
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

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

      {tab === "sales" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={() => openCreate("quotation")}><Plus className="h-4 w-4" /> New quotation</Button>
            <Button variant="outline" className="gap-2" onClick={() => openCreate("invoice")}><Plus className="h-4 w-4" /> New invoice</Button>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="font-semibold">Quotations</h2>
              <div className="mt-4 space-y-2">
                {quotes.length === 0 ? <p className="text-sm text-muted-foreground">No quotations yet.</p> : quotes.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div><p className="text-sm font-medium">{item.quotation_number}</p><p className="text-xs text-muted-foreground">{item.client_name}</p></div>
                    <div className="text-right"><p className="text-sm font-semibold">{money(item.amount_ugx)}</p><p className="text-[10px] text-muted-foreground">{item.status}</p></div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Invoices</h2>
              <div className="mt-4 space-y-2">
                {invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices yet.</p> : invoices.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div><p className="text-sm font-medium">{item.invoice_number}</p><p className="text-xs text-muted-foreground">{item.client_name}</p></div>
                    <div className="text-right"><p className="text-sm font-semibold">{money(item.amount_ugx)}</p><p className="text-[10px] text-muted-foreground">{item.status}</p></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "purchases" && (
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
          createKind === "purchases" ? "New purchase order" : "Add expense"
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

          {createKind === "purchases" && (
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

          {createKind === "expenses" && (
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
            <Button type="button" variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button type="submit" isLoading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BusinessPage;
