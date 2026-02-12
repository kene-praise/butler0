import { useEffect, useState } from "react";
import { Settings, Send, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const [botToken, setBotToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const callSetup = async (body: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-setup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      }
    );
    return resp.json();
  };

  const checkStatus = async () => {
    try {
      const result = await callSetup({ action: "status" });
      setConnected(result.connected === true);
    } catch {
      // Not logged in or error
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!botToken.trim()) return;
    setConnecting(true);
    try {
      const result = await callSetup({ action: "connect", bot_token: botToken.trim() });
      if (result.success) {
        toast.success("Telegram bot connected!");
        setConnected(true);
        setBotToken("");
      } else {
        toast.error(result.error || "Failed to connect");
      }
    } catch {
      toast.error("Failed to connect bot");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    try {
      const result = await callSetup({ action: "disconnect" });
      if (result.success) {
        toast.success("Telegram bot disconnected");
        setConnected(false);
      }
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your assistant</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Telegram Integration</CardTitle>
                  <CardDescription>Forward tweets & links to Butler via Telegram</CardDescription>
                </div>
              </div>
              {!loading && (
                <Badge variant={connected ? "default" : "outline"} className={connected ? "bg-success/10 text-success border-success/20" : ""}>
                  {connected ? (
                    <><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</>
                  ) : (
                    <><XCircle className="mr-1 h-3 w-3" /> Disconnected</>
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {connected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your Telegram bot is connected. Forward any tweet or link to your bot and it'll appear in your Content Queue automatically.
                </p>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={connecting}>
                  {connecting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  Disconnect Bot
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
                  <p className="font-medium">How to set up:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Open Telegram and message <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">@BotFather <ExternalLink className="h-3 w-3" /></a></li>
                    <li>Send <code className="rounded bg-muted px-1 py-0.5">/newbot</code> and follow the prompts</li>
                    <li>Copy the bot token and paste it below</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="Paste your bot token here..."
                    className="rounded-xl"
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  />
                  <Button onClick={handleConnect} disabled={connecting || !botToken.trim()} className="shrink-0 rounded-xl">
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
          <Settings className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h2 className="mb-1 text-lg font-medium">More settings coming soon</h2>
          <p className="text-sm text-muted-foreground">
            Preferences, notifications, and more integrations
          </p>
        </div>
      </div>
    </div>
  );
}
