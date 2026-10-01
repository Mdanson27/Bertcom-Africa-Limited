import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, FolderKanban, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { workspaceApi, type Project, type ProjectTask } from "@/lib/workspaceApi";

const money = (value: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(value);

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [form, setForm] = useState({ name: "", client_name: "", value_ugx: "", due_date: "" });

  const load = async () => setProjects(await workspaceApi.projects());
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selected) void workspaceApi.tasks(selected.id).then(setTasks); }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q)) : projects;
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
    await load();
    setSelected(project);
  };

  const addTask = async () => {
    if (!selected || !taskTitle.trim()) return;
    await workspaceApi.createTask({ project_id: selected.id, title: taskTitle.trim(), status: "pending", priority: "normal" });
    setTaskTitle("");
    setTasks(await workspaceApi.tasks(selected.id));
  };

  const toggleTask = async (task: ProjectTask) => {
    await workspaceApi.updateTask(task.id, { status: task.status === "completed" ? "pending" : "completed" });
    if (selected) setTasks(await workspaceApi.tasks(selected.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Client work, money, tasks and documents in one place.</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New project</Button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search project or client..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.length === 0 ? (
            <Card className="md:col-span-2 py-12 text-center">
              <FolderKanban className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-medium">No projects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create the first Bertcom project.</p>
            </Card>
          ) : filtered.map((project) => (
            <button key={project.id} onClick={() => setSelected(project)} className="text-left">
              <Card className={selected?.id === project.id ? "h-full border-primary/60 bg-primary/5" : "h-full hover:border-primary/30"}>
                <p className="text-xs text-muted-foreground">{project.client_name}</p>
                <h2 className="mt-1 font-semibold">{project.name}</h2>
                <div className="mt-4 flex justify-between text-xs"><span>Progress</span><span>{project.progress}%</span></div>
                <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${project.progress}%` }} /></div>
                <div className="mt-4 flex justify-between border-t border-border pt-3 text-xs">
                  <span>{money(project.value_ugx)}</span><span className="text-muted-foreground">{project.due_date || "No deadline"}</span>
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Card className="min-h-[460px]">
          {!selected ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
              <FolderKanban className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Select a project</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground">{selected.client_name}</p>
              <h2 className="mt-1 text-xl font-bold">{selected.name}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Value</p><p className="mt-1 font-semibold">{money(selected.value_ugx)}</p></div>
                <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-1 font-semibold">{money(Math.max(0, selected.value_ugx - selected.amount_paid_ugx))}</p></div>
              </div>
              <div className="mt-6 border-t border-border pt-5">
                <h3 className="font-semibold">Tasks</h3>
                <div className="mt-3 flex gap-2">
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Add a task..."
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
                  <Button size="sm" onClick={addTask}>Add</Button>
                </div>
                <div className="mt-3 space-y-2">
                  {tasks.map((task) => (
                    <button key={task.id} onClick={() => void toggleTask(task)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left">
                      {task.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                      <span className={task.status === "completed" ? "text-sm line-through text-muted-foreground" : "text-sm"}>{task.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New project" description="Start with the essentials.">
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
    </div>
  );
};

export default ProjectsPage;
