import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Send, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDiaryEntry, useSendMessage, isCompanionUnlocked, decodeGesture } from "@/lib/companion-api";
import { cn } from "@/lib/utils";

function formatDateLabel(isoStr: string): string {
  const d = new Date(isoStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const msgDay = new Date(d); msgDay.setHours(0, 0, 0, 0);
  const diff = today.getTime() - msgDay.getTime();
  if (diff === 0) return "Today";
  if (diff === 86400000) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function CompanionDateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function ChatPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { account } = useAuth();
  const entryId = parseInt(id, 10);
  const { data: entry, isLoading, refetch } = useDiaryEntry(isNaN(entryId) ? undefined : entryId);
  const sendMessage = useSendMessage(entryId);

  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<{ role: "user" | "assistant"; content: string; temp?: boolean; created_at: string }[]>([]);
  const [failedText, setFailedText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { applyCompanionTheme, restoreAppTheme } = useAuth();

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  useEffect(() => {
    const raw = localStorage.getItem("era_companion_tab");
    if (raw) {
      const g = decodeGesture(raw);
      if (g.themeColor) applyCompanionTheme(g.themeColor, g.darkMode ?? true);
    }
    return restoreAppTheme;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimisticMessages, entry?.messages]);

  // Poll until the background-generated opening message arrives
  useEffect(() => {
    if (!isLoading && (entry?.messages ?? []).length === 0) {
      const t = setInterval(() => { void refetch(); }, 2000);
      return () => clearInterval(t);
    }
  }, [isLoading, entry?.messages, refetch]);

  // Pin the container to the visual viewport so the keyboard never moves the chat.
  // Rules:
  //   - `top` and `height` are owned exclusively by this effect (direct DOM mutation).
  //   - React's `style` prop on the root div must NOT include `top`, `bottom`, or `height`
  //     so that React re-renders (triggered by user typing) never reset these values.
  //   - useLayoutEffect runs before paint → zero-lag on mount; the resize handler runs
  //     synchronously in the event callback → zero-lag on keyboard show/hide.
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const el = containerRef.current;
    if (!vv || !el) return;
    let prevH = vv.height;

    function update() {
      if (!containerRef.current) return;
      const h = vv!.height;
      containerRef.current.style.height = `${h}px`;
      if (h < prevH) {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
      }
      prevH = h;
    }

    vv.addEventListener("resize", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
    };
  }, []);

  const messages = entry?.messages ?? [];
  const allMessages = [
    ...messages.map((m) => ({ role: m.role, content: m.content, created_at: m.created_at })),
    ...optimisticMessages,
  ];

  function send(text: string) {
    if (!text.trim() || sendMessage.isPending) return;
    setFailedText(null);
    setOptimisticMessages((p) => [...p, { role: "user" as const, content: text, temp: true, created_at: new Date().toISOString() }]);

    sendMessage.mutate(text, {
      onSuccess: async ({ reply }) => {
        setOptimisticMessages((p) => [
          ...p.map((m) => ({ ...m, temp: false })),
          { role: "assistant" as const, content: reply, created_at: new Date().toISOString() },
        ]);
        await refetch();
        setOptimisticMessages([]);
      },
      onError: () => {
        // Keep the user message visible — just remove the temp flag and record it for retry
        setOptimisticMessages((p) => p.filter((m) => !m.temp));
        setFailedText(text);
      },
    });
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    send(text);
  }

  function handleRetry() {
    if (!failedText) return;
    const text = failedText;
    setFailedText(null);
    send(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // top: 0 is static — React owns it. JS owns only `height` via the effect above.
  const rootStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0,
    background: "var(--bg-base)",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
  };

  if (isLoading) return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div ref={containerRef} style={rootStyle}>
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
        {/* Typing indicator while opening message is being generated */}
        {!isLoading && allMessages.length === 0 && (
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
        {(() => {
          const items: React.ReactNode[] = [];
          let lastDay = "";
          allMessages.forEach((m, i) => {
            const day = new Date(m.created_at).toDateString();
            if (day !== lastDay) {
              items.push(<CompanionDateSeparator key={`sep-${day}`} label={formatDateLabel(m.created_at)} />);
              lastDay = day;
            }
            items.push(
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
            );
          });
          return items;
        })()}

        {/* Typing indicator */}
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

        {/* Send failure — show retry */}
        {failedText && !sendMessage.isPending && (
          <div className="flex flex-col items-end gap-2">
            <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed bg-primary/40 text-primary-foreground opacity-70">
              {failedText}
            </div>
            <button onClick={handleRetry}
              className="flex items-center gap-1.5 text-xs text-destructive font-medium px-3 py-1.5 rounded-xl border border-destructive/30 bg-destructive/5 transition active:scale-95">
              <RefreshCw className="w-3 h-3" /> Failed to send — tap to retry
            </button>
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
            className="flex-1 bg-muted rounded-2xl px-4 py-3 text-sm text-foreground outline-none resize-none leading-relaxed"
            style={{ minHeight: "44px", maxHeight: "40vh" }}
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
