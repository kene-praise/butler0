import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

type AgentEvent = Tables<"agent_events">;

export default function NotificationsPage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("agent_events")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEvents(data);
  };

  const markRead = async (id: string) => {
    await supabase.from("agent_events").update({ read: true }).eq("id", id);
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
  };

  const markAllRead = async () => {
    await supabase.from("agent_events").update({ read: true }).eq("read", false);
    setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
  };

  const typeIcon: Record<string, string> = {
    reminder: "⏰",
    suggestion: "💡",
    planning: "📋",
    check_in: "👋",
    nudge: "🔔",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Agent nudges and reminders
            </p>
          </div>
          {events.some((e) => !e.read) && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-medium">No notifications</h2>
            <p className="text-sm text-muted-foreground">
              The agent will send you nudges and reminders
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 transition-colors",
                  !event.read ? "bg-accent/50" : "bg-card"
                )}
              >
                <span className="mt-0.5 text-lg">
                  {typeIcon[event.event_type] || "🔔"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{event.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </div>
                {!event.read && (
                  <button
                    onClick={() => markRead(event.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
