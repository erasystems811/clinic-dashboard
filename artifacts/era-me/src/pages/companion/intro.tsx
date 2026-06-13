import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { sendIntroMessage, useCompleteIntro } from "@/lib/companion-api";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string }

interface Props {
  themeColor?: string;
  onComplete: () => void;
}

export default function CompanionIntro({ themeColor, onComplete }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // When AI says [NAME_ME], show the embedded name input instead of the text box
  const [showNameInput, setShowNameInput] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const completeIntro = useCompleteIntro();

  // Kick off the conversation on mount
  useEffect(() => {
    void fetchAI([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, showNameInput]);

  useEffect(() => {
    if (showNameInput) nameInputRef.current?.focus();
    else if (!isLoading) inputRef.current?.focus();
  }, [showNameInput, isLoading]);

  async function fetchAI(history: Msg[]) {
    setIsLoading(true);
    try {
      const raw = await sendIntroMessage(history, themeColor);
      handleAIReply(raw, history);
    } catch {
      // fallback if AI errors
      handleAIReply("Hey! I'm really happy you're here. What's your name?", history);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAIReply(raw: string, history: Msg[]) {
    const hasNameMe = raw.includes("[NAME_ME]");
    const introMatch = raw.match(/\[INTRO_COMPLETE\]\s*(\{[\s\S]*?\})\s*$/);

    // Strip tokens from what we display
    let display = raw
      .replace("[NAME_ME]", "")
      .replace(/\[INTRO_COMPLETE\][\s\S]*$/, "")
      .trim();

    const newMsg: Msg = { role: "assistant", content: display };
    const newHistory = [...history, newMsg];
    setMessages(newHistory);

    if (hasNameMe && !nameLocked) setShowNameInput(true);

    if (introMatch) {
      try {
        const persona = JSON.parse(introMatch[1]) as Record<string, unknown>;
        const companionName = (persona.companionName as string | undefined)?.trim() || "Companion";
        completeIntro.mutate({ companionName, persona }, {
          onSuccess: () => onComplete(),
          onError: () => onComplete(), // still complete even if save fails
        });
      } catch {
        onComplete();
      }
    }
  }

  async function sendUserMessage(text: string) {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    await fetchAI(newHistory);
  }

  async function handleNameConfirm() {
    if (!nameValue.trim() || isLoading) return;
    setNameLocked(true);
    setShowNameInput(false);
    await sendUserMessage(nameValue.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendUserMessage(input);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-md mx-auto w-full h-full flex flex-col">

        {/* Header */}
        <div className="px-5 pt-6 pb-4 shrink-0 text-center">
          <p className="text-2xl mb-1">👋</p>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Meet your companion</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>A quick chat before you begin</p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-base mr-2 mt-0.5"
                  style={{ background: "rgba(var(--glow-rgb),0.15)" }}>
                  ✨
                </div>
              )}
              <div
                className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={m.role === "user"
                  ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 6 }
                  : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)", borderBottomLeftRadius: 6 }
                }>
                {m.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-base mr-2 mt-0.5"
                style={{ background: "rgba(var(--glow-rgb),0.15)" }}>
                ✨
              </div>
              <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderBottomLeftRadius: 6 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: "var(--accent)", animationDelay: `${i * 0.15}s`, opacity: 0.7 }} />
                ))}
              </div>
            </div>
          )}

          {/* Embedded name input — appears in the chat flow */}
          {showNameInput && !isLoading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 shrink-0 mr-2 mt-0.5" />
              <div className="max-w-[78%] rounded-2xl p-4"
                style={{ background: "var(--glass-bg)", border: "1.5px solid var(--accent)", borderBottomLeftRadius: 6 }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--accent)" }}>Give me a name</p>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleNameConfirm(); }}
                  placeholder="e.g. Zara, Leo, Nova…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none mb-3"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}
                />
                <button
                  onClick={() => void handleNameConfirm()}
                  disabled={!nameValue.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
                  style={{ background: "var(--accent)" }}>
                  That's your name
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        {!showNameInput && (
          <div className="px-4 pb-6 pt-2 shrink-0">
            <div className="flex gap-2 items-end rounded-2xl px-4 py-3"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Say something…"
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-main)" }}
              />
              <button
                onClick={() => void sendUserMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
                style={{ background: "var(--accent)" }}>
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
