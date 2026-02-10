import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckSquare, Check, Plus, Trash2, Edit2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;
type Goal = Tables<"goals">;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", status: "todo",
    due_date: "", goal_id: "", notes: "",
  });

  const fetchData = useCallback(async () => {
    const [tasksRes, goalsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("goals").select("*").order("title"),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (goalsRes.data) setGoals(goalsRes.data);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date || null,
      goal_id: form.goal_id || null,
      notes: form.notes.trim() || null,
    };

    if (editTask) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editTask.id);
      if (error) { toast.error("Failed to update task"); return; }
      toast.success("Task updated");
    } else {
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) { toast.error("Failed to create task"); return; }
      toast.success("Task created");
    }

    resetForm();
    fetchData();
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    toast.success("Task deleted");
    fetchData();
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
      goal_id: task.goal_id || "",
      notes: task.notes || "",
    });
    setShowCreate(true);
  };

  const resetForm = () => {
    setForm({ title: "", description: "", priority: "medium", status: "todo", due_date: "", goal_id: "", notes: "" });
    setShowCreate(false);
    setEditTask(null);
  };

  const priorityColor: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-primary/10 text-primary",
    high: "bg-warning/10 text-warning",
    urgent: "bg-destructive/10 text-destructive",
  };

  let filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  if (priorityFilter !== "all") filtered = filtered.filter((t) => t.priority === priorityFilter);

  const goalName = (id: string | null) => goals.find((g) => g.id === id)?.title;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground">Your actionable items</p>
          </div>
          <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editTask ? "Edit Task" : "Create Task"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <Input placeholder="Task title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                <Textarea placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                {goals.length > 0 && (
                  <Select value={form.goal_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, goal_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Link to goal (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No goal</SelectItem>
                      {goals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Textarea placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                <Button onClick={handleSave} className="w-full">
                  {editTask ? "Save Changes" : "Create Task"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex gap-1">
            {["all", "todo", "in_progress", "done"].map((f) => (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="text-xs capitalize">
                {f.replace("_", " ")}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            {["all", "urgent", "high", "medium", "low"].map((p) => (
              <Button key={p} variant={priorityFilter === p ? "secondary" : "ghost"} size="sm" onClick={() => setPriorityFilter(p)} className="text-xs capitalize">
                {p}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckSquare className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-medium">No tasks</h2>
            <p className="text-sm text-muted-foreground">Create a task or chat with the AI</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((task) => (
              <div key={task.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50">
                <button
                  onClick={() => toggleDone(task)}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                    task.status === "done" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 hover:border-primary"
                  )}
                >
                  {task.status === "done" && <Check className="h-3 w-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.due_date && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.goal_id && goalName(task.goal_id) && (
                      <span className="text-xs text-muted-foreground">• {goalName(task.goal_id)}</span>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-xs", priorityColor[task.priority] || "")}>
                  {task.priority}
                </Badge>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(task)} className="p-1 text-muted-foreground hover:text-foreground">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
