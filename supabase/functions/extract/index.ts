import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a task extraction engine. Analyze the conversation and extract any goals, milestones, and tasks mentioned. 

Return structured data using the extract_items tool. Only extract items that the user explicitly mentions wanting to do. Don't invent items.

Guidelines:
- Goals are high-level objectives (e.g. "Launch my SaaS", "Learn Spanish")
- Milestones are checkpoints within a goal (e.g. "Complete MVP", "Pass B1 exam")
- Tasks are specific actionable items (e.g. "Set up landing page", "Practice vocabulary 30 min daily")
- If a task clearly belongs to a goal mentioned in the same conversation, set goal_title to match
- Priority should be "low", "medium", "high", or "urgent" based on context
- Dates should be ISO format (YYYY-MM-DD) when mentioned`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
        JSON.stringify({ error: "Invalid input: messages must be an array of {role, content} objects" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_items",
              description: "Extract goals, milestones, and tasks from the conversation",
              parameters: {
                type: "object",
                properties: {
                  goals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        deadline: { type: "string" },
                      },
                      required: ["title"],
                    },
                  },
                  milestones: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        goal_title: { type: "string" },
                        due_date: { type: "string" },
                      },
                      required: ["title"],
                    },
                  },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                        due_date: { type: "string" },
                        goal_title: { type: "string" },
                      },
                      required: ["title"],
                    },
                  },
                },
                required: ["goals", "milestones", "tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_items" } },
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ goals: [], milestones: [], tasks: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
