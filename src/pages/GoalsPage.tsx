import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Goal = Tables<"goals">;

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    const fetchGoals = async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setGoals(data);
    };
    fetchGoals();
  }, []);

  const statusColor: Record<string, string> = {
    active: "bg-success/10 text-success border-success/20",
    completed: "bg-primary/10 text-primary border-primary/20",
    paused: "bg-warning/10 text-warning border-warning/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Track your goals and milestones
          </p>
        </div>

        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-medium">No goals yet</h2>
            <p className="text-sm text-muted-foreground">
              Chat with the AI to set your first goal
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <Card key={goal.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{goal.title}</CardTitle>
                    <Badge
                      variant="outline"
                      className={statusColor[goal.status] || ""}
                    >
                      {goal.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground">
                      {goal.description}
                    </p>
                  )}
                  {goal.deadline && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Due:{" "}
                      {new Date(goal.deadline).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
