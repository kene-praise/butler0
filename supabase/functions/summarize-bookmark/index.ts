import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.3") ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const bookmark_id = body?.bookmark_id;

    if (!bookmark_id || typeof bookmark_id !== "string" || !UUID_REGEX.test(bookmark_id)) {
      return new Response(JSON.stringify({ error: "Invalid bookmark_id: must be a valid UUID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: bookmark, error: fetchErr } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("id", bookmark_id)
      .single();

    if (fetchErr || !bookmark) {
      return new Response(JSON.stringify({ error: "Bookmark not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the bookmark URL before fetching
    if (!isValidPublicUrl(bookmark.url)) {
      return new Response(JSON.stringify({ error: "Invalid or unsafe URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the URL content
    let pageText = "";
    try {
      const urlObj = new URL(bookmark.url);
      const isTwitter = urlObj.hostname === "x.com" || urlObj.hostname === "twitter.com" || urlObj.hostname === "www.x.com" || urlObj.hostname === "www.twitter.com";

      if (isTwitter) {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(bookmark.url)}&omit_script=true`;
        const oembedResp = await fetch(oembedUrl);
        if (oembedResp.ok) {
          const oembed = await oembedResp.json();
          pageText = (oembed.html || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (oembed.author_name) {
            pageText = `Tweet by ${oembed.author_name}: ${pageText}`;
          }
        } else {
          pageText = `Twitter/X post at ${bookmark.url}`;
        }
      } else {
        const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
        if (FIRECRAWL_API_KEY) {
          const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: bookmark.url,
              formats: ["markdown"],
              onlyMainContent: true,
              waitFor: 3000,
            }),
          });
          if (scrapeResp.ok) {
            const scrapeData = await scrapeResp.json();
            pageText = (scrapeData.data?.markdown || scrapeData.markdown || "").slice(0, 5000);
          }
        }

        if (!pageText) {
          const pageResp = await fetch(bookmark.url, {
            headers: { "User-Agent": "Mozilla/5.0 AgentOS/1.0" },
          });
          if (pageResp.ok) {
            const html = await pageResp.text();
            pageText = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 5000);
          }
        }
      }
    } catch (e) {
      console.log("Failed to fetch URL content:", e);
      pageText = `URL: ${bookmark.url}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You summarize web content. Return a JSON with: title (string), summary (1-2 sentences), category (one of: read_later, research, implement, watch).",
          },
          {
            role: "user",
            content: `Summarize this page:\nURL: ${bookmark.url}\n\nContent:\n${pageText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "summarize",
              description: "Return structured summary",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  category: { type: "string", enum: ["read_later", "research", "implement", "watch"] },
                },
                required: ["title", "summary", "category"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "summarize" } },
      }),
    });

    if (!aiResp.ok) {
      console.error("AI error:", aiResp.status);
      return new Response(JSON.stringify({ error: "AI summarization failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    await supabase.from("bookmarks").update({
      title: result.title,
      content_summary: result.summary,
      category: result.category,
    }).eq("id", bookmark_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-bookmark error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
