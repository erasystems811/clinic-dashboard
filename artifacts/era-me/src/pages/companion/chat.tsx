import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDiaryEntry, useSendMessage, isCompanionUnlocked } from "@/lib/companion-api";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { account } = useAuth();
  const entryId = parseInt(id, 10);
  const { data: entry, isLoading, refetch } = useDiaryEntry(isNaN(entryId) ? undefined : entryId);
  const sendMessage = useSendMessage(entryId);

  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<{ role: "user" | "assistant"; content: string; temp?: boolean }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimisticMessages, entry?.messages]);

  const messages = entry?.messages ?? [];
  const allMessages = [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    ...optimisticMessages,
  ];

  function handleSend() {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;
    setInput("");

    setOptimisticMessages((p) => [...p, { role: "user" as const, content: text, temp: true }]);

    sendMessage.mutate(text, {
      onSuccess: async ({ reply }) => {
        // Confirm the user message + show AI reply immediately — no flash
        setOptimisticMessages((p) => [
          ...p.map((m) => ({ ...m, temp: false })),
          { role: "assistant" as const, content: reply },
        ]);
        await refetch();
        setOptimisticMessages([]);
      },
      onError: () => {
        setOptimisticMessages((p) => p.filter((m) => !m.temp));
      },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const pageStyle = { background: "var(--bg-base)", minHeight: "100vh" } as const;

  if (isLoading) return (
    <div style={pageStyle} className="flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div style={pageStyle} className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card shrink-0">
        <button onClick={() => navigate("/companion")} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl">💬</span>
          <p className="font-semibold text-foreground text-sm truncate">{entry?.title ?? "Conversation"}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {allMessages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-1">
                <span className="text-sm">💙</span>
              </div>
            )}
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-card border border-border text-foreground rounded-bl-sm"
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-1">
              <span className="text-sm">💙</span>
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card shrink-0 safe-bottom">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something…"
            rows={1}
            className="flex-1 bg-muted rounded-2xl px-4 py-3 text-sm text-foreground outline-none resize-none max-h-32 leading-relaxed"
            style={{ minHeight: "44px" }}
          />
          <button onClick={handleSend} disabled={!input.trim() || sendMessage.isPending}
            className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shrink-0 disabled:opacity-50 transition active:scale-95">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
