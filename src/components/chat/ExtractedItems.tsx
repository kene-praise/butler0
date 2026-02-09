import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Target, CheckSquare, Milestone } from "lucide-react";
import { toast } from "sonner";

export interface ExtractedGoal {
  title: string;
  description?: string;
  deadline?: string;
}

export interface ExtractedTask {
  title: string;
  priority?: string;
  due_date?: string;
  goal_title?: string;
}

export interface ExtractedMilestone {
  title: string;
  goal_title?: string;
  due_date?: string;
}

export interface ExtractionResult {
  goals?: ExtractedGoal[];
  tasks?: ExtractedTask[];
  milestones?: ExtractedMilestone[];
}

interface ExtractedItemsProps {
  items: ExtractionResult;
  onDismiss: () => void;
  onSaved: () => void;
}

export function ExtractedItems({ items, onDismiss, onSaved }: ExtractedItemsProps) {
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const allItems: { type: string; key: string; title: string; meta?: string }[] = [];
  items.goals?.forEach((g, i) => allItems.push({ type: "goal", key: `g-${i}`, title: g.title, meta: g.deadline }));
  items.milestones?.forEach((m, i) => allItems.push({ type: "milestone", key: `m-${i}`, title: m.title, meta: m.goal_title }));
  items.tasks?.forEach((t, i) => allItems.push({ type: "task", key: `t-${i}`, title: t.title, meta: t.priority }));

  const activeItems = allItems.filter((it) => !dismissed.has(it.key));
  if (activeItems.length === 0) return null;

  const dismiss = (key: string) => setDismissed((prev) => new Set(prev).add(key));

  const saveAll = async () => {
    setSaving(true);
    try {
      // Save goals first so we can link milestones/tasks
      const goalMap: Record<string, string> = {};
      const goalsToSave = items.goals?.filter((_, i) => !dismissed.has(`g-${i}`)) || [];
      for (const g of goalsToSave) {
        const { data } = await supabase.from("goals").insert({
          title: g.title,
          description: g.description || null,
          deadline: g.deadline || null,
        }).select("id").single();
        if (data) goalMap[g.title] = data.id;
      }

      // Save milestones
      const milestonesToSave = items.milestones?.filter((_, i) => !dismissed.has(`m-${i}`)) || [];
      const milestoneMap: Record<string, string> = {};
      for (const m of milestonesToSave) {
        const goalId = m.goal_title ? goalMap[m.goal_title] : null;
        if (goalId) {
          const { data } = await supabase.from("milestones").insert({
            title: m.title,
            goal_id: goalId,
            due_date: m.due_date || null,
          }).select("id").single();
          if (data) milestoneMap[m.title] = data.id;
        }
      }

      // Save tasks
      const tasksToSave = items.tasks?.filter((_, i) => !dismissed.has(`t-${i}`)) || [];
      for (const t of tasksToSave) {
        const goalId = t.goal_title ? goalMap[t.goal_title] : null;
        await supabase.from("tasks").insert({
          title: t.title,
          priority: t.priority || "medium",
          due_date: t.due_date || null,
          goal_id: goalId || null,
        });
      }

      toast.success(`Saved ${goalsToSave.length + milestonesToSave.length + tasksToSave.length} items`);
      onSaved();
    } catch {
      toast.error("Failed to save items");
    } finally {
      setSaving(false);
    }
  };

  const iconMap: Record<string, React.ReactNode> = {
    goal: <Target className="h-3.5 w-3.5" />,
    milestone: <Milestone className="h-3.5 w-3.5" />,
    task: <CheckSquare className="h-3.5 w-3.5" />,
  };

  const colorMap: Record<string, string> = {
    goal: "bg-success/10 text-success border-success/20",
    milestone: "bg-primary/10 text-primary border-primary/20",
    task: "bg-warning/10 text-warning border-warning/20",
  };

  return (
    <Card className="border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Extracted Items</h3>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 mb-3">
        {activeItems.map((item) => (
          <div key={item.key} className="flex items-center gap-2 rounded-md bg-background p-2 text-sm">
            <Badge variant="outline" className={colorMap[item.type] || ""}>
              <span className="flex items-center gap-1">{iconMap[item.type]} {item.type}</span>
            </Badge>
            <span className="flex-1 truncate font-medium">{item.title}</span>
            {item.meta && <span className="text-xs text-muted-foreground">{item.meta}</span>}
            <button onClick={() => dismiss(item.key)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Button onClick={saveAll} disabled={saving} size="sm" className="w-full gap-1.5">
        <Check className="h-4 w-4" />
        {saving ? "Saving..." : `Save ${activeItems.length} items`}
      </Button>
    </Card>
  );
}
