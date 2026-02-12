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

    // Determine user context: either from auth header (manual trigger) or process all users (cron)
    let userIds: string[] = [];
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      // Manual trigger: validate user and scope to their data
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userIds = [claimsData.claims.sub as string];
    } else {
      // Cron trigger: get all users who have data
      const { data: users } = await supabase
        .from("tasks")
        .select("user_id")
        .not("user_id", "is", null);
      const uniqueIds = [...new Set((users || []).map((u) => u.user_id).filter(Boolean))];
      userIds = uniqueIds as string[];
    }

    let totalNudges = 0;

    for (const userId of userIds) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true });

      const { data: goals } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active");

      const now = new Date();
      const nudges: { event_type: string; message: string; user_id: string }[] = [];

      const overdue = (tasks || []).filter((t) => t.due_date && new Date(t.due_date) < now);
      for (const t of overdue.slice(0, 3)) {
        nudges.push({
          event_type: "reminder",
          message: `⚠️ Task "${t.title}" is overdue (was due ${new Date(t.due_date!).toLocaleDateString()}). Time to tackle it or reschedule?`,
          user_id: userId,
        });
      }

      const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const upcoming = (tasks || []).filter(
        (t) => t.due_date && new Date(t.due_date) >= now && new Date(t.due_date) <= twoDays
      );
      for (const t of upcoming.slice(0, 2)) {
        nudges.push({
          event_type: "reminder",
          message: `📅 Task "${t.title}" is due ${new Date(t.due_date!).toLocaleDateString()}. Stay on track!`,
          user_id: userId,
        });
      }

      const goalsDueSoon = (goals || []).filter(
        (g) => g.deadline && new Date(g.deadline) <= twoDays && new Date(g.deadline) >= now
      );
      for (const g of goalsDueSoon) {
        nudges.push({
          event_type: "nudge",
          message: `🎯 Goal "${g.title}" deadline is approaching (${new Date(g.deadline!).toLocaleDateString()}). How's your progress?`,
          user_id: userId,
        });
      }

      if ((tasks || []).length > 3 && nudges.length === 0) {
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
            nudges.push({ event_type: "suggestion", message: msg.trim(), user_id: userId });
          }
        }
      }

      if (nudges.length > 0) {
        await supabase.from("agent_events").insert(nudges);
        totalNudges += nudges.length;
      }
    }

    console.log(`Created ${totalNudges} agent events for ${userIds.length} user(s)`);

    return new Response(JSON.stringify({ nudges_created: totalNudges }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-check error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
