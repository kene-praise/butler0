import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json();
    const { action, bot_token } = body;

    if (action === "connect") {
      if (!bot_token || typeof bot_token !== "string" || bot_token.length < 20) {
        return new Response(JSON.stringify({ error: "Invalid bot token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store the bot token
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

      await adminSupabase.from("user_settings").upsert({
        user_id: userId,
        setting_key: "telegram_bot_token",
        setting_value: bot_token,
      }, { onConflict: "user_id,setting_key" });

      // Register webhook with Telegram
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
      const telegramResp = await fetch(
        `https://api.telegram.org/bot${bot_token}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl }),
        }
      );

      const telegramResult = await telegramResp.json();

      if (!telegramResult.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to register webhook with Telegram", details: telegramResult }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store connection status
      await adminSupabase.from("user_settings").upsert({
        user_id: userId,
        setting_key: "telegram_connected",
        setting_value: "true",
      }, { onConflict: "user_id,setting_key" });

      return new Response(
        JSON.stringify({ success: true, message: "Telegram bot connected!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      // Get the stored bot token
      const { data: tokenSetting } = await supabase
        .from("user_settings")
        .select("setting_value")
        .eq("setting_key", "telegram_bot_token")
        .single();

      if (tokenSetting?.setting_value) {
        // Remove webhook from Telegram
        await fetch(
          `https://api.telegram.org/bot${tokenSetting.setting_value}/deleteWebhook`,
          { method: "POST" }
        ).catch(() => {});
      }

      // Remove settings
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

      await adminSupabase.from("user_settings").delete()
        .eq("user_id", userId)
        .in("setting_key", ["telegram_bot_token", "telegram_connected", "telegram_chat_id"]);

      return new Response(
        JSON.stringify({ success: true, message: "Telegram bot disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { data: connSetting } = await supabase
        .from("user_settings")
        .select("setting_value")
        .eq("setting_key", "telegram_connected")
        .single();

      return new Response(
        JSON.stringify({ connected: connSetting?.setting_value === "true" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-setup error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
