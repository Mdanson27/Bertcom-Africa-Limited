import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { workspaceApi, type Project, type ProjectTask } from "@/lib/workspaceApi";

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const load = async () => {
    const [nextTasks, nextProjects] = await Promise.all([workspaceApi.tasks(), workspaceApi.projects()]);
    setTasks(nextTasks);
    setProjects(nextProjects);
  };

  useEffect(() => { void load(); }, []);

  const toggle = async (task: ProjectTask) => {
    await workspaceApi.updateTask(task.id, { status: task.status === "completed" ? "pending" : "completed" });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">One simple list of what needs to be done.</p>
      </div>
      {tasks.length === 0 ? (
        <Card className="py-14 text-center">
          <ListTodo className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No tasks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add tasks inside a project.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const project = projects.find((item) => item.id === task.project_id);
            return (
              <button key={task.id} onClick={() => void toggle(task)}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left hover:bg-accent/30">
                {task.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className={task.status === "completed" ? "text-sm line-through text-muted-foreground" : "text-sm font-medium"}>{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{project?.name || "Project"}{task.due_date ? ` - due ${task.due_date}` : ""}</p>
                </div>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[10px]">{task.priority}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TasksPage;
