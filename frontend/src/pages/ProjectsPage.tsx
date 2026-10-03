import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowLeft, Banknote, CheckCircle2, Circle, Download, FileText, FolderKanban,
  ListTodo, Plus, Search, UploadCloud, WalletCards,
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
  uploadToPresignedUrl,
  workspaceApi,
  type DocumentRecord,
  type Project,
  type ProjectTask,
  type ProjectWorkspace,
} from "@/lib/workspaceApi";

type ProjectsView = "overview" | "all" | "active" | "planning" | "on_hold" | "completed" | "archived";
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
  const { showSuccessToast, showErrorToast, showWarningToast } = useCustomToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sectionView, setSectionView] = useState<ProjectsView>("overview");
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
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);
  const [financeSaving, setFinanceSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const createDirty = createOpen && Object.values(form).some((value) => value.trim() !== "");
  const financeDirty = Boolean(financeKind) && Object.values(financeForm).some((value) => value.trim() !== "");
  useUnsavedChanges(createDirty || financeDirty);

  const loadProjects = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await workspaceApi.projects();
      setProjects(rows);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Projects could not be loaded."));
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const loadWorkspace = useCallback(async (id: string) => {
    if (!id) {
      setWorkspace(null);
      return;
    }
    setWorkspaceLoading(true);
    setLoadError(null);
    try {
      setWorkspace(await workspaceApi.projectWorkspace(id));
    } catch (error) {
      setLoadError(getErrorMessage(error, "The project workspace could not be loaded."));
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedId) void loadWorkspace(selectedId);
    else setWorkspace(null);
  }, [loadWorkspace, selectedId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return projects.filter((project) => {
      const matchesSearch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.client_name.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (sectionView === "archived") return project.is_archived;
      if (project.is_archived) return false;
      if (sectionView === "overview" || sectionView === "all") return true;
      return project.status === sectionView;
    });
  }, [projects, query, sectionView]);

  const listedProjects = useMemo(() => {
    if (sectionView !== "overview" || query.trim()) return filtered;
    return [...filtered]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [filtered, query, sectionView]);

  const projectCounts = useMemo(() => ({
    all: projects.filter((project) => !project.is_archived).length,
    active: projects.filter((project) => !project.is_archived && project.status === "active").length,
    planning: projects.filter((project) => !project.is_archived && project.status === "planning").length,
    on_hold: projects.filter((project) => !project.is_archived && project.status === "on_hold").length,
    completed: projects.filter((project) => !project.is_archived && project.status === "completed").length,
    archived: projects.filter((project) => project.is_archived).length,
  }), [projects]);

  const projectViews = [
    { id: "overview" as const, label: "Overview" },
    { id: "all" as const, label: "All Projects", count: projectCounts.all },
    { id: "active" as const, label: "Active", count: projectCounts.active },
    { id: "planning" as const, label: "Planning", count: projectCounts.planning },
    { id: "on_hold" as const, label: "On Hold", count: projectCounts.on_hold },
    { id: "completed" as const, label: "Completed", count: projectCounts.completed },
    { id: "archived" as const, label: "Archived", count: projectCounts.archived },
  ];

  const changeSectionView = (view: ProjectsView) => {
    setSectionView(view);
    setSelectedId("");
    setWorkspace(null);
    setTab("overview");
  };

  const sectionLabel = projectViews.find((item) => item.id === sectionView)?.label || "Projects";
  const visibleValue = filtered.reduce((total, project) => total + project.value_ugx, 0);
  const visibleOutstanding = filtered.reduce(
    (total, project) => total + Math.max(0, project.value_ugx - project.amount_paid_ugx),
    0,
  );

  const closeCreate = () => {
    if (createSaving) return;
    if (!confirmDiscardChanges(createDirty, "Discard this new project?")) return;
    setCreateOpen(false);
    setForm({ name: "", client_name: "", value_ugx: "", due_date: "" });
  };

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createSaving) return;

    const name = form.name.trim();
    const clientName = form.client_name.trim();
    const value = Number(form.value_ugx || 0);

    if (!name || !clientName) {
      showWarningToast("Project name and client are required.", "Check project details");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      showWarningToast("Project value must be zero or a positive amount.", "Check project value");
      return;
    }

    setCreateSaving(true);
    try {
      const project = await workspaceApi.createProject({
        name,
        client_name: clientName,
        value_ugx: value,
        due_date: form.due_date || null,
        status: "planning",
        progress: 0,
      });
      setForm({ name: "", client_name: "", value_ugx: "", due_date: "" });
      setCreateOpen(false);
      await loadProjects(false);
      setSelectedId(project.id);
      setTab("overview");
      showSuccessToast(`${project.name} was created successfully.`, "Project created");
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The project could not be created."), "Project not saved");
    } finally {
      setCreateSaving(false);
    }
  };

  const addTask = async () => {
    if (!workspace || !taskTitle.trim() || taskBusyId) return;
    setTaskBusyId("new");
    try {
      await workspaceApi.createTask({
        project_id: workspace.project.id,
        title: taskTitle.trim(),
        status: "pending",
        priority: "normal",
      });
      setTaskTitle("");
      await loadWorkspace(workspace.project.id);
      showSuccessToast("Task added to the project.", "Task created");
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The task could not be created."), "Task not saved");
    } finally {
      setTaskBusyId(null);
    }
  };

  const toggleTask = async (task: ProjectTask) => {
    if (taskBusyId) return;
    setTaskBusyId(task.id);
    try {
      await workspaceApi.updateTask(task.id, {
        status: task.status === "completed" ? "pending" : "completed",
      });
      if (workspace) await loadWorkspace(workspace.project.id);
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The task could not be updated."), "Task not updated");
    } finally {
      setTaskBusyId(null);
    }
  };

  const uploadDocument = async (file: File) => {
    if (!workspace || docBusy) return;
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
      await loadWorkspace(workspace.project.id);
      showSuccessToast(`${file.name} was attached to the project.`, "Document uploaded");
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The document could not be uploaded."), "Upload failed");
    } finally {
      setDocBusy(false);
    }
  };

  const openDocument = async (document: DocumentRecord) => {
    try {
      const result = await workspaceApi.downloadDocument(document.id);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      showErrorToast(getErrorMessage(error, "The document could not be opened."), "Open failed");
    }
  };

  const openFinance = (kind: FinanceKind) => {
    const dateField = kind === "purchase" ? "order_date" : kind === "expense" ? "expense_date" : "issue_date";
    setFinanceForm({ [dateField]: today() });
    setFinanceKind(kind);
  };

  const closeFinance = () => {
    if (financeSaving) return;
    if (!confirmDiscardChanges(financeDirty, "Discard this unsaved financial record?")) return;
    setFinanceKind(null);
    setFinanceForm({});
  };

  const saveFinance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!financeKind || !workspace || financeSaving) return;

    const amount = Number(financeForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      showWarningToast("Enter an amount greater than zero.", "Check amount");
      return;
    }

    if (
      financeKind !== "expense" &&
      (!financeForm.number?.trim() || !(financeForm.party || workspace.project.client_name).trim())
    ) {
      showWarningToast("Number and client/supplier are required.", "Check details");
      return;
    }

    if (financeKind === "expense" && !financeForm.description?.trim()) {
      showWarningToast("Add a short expense description.", "Check details");
      return;
    }

    setFinanceSaving(true);
    const project = workspace.project;
    const common = { project_id: project.id };

    try {
      if (financeKind === "quotation") {
        await workspaceApi.createQuotation({
          ...common,
          quotation_number: financeForm.number.trim(),
          client_name: (financeForm.party || project.client_name).trim(),
          amount_ugx: amount,
          issue_date: financeForm.issue_date || today(),
          status: "draft",
        });
      } else if (financeKind === "invoice") {
        await workspaceApi.createInvoice({
          ...common,
          invoice_number: financeForm.number.trim(),
          client_name: (financeForm.party || project.client_name).trim(),
          amount_ugx: amount,
          paid_amount_ugx: Number(financeForm.paid || 0),
          issue_date: financeForm.issue_date || today(),
          due_date: financeForm.due_date || null,
          status: "draft",
        });
      } else if (financeKind === "purchase") {
        await workspaceApi.createPurchaseOrder({
          ...common,
          po_number: financeForm.number.trim(),
          supplier_name: (financeForm.party || "").trim(),
          amount_ugx: amount,
          order_date: financeForm.order_date || today(),
          status: "draft",
        });
      } else {
        await workspaceApi.createExpense({
          ...common,
          description: financeForm.description.trim(),
          amount_ugx: amount,
          expense_date: financeForm.expense_date || today(),
          category: financeForm.category || "general",
          reference: financeForm.reference || null,
        });
      }

      const savedKind = financeKind;
      setFinanceKind(null);
      setFinanceForm({});
      await loadWorkspace(project.id);
      showSuccessToast(
        savedKind === "expense" ? "Expense added to the project." : "Financial record saved.",
        "Saved",
      );
    } catch (error) {
      showErrorToast(
        getErrorMessage(error, "The financial record could not be saved."),
        "Not saved",
      );
    } finally {
      setFinanceSaving(false);
    }
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: FolderKanban },
    { id: "tasks" as const, label: "Tasks", icon: ListTodo },
    { id: "documents" as const, label: "Documents", icon: FileText },
    { id: "finance" as const, label: "Finance", icon: WalletCards },
    { id: "activity" as const, label: "Activity", icon: Activity },
  ];

  const doneTasks = workspace?.tasks.filter((task) => task.status === "completed").length ?? 0;

  if (isLoading) {
    return <PageLoading label="Loading projects..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={loadError}
        onRetry={async () => {
          await loadProjects();
          if (selectedId) await loadWorkspace(selectedId);
        }}
        title="Projects are temporarily unavailable"
      />
    );
  }

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

      <SectionNav
        items={projectViews}
        active={sectionView}
        onChange={changeSectionView}
        ariaLabel="Projects sections"
      />

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
            {listedProjects.length === 0 ? (
              <Card className="py-10 text-center">
                <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No projects yet</p>
              </Card>
            ) : listedProjects.map((project) => (
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

        {workspaceLoading ? (
          <PageLoading label="Opening project workspace..." />
        ) : !workspace ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <p className="text-xs text-muted-foreground">{sectionLabel}</p>
                <p className="mt-2 text-2xl font-bold">{filtered.length}</p>
              </Card>
              <Card>
                <p className="text-xs text-muted-foreground">Visible project value</p>
                <p className="mt-2 text-lg font-bold">{money(visibleValue)}</p>
              </Card>
              <Card>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="mt-2 text-lg font-bold">{money(visibleOutstanding)}</p>
              </Card>
              <Card>
                <p className="text-xs text-muted-foreground">Projects needing action</p>
                <p className="mt-2 text-2xl font-bold">
                  {filtered.filter((project) => project.progress < 100 && project.status !== "completed").length}
                </p>
              </Card>
            </div>
            <Card className="min-h-[340px] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{sectionLabel}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This is the company-level Projects area. Select a project on the left only when you want to open its working folder.
                  </p>
                </div>
                <span className="rounded-full bg-accent px-3 py-1 text-xs text-muted-foreground">
                  Section dashboard
                </span>
              </div>
              <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
                <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-medium">Project management area</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                  Use the section tabs above to move between all projects, active work, planning, on-hold work, completed work and the archive.
                  Opening a project is now a separate action from managing the Projects section.
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div className="min-w-0 space-y-5">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-2"
              onClick={() => {
                setSelectedId("");
                setWorkspace(null);
                setTab("overview");
              }}
            >
              <ArrowLeft className="h-4 w-4" /> Back to {sectionLabel}
            </Button>
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
                    <Button size="sm" isLoading={taskBusyId === "new"} onClick={() => void addTask()}>Add</Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {workspace.tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet.</p> : workspace.tasks.map((task) => (
                    <button key={task.id} onClick={() => void toggleTask(task)}
                      disabled={Boolean(taskBusyId)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-accent/30 disabled:cursor-wait disabled:opacity-60">
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

      <Modal isOpen={createOpen} onClose={closeCreate} title="New project" description="Create the project folder with the essentials.">
        <form onSubmit={createProject} className="space-y-4">
          <Input id="project-name" label="Project name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <Input id="project-client" label="Client" value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="project-value" label="Value (UGX)" type="number" value={form.value_ugx} onChange={(e) => setForm((p) => ({ ...p, value_ugx: e.target.value }))} />
            <Input id="project-due" label="Deadline" type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-3"><Button type="button" variant="outline" onClick={closeCreate} disabled={createSaving}>Cancel</Button><Button type="submit" isLoading={createSaving}>Create project</Button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(financeKind)} onClose={closeFinance}
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
            <Button type="button" variant="outline" onClick={closeFinance} disabled={financeSaving}>Cancel</Button>
            <Button type="submit" isLoading={financeSaving}><Banknote className="mr-2 h-4 w-4" /> Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
