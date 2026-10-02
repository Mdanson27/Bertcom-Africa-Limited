import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Banknote, CheckCircle2, Circle, Download, FileText, FolderKanban,
  ListTodo, Plus, Search, UploadCloud, WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  uploadToPresignedUrl,
  workspaceApi,
  type DocumentRecord,
  type Project,
  type ProjectTask,
  type ProjectWorkspace,
} from "@/lib/workspaceApi";

type WorkspaceTab = "overview" | "tasks" | "documents" | "finance" | "activity";
type FinanceKind = "quotation" | "invoice" | "purchase" | "expense";

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency", currency: "UGX", maximumFractionDigits: 0,
  }).format(value);

const today = () => new Date().toISOString().slice(0, 10);
const activityLabel = (table: string) => ({
  projects: "Project", project_tasks: "Task", documents: "Document",
  quotations: "Quotation", invoices: "Invoice",
  purchase_orders: "Purchase order", expenses: "Expense",
}[table] || table.replaceAll("_", " "));

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [financeKind, setFinanceKind] = useState<FinanceKind | null>(null);
  const [financeForm, setFinanceForm] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "", client_name: "", value_ugx: "", due_date: "",
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    const rows = await workspaceApi.projects();
    setProjects(rows);
    if (!selectedId && rows.length) setSelectedId(rows[0].id);
  };

  const loadWorkspace = async (id = selectedId) => {
    if (!id) { setWorkspace(null); return; }
    setWorkspace(await workspaceApi.projectWorkspace(id));
  };

  useEffect(() => { void loadProjects(); }, []);
  useEffect(() => { if (selectedId) void loadWorkspace(selectedId); }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q
      ? projects.filter((p) =>
          p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q))
      : projects;
  }, [projects, query]);

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const project = await workspaceApi.createProject({
      name: form.name.trim(),
      client_name: form.client_name.trim(),
      value_ugx: Number(form.value_ugx || 0),
      due_date: form.due_date || null,
      status: "planning",
      progress: 0,
    });
    setForm({ name: "", client_name: "", value_ugx: "", due_date: "" });
    setCreateOpen(false);
    await loadProjects();
    setSelectedId(project.id);
    setTab("overview");
  };

  const addTask = async () => {
    if (!workspace || !taskTitle.trim()) return;
    await workspaceApi.createTask({
      project_id: workspace.project.id,
      title: taskTitle.trim(),
      status: "pending",
      priority: "normal",
    });
    setTaskTitle("");
    await loadWorkspace();
  };

  const toggleTask = async (task: ProjectTask) => {
    await workspaceApi.updateTask(task.id, {
      status: task.status === "completed" ? "pending" : "completed",
    });
    await loadWorkspace();
  };

  const uploadDocument = async (file: File) => {
    if (!workspace) return;
    setDocBusy(true);
    try {
      const signed = await workspaceApi.createUploadUrl({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        project_id: workspace.project.id,
      });
      await uploadToPresignedUrl(signed.upload_url, file);
      await workspaceApi.createDocument({
        title: file.name.replace(/\.[^.]+$/, ""),
        original_filename: file.name,
        category: "other",
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        storage_key: signed.storage_key,
        project_id: workspace.project.id,
        ocr_status: "not_requested",
        ocr_text: null,
        extracted_fields: {},
      });
      await loadWorkspace();
    } finally {
      setDocBusy(false);
    }
  };

  const openDocument = async (document: DocumentRecord) => {
    const result = await workspaceApi.downloadDocument(document.id);
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const openFinance = (kind: FinanceKind) => {
    const dateField = kind === "purchase" ? "order_date" : kind === "expense" ? "expense_date" : "issue_date";
    setFinanceForm({ [dateField]: today() });
    setFinanceKind(kind);
  };

  const saveFinance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!financeKind || !workspace) return;
    const project = workspace.project;
    const common = { project_id: project.id };
    if (financeKind === "quotation") {
      await workspaceApi.createQuotation({
        ...common,
        quotation_number: financeForm.number || "",
        client_name: financeForm.party || project.client_name,
        amount_ugx: Number(financeForm.amount || 0),
        issue_date: financeForm.issue_date || today(),
        status: "draft",
      });
    } else if (financeKind === "invoice") {
      await workspaceApi.createInvoice({
        ...common,
        invoice_number: financeForm.number || "",
        client_name: financeForm.party || project.client_name,
        amount_ugx: Number(financeForm.amount || 0),
        paid_amount_ugx: Number(financeForm.paid || 0),
        issue_date: financeForm.issue_date || today(),
        due_date: financeForm.due_date || null,
        status: "draft",
      });
    } else if (financeKind === "purchase") {
      await workspaceApi.createPurchaseOrder({
        ...common,
        po_number: financeForm.number || "",
        supplier_name: financeForm.party || "",
        amount_ugx: Number(financeForm.amount || 0),
        order_date: financeForm.order_date || today(),
        status: "draft",
      });
    } else {
      await workspaceApi.createExpense({
        ...common,
        description: financeForm.description || "",
        amount_ugx: Number(financeForm.amount || 0),
        expense_date: financeForm.expense_date || today(),
        category: financeForm.category || "general",
        reference: financeForm.reference || null,
      });
    }
    setFinanceKind(null);
    setFinanceForm({});
    await loadWorkspace();
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: FolderKanban },
    { id: "tasks" as const, label: "Tasks", icon: ListTodo },
    { id: "documents" as const, label: "Documents", icon: FileText },
    { id: "finance" as const, label: "Finance", icon: WalletCards },
    { id: "activity" as const, label: "Activity", icon: Activity },
  ];

  const doneTasks = workspace?.tasks.filter((task) => task.status === "completed").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every project is a complete working folder for delivery, documents and money.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New project
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects..."
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card className="py-10 text-center">
                <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No projects yet</p>
              </Card>
            ) : filtered.map((project) => (
              <button
                key={project.id}
                onClick={() => { setSelectedId(project.id); setTab("overview"); }}
                className="w-full text-left"
              >
                <Card className={selectedId === project.id
                  ? "border-primary/60 bg-primary/5 p-4"
                  : "p-4 hover:border-primary/30"}>
                  <p className="truncate text-xs text-muted-foreground">{project.client_name}</p>
                  <p className="mt-1 truncate text-sm font-semibold">{project.name}</p>
                  <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
                    <span>{project.status}</span><span>{project.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>

        {!workspace ? (
          <Card className="flex min-h-[520px] items-center justify-center text-center">
            <div>
              <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Select a project folder</p>
            </div>
          </Card>
        ) : (
          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{workspace.project.client_name}</p>
                  <h2 className="mt-1 text-xl font-bold">{workspace.project.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {workspace.project.status} · {workspace.project.progress}% complete
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Project value</p>
                  <p className="font-semibold">{money(workspace.project.value_ugx)}</p>
                </div>
              </div>
              <div className="mt-5 flex gap-2 overflow-x-auto border-t border-border pt-4">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={tab === id
                      ? "flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                      : "flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent"}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </Card>

            {tab === "overview" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Card><p className="text-xs text-muted-foreground">Progress</p><p className="mt-2 text-2xl font-bold">{workspace.project.progress}%</p></Card>
                  <Card><p className="text-xs text-muted-foreground">Tasks</p><p className="mt-2 text-2xl font-bold">{doneTasks}/{workspace.tasks.length}</p></Card>
                  <Card><p className="text-xs text-muted-foreground">Documents</p><p className="mt-2 text-2xl font-bold">{workspace.documents.length}</p></Card>
                  <Card><p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-2 text-lg font-bold">{money(workspace.finance.project_outstanding_ugx)}</p></Card>
                </div>
                <Card>
                  <h3 className="font-semibold">Project overview</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {workspace.project.description || "No project description has been added yet."}
                  </p>
                  <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div><p className="text-[10px] uppercase text-muted-foreground">Start</p><p className="mt-1 text-sm">{workspace.project.start_date || "Not set"}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Deadline</p><p className="mt-1 text-sm">{workspace.project.due_date || "Not set"}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Manager</p><p className="mt-1 truncate text-sm">{workspace.project.project_manager_email || "Not assigned"}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Received</p><p className="mt-1 text-sm">{money(workspace.project.amount_paid_ugx)}</p></div>
                  </div>
                </Card>
              </div>
            )}

            {tab === "tasks" && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-semibold">Project tasks</h3><p className="text-xs text-muted-foreground">{doneTasks} completed of {workspace.tasks.length}</p></div>
                  <div className="flex min-w-[280px] flex-1 gap-2 sm:max-w-md">
                    <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Add a task..."
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
                    <Button size="sm" onClick={() => void addTask()}>Add</Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {workspace.tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet.</p> : workspace.tasks.map((task) => (
                    <button key={task.id} onClick={() => void toggleTask(task)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-accent/30">
                      {task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <p className={task.status === "completed" ? "text-sm line-through text-muted-foreground" : "text-sm font-medium"}>{task.title}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{task.priority} priority{task.due_date ? ` · due ${task.due_date}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {tab === "documents" && (
              <div className="space-y-3">
                <Card className="flex flex-wrap items-center justify-between gap-4">
                  <div><h3 className="font-semibold">Project documents</h3><p className="text-xs text-muted-foreground">Files uploaded here stay attached to this project.</p></div>
                  <Button className="gap-2" disabled={docBusy} onClick={() => fileInput.current?.click()}>
                    <UploadCloud className="h-4 w-4" /> {docBusy ? "Uploading..." : "Upload file"}
                  </Button>
                  <input ref={fileInput} type="file" className="hidden" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadDocument(file); e.currentTarget.value = ""; }} />
                </Card>
                {workspace.documents.length === 0 ? (
                  <Card className="py-12 text-center"><FileText className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No project documents yet</p></Card>
                ) : workspace.documents.map((document) => (
                  <Card key={document.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{document.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{document.category.replaceAll("_", " ")} · {Math.max(1, Math.round(document.size_bytes / 1024))} KB</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => void openDocument(document)}>
                      <Download className="h-3.5 w-3.5" /> Open
                    </Button>
                  </Card>
                ))}
              </div>
            )}

            {tab === "finance" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Card><p className="text-xs text-muted-foreground">Invoiced</p><p className="mt-2 text-lg font-bold">{money(workspace.finance.invoice_total_ugx)}</p></Card>
                  <Card><p className="text-xs text-muted-foreground">Invoice outstanding</p><p className="mt-2 text-lg font-bold">{money(workspace.finance.invoice_outstanding_ugx)}</p></Card>
                  <Card><p className="text-xs text-muted-foreground">Purchase orders</p><p className="mt-2 text-lg font-bold">{money(workspace.finance.purchase_orders_ugx)}</p></Card>
                  <Card><p className="text-xs text-muted-foreground">Expenses</p><p className="mt-2 text-lg font-bold">{money(workspace.finance.expenses_ugx)}</p></Card>
                </div>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="font-semibold">Project finance</h3><p className="text-xs text-muted-foreground">All commercial records linked to this project.</p></div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openFinance("quotation")}>New quote</Button>
                      <Button size="sm" variant="outline" onClick={() => openFinance("invoice")}>New invoice</Button>
                      <Button size="sm" variant="outline" onClick={() => openFinance("purchase")}>New PO</Button>
                      <Button size="sm" onClick={() => openFinance("expense")}>Add expense</Button>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Invoices</p>{workspace.finance.invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices.</p> : workspace.finance.invoices.map((item) => <div key={item.id} className="mb-2 flex justify-between rounded-lg border border-border p-3 text-sm"><span>{item.invoice_number}</span><span className="font-semibold">{money(item.amount_ugx)}</span></div>)}</div>
                    <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Expenses</p>{workspace.finance.expenses.length === 0 ? <p className="text-sm text-muted-foreground">No expenses.</p> : workspace.finance.expenses.map((item) => <div key={item.id} className="mb-2 flex justify-between rounded-lg border border-border p-3 text-sm"><span>{item.description}</span><span className="font-semibold">{money(item.amount_ugx)}</span></div>)}</div>
                    <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Quotations</p>{workspace.finance.quotations.length === 0 ? <p className="text-sm text-muted-foreground">No quotations.</p> : workspace.finance.quotations.map((item) => <div key={item.id} className="mb-2 flex justify-between rounded-lg border border-border p-3 text-sm"><span>{item.quotation_number}</span><span>{money(item.amount_ugx)}</span></div>)}</div>
                    <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Purchase orders</p>{workspace.finance.purchase_orders.length === 0 ? <p className="text-sm text-muted-foreground">No purchase orders.</p> : workspace.finance.purchase_orders.map((item) => <div key={item.id} className="mb-2 flex justify-between rounded-lg border border-border p-3 text-sm"><span>{item.po_number} · {item.supplier_name}</span><span>{money(item.amount_ugx)}</span></div>)}</div>
                  </div>
                </Card>
              </div>
            )}

            {tab === "activity" && (
              <Card>
                <div><h3 className="font-semibold">Project activity</h3><p className="text-xs text-muted-foreground">Automatic history from project, task, document and finance changes.</p></div>
                <div className="mt-4 space-y-2">
                  {workspace.activity.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p> : workspace.activity.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
                      <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary"><Activity className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm"><span className="font-medium">{activityLabel(item.table_name)}</span> {item.operation.toLowerCase()}: {item.title}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}{item.changed_by ? ` · ${item.changed_by}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New project" description="Create the project folder with the essentials.">
        <form onSubmit={createProject} className="space-y-4">
          <Input id="project-name" label="Project name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <Input id="project-client" label="Client" value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="project-value" label="Value (UGX)" type="number" value={form.value_ugx} onChange={(e) => setForm((p) => ({ ...p, value_ugx: e.target.value }))} />
            <Input id="project-due" label="Deadline" type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-3"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit">Create project</Button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(financeKind)} onClose={() => setFinanceKind(null)}
        title={financeKind === "quotation" ? "New project quotation" : financeKind === "invoice" ? "New project invoice" : financeKind === "purchase" ? "New project purchase order" : "Add project expense"}
        description="This record will be linked directly to the selected project.">
        <form onSubmit={saveFinance} className="space-y-4">
          {financeKind !== "expense" && (
            <>
              <Input id="finance-number" label="Number" value={financeForm.number || ""} onChange={(e) => setFinanceForm((p) => ({ ...p, number: e.target.value }))} required />
              <Input id="finance-party" label={financeKind === "purchase" ? "Supplier" : "Client"} value={financeForm.party || (financeKind === "purchase" ? "" : workspace?.project.client_name || "")} onChange={(e) => setFinanceForm((p) => ({ ...p, party: e.target.value }))} required />
            </>
          )}
          {financeKind === "expense" && <Input id="finance-description" label="Description" value={financeForm.description || ""} onChange={(e) => setFinanceForm((p) => ({ ...p, description: e.target.value }))} required />}
          <Input id="finance-amount" label="Amount (UGX)" type="number" value={financeForm.amount || ""} onChange={(e) => setFinanceForm((p) => ({ ...p, amount: e.target.value }))} required />
          {financeKind === "invoice" && <Input id="finance-paid" label="Already paid (UGX)" type="number" value={financeForm.paid || ""} onChange={(e) => setFinanceForm((p) => ({ ...p, paid: e.target.value }))} />}
          {financeKind === "expense" && <Input id="finance-category" label="Category" value={financeForm.category || ""} onChange={(e) => setFinanceForm((p) => ({ ...p, category: e.target.value }))} placeholder="Transport, equipment..." />}
          <Input id="finance-date" label="Date" type="date"
            value={financeForm[financeKind === "purchase" ? "order_date" : financeKind === "expense" ? "expense_date" : "issue_date"] || today()}
            onChange={(e) => {
              const key = financeKind === "purchase" ? "order_date" : financeKind === "expense" ? "expense_date" : "issue_date";
              setFinanceForm((p) => ({ ...p, [key]: e.target.value }));
            }} />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setFinanceKind(null)}>Cancel</Button>
            <Button type="submit"><Banknote className="mr-2 h-4 w-4" /> Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
