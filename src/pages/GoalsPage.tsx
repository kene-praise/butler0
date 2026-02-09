import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Target, Plus, ChevronRight, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Goal = Tables<"goals">;
type Milestone = Tables<"milestones">;
type Task = Tables<"tasks">;

type GoalWithChildren = Goal & {
  milestones: (Milestone & { tasks: Task[] })[];
  tasks: Task[];
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithChildren[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", status: "active" });

  const fetchGoals = useCallback(async () => {
    const [goalsRes, milestonesRes, tasksRes] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
    ]);

    const milestones = milestonesRes.data || [];
    const tasks = tasksRes.data || [];

    const enriched: GoalWithChildren[] = (goalsRes.data || []).map((g) => {
      const goalMilestones = milestones.filter((m) => m.goal_id === g.id);
      const goalTasks = tasks.filter((t) => t.goal_id === g.id && !t.milestone_id);
      return {
        ...g,
        milestones: goalMilestones.map((m) => ({
          ...m,
          tasks: tasks.filter((t) => t.milestone_id === m.id),
        })),
        tasks: goalTasks,
      };
    });

    setGoals(enriched);
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const calcProgress = (goal: GoalWithChildren) => {
    const allTasks = [
      ...goal.tasks,
      ...goal.milestones.flatMap((m) => m.tasks),
    ];
    if (allTasks.length === 0) return 0;
    const done = allTasks.filter((t) => t.status === "done").length;
    return Math.round((done / allTasks.length) * 100);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      deadline: form.deadline || null,
      status: form.status,
    };

    if (editGoal) {
      const { error } = await supabase.from("goals").update(payload).eq("id", editGoal.id);
      if (error) { toast.error("Failed to update goal"); return; }
      toast.success("Goal updated");
    } else {
      const { error } = await supabase.from("goals").insert(payload);
      if (error) { toast.error("Failed to create goal"); return; }
      toast.success("Goal created");
    }

    setForm({ title: "", description: "", deadline: "", status: "active" });
    setShowCreate(false);
    setEditGoal(null);
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("tasks").delete().eq("goal_id", id);
    const { data: milestones } = await supabase.from("milestones").select("id").eq("goal_id", id);
    if (milestones) {
      for (const m of milestones) {
        await supabase.from("tasks").delete().eq("milestone_id", m.id);
      }
    }
    await supabase.from("milestones").delete().eq("goal_id", id);
    await supabase.from("goals").delete().eq("id", id);
    toast.success("Goal deleted");
    fetchGoals();
  };

  const openEdit = (goal: Goal) => {
    setEditGoal(goal);
    setForm({
      title: goal.title,
      description: goal.description || "",
      deadline: goal.deadline ? goal.deadline.split("T")[0] : "",
      status: goal.status,
    });
    setShowCreate(true);
  };

  const statusColor: Record<string, string> = {
    active: "bg-success/10 text-success border-success/20",
    completed: "bg-primary/10 text-primary border-primary/20",
    paused: "bg-warning/10 text-warning border-warning/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
            <p className="text-sm text-muted-foreground">Track your goals and milestones</p>
          </div>
          <Dialog open={showCreate} onOpenChange={(open) => {
            setShowCreate(open);
            if (!open) { setEditGoal(null); setForm({ title: "", description: "", deadline: "", status: "active" }); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> New Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editGoal ? "Edit Goal" : "Create Goal"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <Input
                  placeholder="Goal title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSave} className="w-full">
                  {editGoal ? "Save Changes" : "Create Goal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-medium">No goals yet</h2>
            <p className="text-sm text-muted-foreground">
              Create a goal or chat with the AI to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const progress = calcProgress(goal);
              const isOpen = expanded.has(goal.id);
              const childCount = goal.milestones.length + goal.tasks.length;

              return (
                <Collapsible key={goal.id} open={isOpen} onOpenChange={() => toggleExpand(goal.id)}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {childCount > 0 && (
                            <CollapsibleTrigger asChild>
                              <button className="mt-1 shrink-0">
                                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                              </button>
                            </CollapsibleTrigger>
                          )}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base">{goal.title}</CardTitle>
                            {goal.description && (
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{goal.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={statusColor[goal.status] || ""}>{goal.status}</Badge>
                          <button onClick={() => openEdit(goal)} className="p-1 text-muted-foreground hover:text-foreground">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteGoal(goal.id)} className="p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
                      </div>
                      {goal.deadline && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Due: {new Date(goal.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>

                    <CollapsibleContent>
                      <div className="border-t border-border px-6 py-3 space-y-3">
                        {goal.milestones.map((ms) => (
                          <div key={ms.id}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                              <span className="text-sm font-medium">{ms.title}</span>
                              <Badge variant="outline" className="text-xs ml-auto">{ms.status}</Badge>
                            </div>
                            {ms.tasks.length > 0 && (
                              <div className="ml-4 space-y-1">
                                {ms.tasks.map((t) => (
                                  <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", t.status === "done" ? "bg-success" : "bg-muted-foreground/30")} />
                                    <span className={cn(t.status === "done" && "line-through")}>{t.title}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {goal.tasks.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Standalone Tasks</span>
                            {goal.tasks.map((t) => (
                              <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <div className={cn("h-1.5 w-1.5 rounded-full", t.status === "done" ? "bg-success" : "bg-muted-foreground/30")} />
                                <span className={cn(t.status === "done" && "line-through")}>{t.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {childCount === 0 && (
                          <p className="text-sm text-muted-foreground italic">No milestones or tasks yet</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
