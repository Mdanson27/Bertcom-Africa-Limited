import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  ShoppingCart,
  UsersRound,
  WalletCards,
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
  businessApi,
  type BusinessSummary,
  type ClientRecord,
  type ClientStatementSummary,
  type ClientWorkspace,
  type DocumentOption,
  type ExpenseRecord,
  type InvoiceRecord,
  type ProjectOption,
  type PurchaseOrderRecord,
  type QuotationRecord,
  type ReceiptRecord,
  type StatementEntry,
  type SupplierRecord,
  type SupplierStatementSummary,
  type SupplierWorkspace,
} from "@/lib/businessApi";

type BusinessView =
  | "overview"
  | "clients"
  | "suppliers"
  | "quotations"
  | "invoices"
  | "receipts"
  | "purchase_orders"
  | "expenses"
  | "statements";

type CreateKind =
  | "client"
  | "supplier"
  | "quotation"
  | "invoice"
  | "payment"
  | "purchase_order"
  | "expense";

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value || 0);

const today = () => new Date().toISOString().slice(0, 10);
const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

const labelStatus = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const StatusPill: React.FC<{ value: string }> = ({ value }) => (
  <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
    {labelStatus(value)}
  </span>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
    {text}
  </div>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = "text", placeholder, required }) => (
  <label className="space-y-1.5 text-xs font-medium text-foreground">
    <span>{label}</span>
    <Input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </label>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}> = ({ label, value, onChange, children, required }) => (
  <label className="space-y-1.5 text-xs font-medium text-foreground">
    <span>{label}</span>
    <select
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
    >
      {children}
    </select>
  </label>
);

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
}> = ({ label, value, helper, icon }) => (
  <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
        {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
      </div>
      <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
    </div>
  </Card>
);

export const BusinessPage: React.FC = () => {
  const { showSuccessToast, showErrorToast } = useCustomToast();
  const [tab, setTab] = useState<BusinessView>("overview");
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [quotes, setQuotes] = useState<QuotationRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [clientStatements, setClientStatements] = useState<ClientStatementSummary[]>([]);
  const [supplierStatements, setSupplierStatements] = useState<SupplierStatementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [clientWorkspace, setClientWorkspace] = useState<ClientWorkspace | null>(null);
  const [supplierWorkspace, setSupplierWorkspace] = useState<SupplierWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [statementTitle, setStatementTitle] = useState("");
  const [statementRows, setStatementRows] = useState<StatementEntry[] | null>(null);

  const formDirty = Boolean(createKind) && Object.values(form).some((value) => value.trim());
  useUnsavedChanges(Boolean(formDirty));

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const [
        nextSummary,
        nextClients,
        nextSuppliers,
        nextQuotes,
        nextInvoices,
        nextReceipts,
        nextPurchaseOrders,
        nextExpenses,
        nextProjects,
        nextDocuments,
        nextClientStatements,
        nextSupplierStatements,
      ] = await Promise.all([
        businessApi.summary(),
        businessApi.clients(),
        businessApi.suppliers(),
        businessApi.quotations(),
        businessApi.invoices(),
        businessApi.receipts(),
        businessApi.purchaseOrders(),
        businessApi.expenses(),
        businessApi.projects(),
        businessApi.documents(),
        businessApi.clientStatementSummaries(),
        businessApi.supplierStatementSummaries(),
      ]);
      setSummary(nextSummary);
      setClients(nextClients);
      setSuppliers(nextSuppliers);
      setQuotes(nextQuotes);
      setInvoices(nextInvoices);
      setReceipts(nextReceipts);
      setPurchaseOrders(nextPurchaseOrders);
      setExpenses(nextExpenses);
      setProjects(nextProjects);
      setDocuments(nextDocuments);
      setClientStatements(nextClientStatements);
      setSupplierStatements(nextSupplierStatements);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Business records could not be loaded."));
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProjects = useMemo(() => {
    if (!form.client_id) return projects;
    const client = clients.find((item) => item.id === form.client_id);
    return projects.filter(
      (project) =>
        project.client_id === form.client_id ||
        (client && project.client_name.trim().toLowerCase() === client.name.trim().toLowerCase()),
    );
  }, [clients, form.client_id, projects]);

  const set = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const openCreate = (kind: CreateKind, defaults: Record<string, string> = {}) => {
    const dates: Record<string, string> = {};
    if (kind === "quotation" || kind === "invoice") dates.issue_date = today();
    if (kind === "payment") dates.payment_date = today();
    if (kind === "purchase_order") dates.order_date = today();
    if (kind === "expense") dates.expense_date = today();
    setForm({ ...dates, ...defaults });
    setCreateKind(kind);
  };

  const closeCreate = () => {
    if (saving) return;
    if (!confirmDiscardChanges(Boolean(formDirty), "Discard this unsaved business record?")) return;
    setCreateKind(null);
    setForm({});
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createKind) return;
    setSaving(true);
    try {
      if (createKind === "client") {
        await businessApi.createClient({
          name: form.name,
          contact_person: form.contact_person || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
        });
      } else if (createKind === "supplier") {
        await businessApi.createSupplier({
          name: form.name,
          contact_person: form.contact_person || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
        });
      } else if (createKind === "quotation") {
        const client = clients.find((item) => item.id === form.client_id);
        await businessApi.createQuotation({
          quotation_number: form.quotation_number,
          client_id: form.client_id,
          client_name: client?.name || "",
          project_id: form.project_id || null,
          amount_ugx: Number(form.amount_ugx || 0),
          status: "draft",
          issue_date: form.issue_date,
          valid_until: form.valid_until || null,
          notes: form.notes || null,
        });
      } else if (createKind === "invoice") {
        const client = clients.find((item) => item.id === form.client_id);
        await businessApi.createInvoice({
          invoice_number: form.invoice_number,
          client_id: form.client_id,
          client_name: client?.name || "",
          project_id: form.project_id || null,
          amount_ugx: Number(form.amount_ugx || 0),
          status: "draft",
          issue_date: form.issue_date,
          due_date: form.due_date || null,
          notes: form.notes || null,
        });
      } else if (createKind === "payment") {
        await businessApi.createPayment({
          invoice_id: form.invoice_id,
          amount_ugx: Number(form.amount_ugx || 0),
          payment_date: form.payment_date,
          method: form.method || "bank",
          reference: form.reference || null,
          notes: form.notes || null,
        });
      } else if (createKind === "purchase_order") {
        const supplier = suppliers.find((item) => item.id === form.supplier_id);
        await businessApi.createPurchaseOrder({
          po_number: form.po_number,
          supplier_id: form.supplier_id,
          supplier_name: supplier?.name || "",
          project_id: form.project_id || null,
          amount_ugx: Number(form.amount_ugx || 0),
          status: "draft",
          order_date: form.order_date,
          expected_date: form.expected_date || null,
          notes: form.notes || null,
        });
      } else if (createKind === "expense") {
        await businessApi.createExpense({
          description: form.description,
          amount_ugx: Number(form.amount_ugx || 0),
          expense_date: form.expense_date,
          category: form.category || "general",
          project_id: form.project_id || null,
          supplier_id: form.supplier_id || null,
          supporting_document_id: form.supporting_document_id || null,
          reference: form.reference || null,
        });
      }
      showSuccessToast("Business record saved.");
      setCreateKind(null);
      setForm({});
      await load(false);
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The business record could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    kind: "quotation" | "invoice" | "purchase_order",
    id: string,
    status: string,
  ) => {
    try {
      if (kind === "quotation") await businessApi.updateQuotation(id, { status });
      if (kind === "invoice") await businessApi.updateInvoice(id, { status });
      if (kind === "purchase_order") await businessApi.updatePurchaseOrder(id, { status });
      showSuccessToast("Status updated.");
      await load(false);
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The status could not be updated."));
    }
  };

  const openClientWorkspace = async (client: ClientRecord) => {
    setWorkspaceLoading(true);
    setClientWorkspace(null);
    setSupplierWorkspace(null);
    try {
      setClientWorkspace(await businessApi.clientWorkspace(client.id));
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The client workspace could not be opened."));
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const openSupplierWorkspace = async (supplier: SupplierRecord) => {
    setWorkspaceLoading(true);
    setClientWorkspace(null);
    setSupplierWorkspace(null);
    try {
      setSupplierWorkspace(await businessApi.supplierWorkspace(supplier.id));
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The supplier workspace could not be opened."));
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const openStatement = async (item: ClientStatementSummary) => {
    setStatementTitle(`${item.client_name} statement`);
    setStatementRows(null);
    try {
      setStatementRows(await businessApi.clientStatement(item.client_id));
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The statement could not be loaded."));
      setStatementTitle("");
    }
  };

  if (isLoading) return <PageLoading label="Loading business operations..." />;
  if (loadError) return <PageError message={loadError} onRetry={() => void load()} />;

  const navItems = [
    { id: "overview" as const, label: "Dashboard" },
    { id: "clients" as const, label: "Clients", count: clients.length },
    { id: "suppliers" as const, label: "Suppliers", count: suppliers.length },
    { id: "quotations" as const, label: "Quotations", count: quotes.length },
    { id: "invoices" as const, label: "Invoices", count: invoices.length },
    { id: "receipts" as const, label: "Receipts", count: receipts.length },
    { id: "purchase_orders" as const, label: "Purchase Orders", count: purchaseOrders.length },
    { id: "expenses" as const, label: "Expenses", count: expenses.length },
    { id: "statements" as const, label: "Statements" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Commercial operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Business</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Clients, suppliers, commercial records, receipts, balances and statements in one connected workspace.
          </p>
        </div>
        <Button onClick={() => openCreate(tab === "suppliers" ? "supplier" : "client")} className="sm:hidden">
          <Plus className="mr-2 h-4 w-4" /> Add record
        </Button>
      </div>

      <SectionNav items={navItems} active={tab} onChange={setTab} ariaLabel="Business sections" />

      {tab === "overview" && summary && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total clients" value={summary.total_clients} helper={`${summary.active_clients} active`} icon={<UsersRound className="h-5 w-5" />} />
            <MetricCard label="Total suppliers" value={summary.total_suppliers} helper={`${summary.active_suppliers} active`} icon={<Building2 className="h-5 w-5" />} />
            <MetricCard label="Open quotations" value={summary.quotations_open} icon={<FileText className="h-5 w-5" />} />
            <MetricCard label="Outstanding invoices" value={summary.outstanding_invoices} icon={<WalletCards className="h-5 w-5" />} />
            <MetricCard label="Receivables" value={money(summary.receivables_ugx)} icon={<Landmark className="h-5 w-5" />} />
            <MetricCard label="Open purchase orders" value={summary.purchase_orders_open} icon={<ShoppingCart className="h-5 w-5" />} />
            <MetricCard label="Expenses this month" value={money(summary.expenses_month_ugx)} icon={<Banknote className="h-5 w-5" />} />
            <MetricCard label="Receipts this month" value={money(summary.receipts_month_ugx)} icon={<ReceiptText className="h-5 w-5" />} />
          </div>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground">Commercial flow</h2>
            <p className="mt-1 text-xs text-muted-foreground">Business records now stay connected to their client, supplier, project and supporting documents.</p>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
              {[
                "Client → Project → Quotation",
                "Quotation → Invoice",
                "Invoice → Payment → Receipt",
                "Supplier → Purchase Order → Expense",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-foreground">{item}</div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "clients" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div><h2 className="text-base font-semibold">Clients</h2><p className="text-xs text-muted-foreground">Open a client to see their complete commercial workspace.</p></div>
            <Button onClick={() => openCreate("client")}><Plus className="mr-2 h-4 w-4" /> New client</Button>
          </div>
          {clients.length === 0 ? <EmptyState text="No clients yet." /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <button key={client.id} type="button" onClick={() => void openClientWorkspace(client)} className="text-left">
                  <Card className="h-full p-4 transition hover:border-primary/50 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-foreground">{client.name}</p><p className="mt-1 text-xs text-muted-foreground">{client.contact_person || "No contact person"}</p></div><StatusPill value={client.is_active ? "active" : "inactive"} /></div>
                    <p className="mt-3 text-xs text-muted-foreground">{client.email || client.phone || "No contact details"}</p>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "suppliers" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div><h2 className="text-base font-semibold">Suppliers</h2><p className="text-xs text-muted-foreground">Purchase orders, supplied projects, expenses and documents.</p></div>
            <Button onClick={() => openCreate("supplier")}><Plus className="mr-2 h-4 w-4" /> New supplier</Button>
          </div>
          {suppliers.length === 0 ? <EmptyState text="No suppliers yet." /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {suppliers.map((supplier) => (
                <button key={supplier.id} type="button" onClick={() => void openSupplierWorkspace(supplier)} className="text-left">
                  <Card className="h-full p-4 transition hover:border-primary/50 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-foreground">{supplier.name}</p><p className="mt-1 text-xs text-muted-foreground">{supplier.contact_person || "No contact person"}</p></div><StatusPill value={supplier.is_active ? "active" : "inactive"} /></div>
                    <p className="mt-3 text-xs text-muted-foreground">{supplier.email || supplier.phone || "No contact details"}</p>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "quotations" && (
        <RecordSection title="Quotations" subtitle="Draft, send, accept, reject or expire commercial quotations." onAdd={() => openCreate("quotation")} addLabel="New quotation">
          {quotes.length === 0 ? <EmptyState text="No quotations yet." /> : (
            <RecordsTable headers={["Quotation", "Client", "Amount", "Issued", "Status"]}>
              {quotes.map((item) => <tr key={item.id} className="border-t border-border"><Cell strong>{item.quotation_number}</Cell><Cell>{item.client_name}</Cell><Cell>{money(item.amount_ugx)}</Cell><Cell>{item.issue_date}</Cell><Cell><select className={`${selectClass} h-8 min-w-32`} value={item.status} onChange={(e) => void updateStatus("quotation", item.id, e.target.value)}>{["draft","sent","accepted","rejected","expired"].map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select></Cell></tr>)}
            </RecordsTable>
          )}
        </RecordSection>
      )}

      {tab === "invoices" && (
        <RecordSection title="Invoices" subtitle="Outstanding balances update automatically as payments are recorded." onAdd={() => openCreate("invoice")} addLabel="New invoice">
          {invoices.length === 0 ? <EmptyState text="No invoices yet." /> : (
            <RecordsTable headers={["Invoice", "Client", "Total", "Paid", "Outstanding", "Status", ""]}>
              {invoices.map((item) => <tr key={item.id} className="border-t border-border"><Cell strong>{item.invoice_number}</Cell><Cell>{item.client_name}</Cell><Cell>{money(item.amount_ugx)}</Cell><Cell>{money(item.paid_amount_ugx)}</Cell><Cell>{money(item.outstanding_amount_ugx)}</Cell><Cell><select className={`${selectClass} h-8 min-w-36`} value={item.status} disabled={item.status === "paid"} onChange={(e) => void updateStatus("invoice", item.id, e.target.value)}>{["draft","sent","partially_paid","paid","overdue"].map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select></Cell><Cell>{item.outstanding_amount_ugx > 0 && <Button variant="outline" size="sm" onClick={() => openCreate("payment", { invoice_id: item.id, amount_ugx: String(item.outstanding_amount_ugx) })}>Record payment</Button>}</Cell></tr>)}
            </RecordsTable>
          )}
        </RecordSection>
      )}

      {tab === "receipts" && (
        <RecordSection title="Receipts" subtitle="Each payment appears here as the accounting source for a receipt. Branded PDF generation comes in Step 2.">
          {receipts.length === 0 ? <EmptyState text="No receipts yet. Record a payment against an invoice to create one." /> : (
            <RecordsTable headers={["Receipt ref", "Client", "Invoice", "Amount", "Date", "Method", "Reference"]}>
              {receipts.map((item) => <tr key={item.id} className="border-t border-border"><Cell strong>{item.receipt_reference}</Cell><Cell>{item.client_name || "—"}</Cell><Cell>{item.invoice_number || "—"}</Cell><Cell>{money(item.amount_ugx)}</Cell><Cell>{item.payment_date}</Cell><Cell>{labelStatus(item.method)}</Cell><Cell>{item.reference || "—"}</Cell></tr>)}
            </RecordsTable>
          )}
        </RecordSection>
      )}

      {tab === "purchase_orders" && (
        <RecordSection title="Purchase Orders" subtitle="Supplier purchasing workflow from draft through closure." onAdd={() => openCreate("purchase_order")} addLabel="New purchase order">
          {purchaseOrders.length === 0 ? <EmptyState text="No purchase orders yet." /> : (
            <RecordsTable headers={["PO", "Supplier", "Amount", "Order date", "Status"]}>
              {purchaseOrders.map((item) => <tr key={item.id} className="border-t border-border"><Cell strong>{item.po_number}</Cell><Cell>{item.supplier_name}</Cell><Cell>{money(item.amount_ugx)}</Cell><Cell>{item.order_date}</Cell><Cell><select className={`${selectClass} h-8 min-w-28`} value={item.status} onChange={(e) => void updateStatus("purchase_order", item.id, e.target.value)}>{["draft","issued","received","closed"].map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}</select></Cell></tr>)}
            </RecordsTable>
          )}
        </RecordSection>
      )}

      {tab === "expenses" && (
        <RecordSection title="Expenses" subtitle="Expenses can link to a project, supplier and supporting document." onAdd={() => openCreate("expense")} addLabel="New expense">
          {expenses.length === 0 ? <EmptyState text="No expenses yet." /> : (
            <RecordsTable headers={["Description", "Category", "Amount", "Date", "Reference", "Document"]}>
              {expenses.map((item) => <tr key={item.id} className="border-t border-border"><Cell strong>{item.description}</Cell><Cell>{labelStatus(item.category)}</Cell><Cell>{money(item.amount_ugx)}</Cell><Cell>{item.expense_date}</Cell><Cell>{item.reference || "—"}</Cell><Cell>{item.supporting_document_id ? "Linked" : "—"}</Cell></tr>)}
            </RecordsTable>
          )}
        </RecordSection>
      )}

      {tab === "statements" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Client statements</h2>
            <p className="mt-1 text-xs text-muted-foreground">Invoices, receipts and the live outstanding balance.</p>
            <div className="mt-4 space-y-2">
              {clientStatements.length === 0 ? <EmptyState text="No client statement activity yet." /> : clientStatements.map((item) => (
                <button key={item.client_id} type="button" onClick={() => void openStatement(item)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left hover:bg-accent/50">
                  <div><p className="text-sm font-medium">{item.client_name}</p><p className="text-xs text-muted-foreground">Invoiced {money(item.invoiced_ugx)} · Paid {money(item.paid_ugx)}</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-sm font-semibold">{money(item.outstanding_ugx)}</p></div>
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold">Supplier summaries</h2>
            <p className="mt-1 text-xs text-muted-foreground">Purchase orders and recorded supplier expenses.</p>
            <div className="mt-4 space-y-2">
              {supplierStatements.length === 0 ? <EmptyState text="No supplier statement activity yet." /> : supplierStatements.map((item) => (
                <div key={item.supplier_id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div><p className="text-sm font-medium">{item.supplier_name}</p><p className="text-xs text-muted-foreground">Purchase orders {money(item.purchase_orders_ugx)}</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Expenses</p><p className="text-sm font-semibold">{money(item.expenses_ugx)}</p></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal isOpen={Boolean(createKind)} onClose={closeCreate} title={createKind ? `New ${labelStatus(createKind)}` : "New record"} description="Business records remain connected to the correct parties and projects.">
        <form className="space-y-4" onSubmit={save}>
          {(createKind === "client" || createKind === "supplier") && <>
            <Field label="Name" value={form.name || ""} onChange={(v) => set("name", v)} required />
            <Field label="Contact person" value={form.contact_person || ""} onChange={(v) => set("contact_person", v)} />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Phone" value={form.phone || ""} onChange={(v) => set("phone", v)} /><Field label="Email" type="email" value={form.email || ""} onChange={(v) => set("email", v)} /></div>
            <Field label="Address" value={form.address || ""} onChange={(v) => set("address", v)} />
            <Field label="Notes" value={form.notes || ""} onChange={(v) => set("notes", v)} />
          </>}

          {(createKind === "quotation" || createKind === "invoice") && <>
            <Field label={createKind === "quotation" ? "Quotation number" : "Invoice number"} value={form[createKind === "quotation" ? "quotation_number" : "invoice_number"] || ""} onChange={(v) => set(createKind === "quotation" ? "quotation_number" : "invoice_number", v)} required />
            <SelectField label="Client" value={form.client_id || ""} onChange={(v) => { set("client_id", v); set("project_id", ""); }} required><option value="">Select client</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <SelectField label="Project" value={form.project_id || ""} onChange={(v) => set("project_id", v)}><option value="">No project</option>{filteredProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <Field label="Amount (UGX)" type="number" value={form.amount_ugx || ""} onChange={(v) => set("amount_ugx", v)} required />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Issue date" type="date" value={form.issue_date || ""} onChange={(v) => set("issue_date", v)} required /><Field label={createKind === "quotation" ? "Valid until" : "Due date"} type="date" value={form[createKind === "quotation" ? "valid_until" : "due_date"] || ""} onChange={(v) => set(createKind === "quotation" ? "valid_until" : "due_date", v)} /></div>
            <Field label="Notes" value={form.notes || ""} onChange={(v) => set("notes", v)} />
          </>}

          {createKind === "payment" && <>
            <SelectField label="Invoice" value={form.invoice_id || ""} onChange={(v) => set("invoice_id", v)} required><option value="">Select invoice</option>{invoices.filter((item) => item.outstanding_amount_ugx > 0).map((item) => <option key={item.id} value={item.id}>{item.invoice_number} · {item.client_name} · {money(item.outstanding_amount_ugx)}</option>)}</SelectField>
            <Field label="Amount received (UGX)" type="number" value={form.amount_ugx || ""} onChange={(v) => set("amount_ugx", v)} required />
            <Field label="Payment date" type="date" value={form.payment_date || ""} onChange={(v) => set("payment_date", v)} required />
            <SelectField label="Payment method" value={form.method || "bank"} onChange={(v) => set("method", v)}><option value="bank">Bank</option><option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="cheque">Cheque</option><option value="other">Other</option></SelectField>
            <Field label="Reference" value={form.reference || ""} onChange={(v) => set("reference", v)} />
            <Field label="Notes" value={form.notes || ""} onChange={(v) => set("notes", v)} />
          </>}

          {createKind === "purchase_order" && <>
            <Field label="Purchase order number" value={form.po_number || ""} onChange={(v) => set("po_number", v)} required />
            <SelectField label="Supplier" value={form.supplier_id || ""} onChange={(v) => set("supplier_id", v)} required><option value="">Select supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <SelectField label="Project" value={form.project_id || ""} onChange={(v) => set("project_id", v)}><option value="">No project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <Field label="Amount (UGX)" type="number" value={form.amount_ugx || ""} onChange={(v) => set("amount_ugx", v)} required />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Order date" type="date" value={form.order_date || ""} onChange={(v) => set("order_date", v)} required /><Field label="Expected date" type="date" value={form.expected_date || ""} onChange={(v) => set("expected_date", v)} /></div>
            <Field label="Notes" value={form.notes || ""} onChange={(v) => set("notes", v)} />
          </>}

          {createKind === "expense" && <>
            <Field label="Description" value={form.description || ""} onChange={(v) => set("description", v)} required />
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Category" value={form.category || ""} onChange={(v) => set("category", v)} placeholder="e.g. transport" /><Field label="Amount (UGX)" type="number" value={form.amount_ugx || ""} onChange={(v) => set("amount_ugx", v)} required /></div>
            <Field label="Expense date" type="date" value={form.expense_date || ""} onChange={(v) => set("expense_date", v)} required />
            <SelectField label="Project" value={form.project_id || ""} onChange={(v) => set("project_id", v)}><option value="">No project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <SelectField label="Supplier" value={form.supplier_id || ""} onChange={(v) => set("supplier_id", v)}><option value="">No supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <SelectField label="Supporting document" value={form.supporting_document_id || ""} onChange={(v) => set("supporting_document_id", v)}><option value="">No supporting document</option>{documents.filter((item) => !form.project_id || !item.project_id || item.project_id === form.project_id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</SelectField>
            <Field label="Reference" value={form.reference || ""} onChange={(v) => set("reference", v)} />
          </>}

          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={closeCreate}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={workspaceLoading || Boolean(clientWorkspace)} onClose={() => { if (!workspaceLoading) setClientWorkspace(null); }} title={clientWorkspace?.client.name || "Client workspace"} description="Profile, projects, quotations, invoices, receipts, documents and activity." className="max-w-5xl">
        {workspaceLoading ? <PageLoading label="Opening client workspace..." /> : clientWorkspace && <ClientWorkspaceView workspace={clientWorkspace} />}
      </Modal>

      <Modal isOpen={workspaceLoading || Boolean(supplierWorkspace)} onClose={() => { if (!workspaceLoading) setSupplierWorkspace(null); }} title={supplierWorkspace?.supplier.name || "Supplier workspace"} description="Purchase orders, expenses, supplied projects, documents and activity." className="max-w-5xl">
        {workspaceLoading ? <PageLoading label="Opening supplier workspace..." /> : supplierWorkspace && <SupplierWorkspaceView workspace={supplierWorkspace} />}
      </Modal>

      <Modal isOpen={Boolean(statementTitle)} onClose={() => { setStatementTitle(""); setStatementRows(null); }} title={statementTitle || "Client statement"} description="Running invoice and payment balance." className="max-w-4xl">
        {statementRows === null ? <PageLoading label="Loading statement..." /> : statementRows.length === 0 ? <EmptyState text="No statement entries yet." /> : <RecordsTable headers={["Date", "Type", "Reference", "Debit", "Credit", "Balance"]}>{statementRows.map((item) => <tr key={`${item.kind}-${item.record_id}`} className="border-t border-border"><Cell>{item.entry_date}</Cell><Cell><StatusPill value={item.kind} /></Cell><Cell strong>{item.reference}</Cell><Cell>{item.debit_ugx ? money(item.debit_ugx) : "—"}</Cell><Cell>{item.credit_ugx ? money(item.credit_ugx) : "—"}</Cell><Cell>{money(item.running_balance_ugx)}</Cell></tr>)}</RecordsTable>}
      </Modal>
    </div>
  );
};

const RecordSection: React.FC<{ title: string; subtitle: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string }> = ({ title, subtitle, children, onAdd, addLabel }) => (
  <section className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div>{onAdd && <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />{addLabel}</Button>}</div>{children}</section>
);

const RecordsTable: React.FC<{ headers: string[]; children: React.ReactNode }> = ({ headers, children }) => (
  <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-muted/50 text-muted-foreground"><tr>{headers.map((header, index) => <th key={`${header}-${index}`} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div></Card>
);

const Cell: React.FC<{ children: React.ReactNode; strong?: boolean }> = ({ children, strong }) => <td className={`px-4 py-3 ${strong ? "font-medium text-foreground" : "text-muted-foreground"}`}>{children}</td>;

const ClientWorkspaceView: React.FC<{ workspace: ClientWorkspace }> = ({ workspace }) => (
  <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Projects" value={workspace.projects.length} icon={<Building2 className="h-5 w-5" />} /><MetricCard label="Invoices" value={workspace.invoices.length} icon={<WalletCards className="h-5 w-5" />} /><MetricCard label="Outstanding balance" value={money(workspace.outstanding_balance_ugx)} icon={<Landmark className="h-5 w-5" />} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><WorkspaceBox title="Profile"><p>{workspace.client.contact_person || "No contact person"}</p><p>{workspace.client.email || "No email"}</p><p>{workspace.client.phone || "No phone"}</p><p>{workspace.client.address || "No address"}</p></WorkspaceBox><WorkspaceBox title="Projects">{workspace.projects.length ? workspace.projects.map((item) => <WorkspaceRow key={item.id} primary={item.name} secondary={`${labelStatus(item.status)} · ${item.progress}% complete`} />) : <p>No projects linked.</p>}</WorkspaceBox></div>
    <div className="grid gap-4 lg:grid-cols-2"><WorkspaceBox title="Quotations">{workspace.quotations.length ? workspace.quotations.map((item) => <WorkspaceRow key={item.id} primary={item.quotation_number} secondary={`${money(item.amount_ugx)} · ${labelStatus(item.status)}`} />) : <p>No quotations.</p>}</WorkspaceBox><WorkspaceBox title="Invoices">{workspace.invoices.length ? workspace.invoices.map((item) => <WorkspaceRow key={item.id} primary={item.invoice_number} secondary={`${money(item.outstanding_amount_ugx)} outstanding · ${labelStatus(item.status)}`} />) : <p>No invoices.</p>}</WorkspaceBox></div>
    <div className="grid gap-4 lg:grid-cols-2"><WorkspaceBox title="Receipts">{workspace.receipts.length ? workspace.receipts.map((item) => <WorkspaceRow key={item.id} primary={item.receipt_reference} secondary={`${money(item.amount_ugx)} · ${item.payment_date}`} />) : <p>No receipts.</p>}</WorkspaceBox><WorkspaceBox title="Documents">{workspace.documents.length ? workspace.documents.map((item) => <WorkspaceRow key={item.id} primary={item.title} secondary={labelStatus(item.category)} />) : <p>No documents.</p>}</WorkspaceBox></div>
    <WorkspaceBox title="Activity">{workspace.activity.length ? workspace.activity.slice(0, 12).map((item) => <WorkspaceRow key={`${item.kind}-${item.record_id}-${item.occurred_at}`} primary={item.label} secondary={`${labelStatus(item.kind)} · ${item.detail || "Updated"}`} />) : <p>No activity yet.</p>}</WorkspaceBox>
  </div>
);

const SupplierWorkspaceView: React.FC<{ workspace: SupplierWorkspace }> = ({ workspace }) => (
  <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Projects supplied" value={workspace.projects.length} icon={<Building2 className="h-5 w-5" />} /><MetricCard label="Purchase orders" value={money(workspace.purchase_orders_total_ugx)} icon={<ShoppingCart className="h-5 w-5" />} /><MetricCard label="Expenses" value={money(workspace.expenses_total_ugx)} icon={<Banknote className="h-5 w-5" />} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><WorkspaceBox title="Profile"><p>{workspace.supplier.contact_person || "No contact person"}</p><p>{workspace.supplier.email || "No email"}</p><p>{workspace.supplier.phone || "No phone"}</p><p>{workspace.supplier.address || "No address"}</p></WorkspaceBox><WorkspaceBox title="Projects supplied">{workspace.projects.length ? workspace.projects.map((item) => <WorkspaceRow key={item.id} primary={item.name} secondary={labelStatus(item.status)} />) : <p>No linked projects.</p>}</WorkspaceBox></div>
    <div className="grid gap-4 lg:grid-cols-2"><WorkspaceBox title="Purchase Orders">{workspace.purchase_orders.length ? workspace.purchase_orders.map((item) => <WorkspaceRow key={item.id} primary={item.po_number} secondary={`${money(item.amount_ugx)} · ${labelStatus(item.status)}`} />) : <p>No purchase orders.</p>}</WorkspaceBox><WorkspaceBox title="Expenses">{workspace.expenses.length ? workspace.expenses.map((item) => <WorkspaceRow key={item.id} primary={item.description} secondary={`${money(item.amount_ugx)} · ${labelStatus(item.category)}`} />) : <p>No expenses.</p>}</WorkspaceBox></div>
    <div className="grid gap-4 lg:grid-cols-2"><WorkspaceBox title="Documents">{workspace.documents.length ? workspace.documents.map((item) => <WorkspaceRow key={item.id} primary={item.title} secondary={labelStatus(item.category)} />) : <p>No documents.</p>}</WorkspaceBox><WorkspaceBox title="Activity">{workspace.activity.length ? workspace.activity.slice(0, 12).map((item) => <WorkspaceRow key={`${item.kind}-${item.record_id}-${item.occurred_at}`} primary={item.label} secondary={`${labelStatus(item.kind)} · ${item.detail || "Updated"}`} />) : <p>No activity yet.</p>}</WorkspaceBox></div>
  </div>
);

const WorkspaceBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground"><h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3><div className="space-y-2">{children}</div></div>;
const WorkspaceRow: React.FC<{ primary: string; secondary: string }> = ({ primary, secondary }) => <div className="rounded-lg bg-muted/40 px-3 py-2"><p className="font-medium text-foreground">{primary}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{secondary}</p></div>;

export default BusinessPage;
