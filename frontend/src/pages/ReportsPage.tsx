import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, ListTodo, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageError, PageLoading } from "@/components/common/RequestState";
import { SectionNav } from "@/components/common/SectionNav";
import { getErrorMessage } from "@/lib/api";
import {
  workspaceApi,
  type BusinessSummary,
  type DocumentRecord,
  type Project,
  type ProjectTask,
  type WorkspaceSummary,
} from "@/lib/workspaceApi";

type ReportsView = "overview" | "projects" | "finance" | "tasks" | "documents" | "activity";

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);

export const ReportsPage: React.FC = () => {
  const [view, setView] = useState<ReportsView>("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [p, t, d, s, b] = await Promise.all([
        workspaceApi.projects(),
        workspaceApi.tasks(),
        workspaceApi.documents(),
        workspaceApi.summary(),
        workspaceApi.businessSummary(),
      ]);
      setProjects(p);
      setTasks(t);
      setDocuments(d);
      setSummary(s);
      setBusiness(b);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Reports could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      projects.reduce(
        (acc, project) => ({
          value: acc.value + project.value_ugx,
          paid: acc.paid + project.amount_paid_ugx,
        }),
        { value: 0, paid: 0 },
      ),
    [projects],
  );

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "projects" as const, label: "Projects" },
    { id: "finance" as const, label: "Finance" },
    { id: "tasks" as const, label: "Tasks" },
    { id: "documents" as const, label: "Documents" },
    { id: "activity" as const, label: "Activity" },
  ];

  if (isLoading) return <PageLoading label="Loading management reports..." />;
  if (loadError) {
    return <PageError message={loadError} onRetry={load} title="Reports are temporarily unavailable" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Management reporting is separated by the type of decision you need to make.
        </p>
      </div>

      <SectionNav items={tabs} active={view} onChange={setView} ariaLabel="Report sections" />

      {view === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><BarChart3 className="h-5 w-5 text-primary" /><p className="mt-4 text-xs text-muted-foreground">Project value</p><p className="mt-2 text-xl font-bold">{money(totals.value)}</p></Card>
          <Card><WalletCards className="h-5 w-5 text-primary" /><p className="mt-4 text-xs text-muted-foreground">Outstanding</p><p className="mt-2 text-xl font-bold">{money(summary?.outstanding_ugx || 0)}</p></Card>
          <Card><ListTodo className="h-5 w-5 text-primary" /><p className="mt-4 text-xs text-muted-foreground">Open tasks</p><p className="mt-2 text-xl font-bold">{summary?.pending_tasks ?? 0}</p></Card>
          <Card><FileText className="h-5 w-5 text-primary" /><p className="mt-4 text-xs text-muted-foreground">Documents</p><p className="mt-2 text-xl font-bold">{documents.length}</p></Card>
        </div>
      )}

      {view === "projects" && (
        <Card>
          <h2 className="font-semibold">Project performance</h2>
          <div className="mt-4 space-y-3">
            {projects.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet.</p> : projects.map((project) => (
              <div key={project.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_140px_140px_100px]">
                <div><p className="text-sm font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project.client_name}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Value</p><p className="text-xs font-medium">{money(project.value_ugx)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Outstanding</p><p className="text-xs font-medium">{money(Math.max(0, project.value_ugx - project.amount_paid_ugx))}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Progress</p><p className="text-xs font-medium">{project.progress}%</p></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {view === "finance" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><p className="text-xs text-muted-foreground">Project value</p><p className="mt-2 text-xl font-bold">{money(totals.value)}</p></Card>
          <Card><p className="text-xs text-muted-foreground">Received</p><p className="mt-2 text-xl font-bold">{money(totals.paid)}</p></Card>
          <Card><p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-2 text-xl font-bold">{money(summary?.outstanding_ugx || 0)}</p></Card>
          <Card><p className="text-xs text-muted-foreground">Expenses recorded</p><p className="mt-2 text-xl font-bold">{money(business?.expenses_ugx || 0)}</p></Card>
        </div>
      )}

      {view === "tasks" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-xs text-muted-foreground">All tasks</p><p className="mt-2 text-2xl font-bold">{tasks.length}</p></Card>
          <Card><p className="text-xs text-muted-foreground">Open</p><p className="mt-2 text-2xl font-bold">{tasks.filter((task) => task.status !== "completed").length}</p></Card>
          <Card><p className="text-xs text-muted-foreground">Completed</p><p className="mt-2 text-2xl font-bold">{tasks.filter((task) => task.status === "completed").length}</p></Card>
        </div>
      )}

      {view === "documents" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-xs text-muted-foreground">All documents</p><p className="mt-2 text-2xl font-bold">{documents.length}</p></Card>
          <Card><p className="text-xs text-muted-foreground">OCR completed</p><p className="mt-2 text-2xl font-bold">{documents.filter((document) => document.ocr_status === "completed").length}</p></Card>
          <Card><p className="text-xs text-muted-foreground">Project documents</p><p className="mt-2 text-2xl font-bold">{documents.filter((document) => Boolean(document.project_id)).length}</p></Card>
        </div>
      )}

      {view === "activity" && (
        <Card className="py-12 text-center">
          <BarChart3 className="mx-auto h-9 w-9 text-muted-foreground" />
          <p className="mt-3 font-medium">Activity reporting area is ready</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Global activity reporting will be populated from the company-wide audit timeline phase. It now has a dedicated home instead of being mixed into other reports.
          </p>
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;
