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
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 shrink-0"
        style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--glass-border)" }}>
        <button onClick={() => navigate("/weightloss")} className="-ml-1" style={{ color: "var(--text-sub)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-lg"
          style={{ background: WL_COLOR }}>
          🏋️
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Weight Loss Coach</p>
          <p className="text-xs" style={{ color: WL_COLOR }}>● Personalised for you</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}
        {pending && (
          <div className="flex gap-1.5 px-4 py-3 rounded-2xl self-start"
            style={{ background: `${WL_COLOR}15`, border: `1px solid ${WL_COLOR}25`, maxWidth: "75%" }}>
            {[0, 1, 2].map((d) => (
              <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: WL_COLOR, animationDelay: `${d * 0.15}s` }} />
            ))}
          </div>
        )}
        {/* Suggested prompts — show only on first open */}
        {messages.length === 1 && !pending && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => void send(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition active:scale-95"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 shrink-0 flex gap-2 items-end"
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
          className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none placeholder:opacity-50"
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
          style={{ background: WL_COLOR }}>
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
      <div className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
        style={
          isUser
            ? { background: WL_COLOR, color: "#fff", borderBottomRightRadius: 6 }
            : { background: "var(--glass-bg)", border: `1px solid var(--glass-border)`, color: "var(--text-main)", borderBottomLeftRadius: 6 }
        }>
        {msg.content}
      </div>
    </div>
  );
}
