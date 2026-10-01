import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { workspaceApi, type Project, type WorkspaceSummary } from "@/lib/workspaceApi";

const money = (value: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(value);

export const ReportsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);

  useEffect(() => {
    void Promise.all([workspaceApi.projects(), workspaceApi.summary()]).then(([p, s]) => { setProjects(p); setSummary(s); });
  }, []);

  const totals = useMemo(() => projects.reduce((acc, project) => ({
    value: acc.value + project.value_ugx,
    paid: acc.paid + project.amount_paid_ugx,
  }), { value: 0, paid: 0 }), [projects]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Reports</h1><p className="mt-1 text-sm text-muted-foreground">A clean management view of work and money.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-xs text-muted-foreground">Project value</p><p className="mt-2 text-xl font-bold">{money(totals.value)}</p></Card>
        <Card><p className="text-xs text-muted-foreground">Received</p><p className="mt-2 text-xl font-bold">{money(totals.paid)}</p></Card>
        <Card><p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-2 text-xl font-bold">{money(summary?.outstanding_ugx || 0)}</p></Card>
        <Card><p className="text-xs text-muted-foreground">Open tasks</p><p className="mt-2 text-xl font-bold">{summary?.pending_tasks ?? ""}</p></Card>
      </div>
      <Card>
        <h2 className="font-semibold">Project performance</h2>
        <div className="mt-4 space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_140px_140px_100px]">
              <div><p className="text-sm font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project.client_name}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Value</p><p className="text-xs font-medium">{money(project.value_ugx)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Outstanding</p><p className="text-xs font-medium">{money(Math.max(0, project.value_ugx - project.amount_paid_ugx))}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Progress</p><p className="text-xs font-medium">{project.progress}%</p></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ReportsPage;
