import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ExtractedItems } from "@/components/chat/ExtractedItems";
import { Zap } from "lucide-react";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, loadMessages, extractedItems, dismissExtracted } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
          <div className="mx-auto max-w-3xl">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                  <Zap className="h-7 w-7 text-primary-foreground" />
                </div>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight">
                  What do you want to accomplish?
                </h1>
                <p className="max-w-md text-sm text-muted-foreground">
                  Tell me your goals, brain dump your ideas, or share what you're working on. I'll help you break it down into actionable tasks.
                </p>
              </div>
            ) : (
              <div className="py-4">
                {messages.map((msg, i) => (
                  <ChatMessage key={i} role={msg.role} content={msg.content} />
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-3 py-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                      <Zap className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="rounded-2xl bg-secondary px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:0.2s]" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Extracted items sidebar */}
        {extractedItems && (
          <div className="w-80 shrink-0 border-l border-border overflow-y-auto p-4">
            <ExtractedItems
              items={extractedItems}
              onDismiss={dismissExtracted}
              onSaved={dismissExtracted}
            />
          </div>
        )}
      </div>

      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
