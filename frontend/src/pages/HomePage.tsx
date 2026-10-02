import React, { useCallback, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CheckSquare2,
  FileText,
  FolderKanban,
  Plus,
  ScanLine,
  WalletCards,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageError, PageLoading } from "@/components/common/RequestState";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";
import {
  workspaceApi,
  type DocumentRecord,
  type Project,
  type WorkspaceSummary,
} from "@/lib/workspaceApi";
import type { NavItem } from "@/components/layout/Sidebar";

interface HomePageProps {
  onNavigate: (tab: NavItem) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [nextSummary, nextProjects, nextDocuments] = await Promise.all([
        workspaceApi.summary(),
        workspaceApi.projects(),
        workspaceApi.documents(),
      ]);
      setSummary(nextSummary);
      setProjects(nextProjects.slice(0, 4));
      setDocuments(nextDocuments.slice(0, 5));
    } catch (error) {
      setLoadError(getErrorMessage(error, "The home dashboard could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = (user?.full_name || user?.email || "there").split(" ")[0];

  if (isLoading) {
    return <PageLoading label="Loading your Bertcom workspace..." />;
  }

  if (loadError) {
    return <PageError message={loadError} onRetry={load} title="Home is temporarily unavailable" />;
  }

  const stats = [
    {
      label: "Active projects",
      value: summary?.active_projects ?? 0,
      icon: <FolderKanban className="h-5 w-5" />,
    },
    {
      label: "Open tasks",
      value: summary?.pending_tasks ?? 0,
      icon: <CheckSquare2 className="h-5 w-5" />,
    },
    {
      label: "Documents",
      value: summary?.documents ?? 0,
      icon: <FileText className="h-5 w-5" />,
    },
    {
      label: "Outstanding",
      value: money(summary?.outstanding_ugx ?? 0),
      icon: <WalletCards className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Good day, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you need to move Bertcom work forward today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold">{stat.value}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3 text-primary">{stat.icon}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <p className="text-xs text-muted-foreground">Start common work in one click.</p>
          </div>
          {summary?.due_tasks ? (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-600">
              {summary.due_tasks} task{summary.due_tasks === 1 ? "" : "s"} due
            </span>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button className="justify-start gap-2" onClick={() => onNavigate("projects")}>
            <Plus className="h-4 w-4" /> New project
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => onNavigate("documents")}>
            <ScanLine className="h-4 w-4" /> Scan document
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => onNavigate("tasks")}>
            <CheckSquare2 className="h-4 w-4" /> View tasks
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => onNavigate("business")}>
            <BriefcaseBusiness className="h-4 w-4" /> Business
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent projects</h2>
            <button className="text-xs text-primary" onClick={() => onNavigate("projects")}>
              View all
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet. Create the first one.</p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onNavigate("projects")}
                  className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-accent/40"
                >
                  <div>
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.client_name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{project.progress}%</span>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent documents</h2>
            <button className="text-xs text-primary" onClick={() => onNavigate("documents")}>
              Open documents
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              documents.map((document) => (
                <div key={document.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{document.category}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HomePage;
