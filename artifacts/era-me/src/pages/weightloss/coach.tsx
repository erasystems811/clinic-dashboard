import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useLocation } from "wouter";
import { useWLCoachChat, WL_COLOR } from "@/lib/weightloss-api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME = "Hey! I'm your weight loss coach. I know your profile and weekly plan — ask me anything about your meals, workouts, progress, or how to stay on track. I'll hold you accountable! 💪";

const SUGGESTED = [
  "Am I on track this week?",
  "What can I eat for a quick snack?",
  "I skipped my workout today",
  "Can I have a cheat meal tonight?",
  "Motivate me!",
];

export default function WLCoachPage() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const chatMutation = useWLCoachChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || pending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { role: "user", content: msg };
    const history = messages.slice(-10);
    setMessages((p) => [...p, userMsg]);
    setPending(true);

    try {
      const res = await chatMutation.mutateAsync({
        message: msg,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((p) => [...p, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Sorry, I couldn't respond right now. Try again." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: "var(--bg-base)" }}>
      {/* Gradient header */}
      <div className="shrink-0"
        style={{
          background: `linear-gradient(180deg, rgba(16,185,129,0.15) 0%, var(--bg-base) 100%)`,
          borderBottom: "1px solid var(--glass-border)",
        }}>
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <button onClick={() => navigate("/weightloss")} className="-ml-1 p-1" style={{ color: "var(--text-sub)" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar with glow */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: WL_COLOR, filter: "blur(10px)", opacity: 0.45, transform: "scale(1.15)" }} />
            <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: `linear-gradient(135deg, #34d399, ${WL_COLOR})` }}>
              🏋️
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Weight Loss Coach</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: WL_COLOR, boxShadow: `0 0 5px ${WL_COLOR}` }} />
              <p className="text-xs font-medium" style={{ color: WL_COLOR }}>Active · personalised for you</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}

        {/* Typing indicator */}
        {pending && (
          <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
            style={{
              background: `rgba(16,185,129,0.1)`,
              border: `1px solid rgba(16,185,129,0.2)`,
              width: "fit-content",
              maxWidth: "75%",
            }}>
            {[0, 1, 2].map((d) => (
              <span key={d} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: WL_COLOR, animationDelay: `${d * 0.15}s` }} />
            ))}
          </div>
        )}

        {/* Suggested prompts */}
        {messages.length === 1 && !pending && (
          <div className="pt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-dim)" }}>
              Try asking
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => void send(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition active:scale-95"
                  style={{
                    background: "var(--glass-bg)",
                    border: `1px solid rgba(16,185,129,0.22)`,
                    color: "var(--text-sub)",
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 shrink-0 flex gap-2 items-end"
        style={{ background: "var(--bg-base)", borderTop: "1px solid var(--glass-border)" }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Ask your coach…"
          rows={1}
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-main)",
            resize: "none",
            overflowY: "hidden",
            maxHeight: 120,
            lineHeight: 1.5,
          }}
          className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none placeholder:opacity-40"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
        />
        <button
          onClick={() => void send()}
          disabled={!input.trim() || pending}
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition active:scale-90 disabled:opacity-40"
          style={{ background: `linear-gradient(135deg, #34d399, ${WL_COLOR})` }}>
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[80%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
        style={
          isUser
            ? {
                background: `linear-gradient(135deg, #34d399, ${WL_COLOR})`,
                color: "#fff",
                borderRadius: "18px 18px 4px 18px",
              }
            : {
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-main)",
                borderRadius: "18px 18px 18px 4px",
              }
        }>
        {msg.content}
      </div>
    </div>
  );
}
