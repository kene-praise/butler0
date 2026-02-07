import { useState, useCallback } from "react";
import { streamChat, type ChatMessage } from "@/lib/stream-chat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content: input.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Save user message
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
            // Save assistant message
            if (assistantSoFar) {
              await supabase.from("chat_messages").insert({
                role: "assistant",
                content: assistantSoFar,
              });
            }
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
    [messages, isLoading]
  );

  return { messages, isLoading, sendMessage, loadMessages };
}
