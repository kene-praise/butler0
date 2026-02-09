import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch active tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .in("status", ["todo", "in_progress"])
      .order("due_date", { ascending: true });

    // Fetch active goals
    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("status", "active");

    const now = new Date();
    const nudges: { event_type: string; message: string }[] = [];

    // Check overdue tasks
    const overdue = (tasks || []).filter((t) => t.due_date && new Date(t.due_date) < now);
    for (const t of overdue.slice(0, 3)) {
      nudges.push({
        event_type: "reminder",
        message: `⚠️ Task "${t.title}" is overdue (was due ${new Date(t.due_date!).toLocaleDateString()}). Time to tackle it or reschedule?`,
      });
    }

    // Check tasks due within 2 days
    const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const upcoming = (tasks || []).filter(
      (t) => t.due_date && new Date(t.due_date) >= now && new Date(t.due_date) <= twoDays
    );
    for (const t of upcoming.slice(0, 2)) {
      nudges.push({
        event_type: "reminder",
        message: `📅 Task "${t.title}" is due ${new Date(t.due_date!).toLocaleDateString()}. Stay on track!`,
      });
    }

    // Check goal deadlines
    const goalsDueSoon = (goals || []).filter(
      (g) => g.deadline && new Date(g.deadline) <= twoDays && new Date(g.deadline) >= now
    );
    for (const g of goalsDueSoon) {
      nudges.push({
        event_type: "nudge",
        message: `🎯 Goal "${g.title}" deadline is approaching (${new Date(g.deadline!).toLocaleDateString()}). How's your progress?`,
      });
    }

    // If user has pending tasks but none done recently, suggest action
    if ((tasks || []).length > 3 && nudges.length === 0) {
      // Use AI to generate a motivational nudge
      const taskList = (tasks || []).slice(0, 5).map((t) => t.title).join(", ");
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: "You are a brief, encouraging productivity assistant. Generate a single short nudge (max 100 chars) to motivate the user about their pending tasks. Use an emoji.",
            },
            { role: "user", content: `Pending tasks: ${taskList}` },
          ],
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const msg = aiData.choices?.[0]?.message?.content;
        if (msg) {
          nudges.push({ event_type: "suggestion", message: msg.trim() });
        }
      }
    }

    // Save nudges
    if (nudges.length > 0) {
      await supabase.from("agent_events").insert(nudges);
      console.log(`Created ${nudges.length} agent events`);
    } else {
      console.log("No nudges needed");
    }

    return new Response(JSON.stringify({ nudges_created: nudges.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
