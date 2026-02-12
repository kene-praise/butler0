import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const body = await req.json();
    const message = body?.message;
    if (!message?.text) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Extract URLs from message
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = message.text.match(urlRegex);
    if (!urls || urls.length === 0) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the user associated with this bot by matching the chat_id or bot token
    // We look up which user has this telegram_chat_id
    const chatId = String(message.chat.id);

    // First check if we have a user with this chat_id
    let { data: chatSetting } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("setting_key", "telegram_chat_id")
      .eq("setting_value", chatId)
      .single();

    // If no chat_id mapping yet, try to register it from the bot token context
    if (!chatSetting) {
      // Store the chat_id for all users who have a bot token set
      // (first message from this chat associates it)
      const { data: botUsers } = await supabase
        .from("user_settings")
        .select("user_id")
        .eq("setting_key", "telegram_bot_token");

      if (botUsers && botUsers.length === 1) {
        // Single user with a bot — auto-associate
        const userId = botUsers[0].user_id;
        await supabase.from("user_settings").upsert({
          user_id: userId,
          setting_key: "telegram_chat_id",
          setting_value: chatId,
        }, { onConflict: "user_id,setting_key" });
        chatSetting = { user_id: userId };
      } else {
        console.log("Cannot determine user for chat_id:", chatId);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    }

    const userId = chatSetting.user_id;

    for (const url of urls) {
      // Clean URL (remove trailing punctuation)
      const cleanUrl = url.replace(/[.,;:!?)]+$/, "");

      // Deduplicate: check if this source_id already exists
      const { data: existing } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", userId)
        .eq("source_id", cleanUrl)
        .single();

      if (existing) {
        console.log("Duplicate skipped:", cleanUrl);
        continue;
      }

      // Extract a basic title from the URL
      let title: string;
      try {
        title = new URL(cleanUrl).hostname;
      } catch {
        title = cleanUrl;
      }

      // Insert bookmark
      const { data: newBookmark, error: insertErr } = await supabase
        .from("bookmarks")
        .insert({
          url: cleanUrl,
          title,
          source: "telegram",
          source_id: cleanUrl,
          user_id: userId,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Insert error:", insertErr);
        continue;
      }

      // Trigger summarization (fire-and-forget using service role to call the function)
      if (newBookmark) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        // Create a user-scoped client to call summarize with proper auth
        // We use service role to generate a token-like call
        fetch(`${supabaseUrl}/functions/v1/summarize-bookmark`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ bookmark_id: newBookmark.id }),
        }).catch((e) => console.error("Summarize trigger failed:", e));
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("telegram-webhook error:", e);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});
