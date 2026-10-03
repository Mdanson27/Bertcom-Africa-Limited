import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageError, PageLoading } from "@/components/common/RequestState";
import { SectionNav } from "@/components/common/SectionNav";
import { useCustomToast } from "@/hooks/useCustomToast";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";
import { workspaceApi, type Project, type ProjectTask } from "@/lib/workspaceApi";

type TasksView = "my" | "all" | "today" | "upcoming" | "overdue" | "completed";

const dateOnly = () => new Date().toISOString().slice(0, 10);

export const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccessToast, showErrorToast } = useCustomToast();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<TasksView>("my");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const [nextTasks, nextProjects] = await Promise.all([
        workspaceApi.tasks(),
        workspaceApi.projects(),
      ]);
      setTasks(nextTasks);
      setProjects(nextProjects);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Tasks could not be loaded."));
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = dateOnly();
  const currentEmail = user?.email?.trim().toLowerCase() || "";

  const visibleTasks = tasks.filter((task) => {
    const completed = task.status === "completed";
    const due = task.due_date;

    if (view === "all") return true;
    if (view === "my") return Boolean(currentEmail) && task.assignee_email?.trim().toLowerCase() === currentEmail;
    if (view === "completed") return completed;
    if (view === "today") return !completed && due === today;
    if (view === "upcoming") return !completed && Boolean(due) && due! > today;
    if (view === "overdue") return !completed && Boolean(due) && due! < today;
    return true;
  });

  const taskViews = [
    { id: "my" as const, label: "My Tasks", count: tasks.filter((task) => Boolean(currentEmail) && task.assignee_email?.trim().toLowerCase() === currentEmail).length },
    { id: "all" as const, label: "All Tasks", count: tasks.length },
    { id: "today" as const, label: "Today", count: tasks.filter((task) => task.status !== "completed" && task.due_date === today).length },
    { id: "upcoming" as const, label: "Upcoming", count: tasks.filter((task) => task.status !== "completed" && Boolean(task.due_date) && task.due_date! > today).length },
    { id: "overdue" as const, label: "Overdue", count: tasks.filter((task) => task.status !== "completed" && Boolean(task.due_date) && task.due_date! < today).length },
    { id: "completed" as const, label: "Completed", count: tasks.filter((task) => task.status === "completed").length },
  ];

  const toggle = async (task: ProjectTask) => {
    if (busyTaskId) return;

    setBusyTaskId(task.id);
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await workspaceApi.updateTask(task.id, { status: nextStatus });
      await load(false);
      showSuccessToast(
        nextStatus === "completed" ? "Task marked complete." : "Task reopened.",
        "Task updated",
      );
    } catch (error) {
      showErrorToast(
        getErrorMessage(error, "The task could not be updated."),
        "Task not updated",
      );
    } finally {
      setBusyTaskId(null);
    }
  };

  if (isLoading) {
    return <PageLoading label="Loading tasks..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={loadError}
        onRetry={() => load()}
        title="Tasks are temporarily unavailable"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One simple list of what needs to be done.
        </p>
      </div>

      <SectionNav
        items={taskViews}
        active={view}
        onChange={setView}
        ariaLabel="Task sections"
      />

      {visibleTasks.length === 0 ? (
        <Card className="py-14 text-center">
          <ListTodo className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No tasks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === "my"
              ? "Tasks assigned to you will appear here."
              : "There are no tasks in this section right now."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((task) => {
            const project = projects.find((item) => item.id === task.project_id);
            return (
              <button
                key={task.id}
                onClick={() => void toggle(task)}
                disabled={Boolean(busyTaskId)}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left hover:bg-accent/30 disabled:cursor-wait disabled:opacity-60"
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      task.status === "completed"
                        ? "text-sm line-through text-muted-foreground"
                        : "text-sm font-medium"
                    }
                  >
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {project?.name || "Project"}
                    {task.due_date ? ` - due ${task.due_date}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[10px]">
                  {task.priority}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TasksPage;
