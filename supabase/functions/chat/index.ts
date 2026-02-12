import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are AgentOS — a proactive AI execution assistant. Your job is to help users turn their thoughts into actionable plans.

When a user shares goals, ideas, or plans:
1. Acknowledge what they want to accomplish
2. Break it down into clear, actionable steps
3. Suggest deadlines and priorities when appropriate
4. Be encouraging but practical

You have memory of the user's current goals, tasks, and recent conversations. Reference them naturally when relevant — remind the user of related goals, suggest connections between tasks, and proactively check in on progress.

Keep responses concise and action-oriented. Use bullet points for tasks and steps.
Don't be overly verbose — respect the user's time.`;

function validateMessages(messages: unknown): { role: string; content: string }[] | null {
  if (!Array.isArray(messages)) return null;
  if (messages.length === 0 || messages.length > 50) return null;
  
  for (const msg of messages) {
    if (typeof msg !== "object" || msg === null) return null;
    if (!["user", "assistant", "system"].includes(msg.role)) return null;
    if (typeof msg.content !== "string") return null;
    if (msg.content.length === 0 || msg.content.length > 10000) return null;
  }
  return messages as { role: string; content: string }[];
}

async function buildMemoryContext(supabase: ReturnType<typeof createClient>): Promise<string> {
  const parts: string[] = [];

  const { data: goals } = await supabase
    .from("goals")
    .select("title, status, deadline, description")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  if (goals?.length) {
    parts.push("## Active Goals\n" + goals.map((g) =>
      `- ${g.title}${g.deadline ? ` (deadline: ${new Date(g.deadline).toLocaleDateString()})` : ""}${g.description ? `: ${g.description}` : ""}`
    ).join("\n"));
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, priority, due_date")
    .in("status", ["todo", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(15);

  if (tasks?.length) {
    parts.push("## Pending Tasks\n" + tasks.map((t) =>
      `- [${t.priority}] ${t.title} (${t.status})${t.due_date ? ` — due ${new Date(t.due_date).toLocaleDateString()}` : ""}`
    ).join("\n"));
  }

  const { data: nudges } = await supabase
    .from("agent_events")
    .select("message, event_type")
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(5);

  if (nudges?.length) {
    parts.push("## Unread Nudges\n" + nudges.map((n) => `- ${n.message}`).join("\n"));
  }

  if (parts.length === 0) return "";
  return "\n\n--- USER CONTEXT (from memory) ---\n" + parts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const messages = validateMessages(body?.messages);
    if (!messages) {
      return new Response(
        JSON.stringify({ error: "Invalid input: messages must be an array of {role, content} objects (max 50, content max 10000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const memoryContext = await buildMemoryContext(supabase);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + memoryContext },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add AI credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
