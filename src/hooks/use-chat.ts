import { useState, useCallback } from "react";
import { streamChat, type ChatMessage } from "@/lib/stream-chat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ExtractionResult } from "@/components/chat/ExtractedItems";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractionResult | null>(null);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) {
      setMessages(
        data.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  }, []);

  const extractItems = useCallback(async (msgs: ChatMessage[]) => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: msgs.slice(-10) }),
        }
      );
      if (!resp.ok) return;
      const data: ExtractionResult = await resp.json();
      const totalItems = (data.goals?.length || 0) + (data.tasks?.length || 0) + (data.milestones?.length || 0);
      if (totalItems > 0) {
        setExtractedItems(data);
      }
    } catch (e) {
      console.error("Extraction failed:", e);
    }
  }, []);

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content: input.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      await supabase.from("chat_messages").insert({
        role: "user",
        content: userMsg.content,
      });

      let assistantSoFar = "";
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      try {
        await streamChat({
          messages: [...messages, userMsg],
          onDelta: upsertAssistant,
          onDone: async () => {
            setIsLoading(false);
            if (assistantSoFar) {
              await supabase.from("chat_messages").insert({
                role: "assistant",
                content: assistantSoFar,
              });
            }
            // Trigger extraction in background
            const allMsgs = [...messages, userMsg, { role: "assistant" as const, content: assistantSoFar }];
            extractItems(allMsgs);
          },
          onError: (error) => {
            setIsLoading(false);
            toast.error(error);
          },
        });
      } catch (e) {
        console.error(e);
        setIsLoading(false);
        toast.error("Something went wrong. Please try again.");
      }
    },
    [messages, isLoading, extractItems]
  );

  const dismissExtracted = useCallback(() => setExtractedItems(null), []);

  return { messages, isLoading, sendMessage, loadMessages, extractedItems, dismissExtracted };
}
