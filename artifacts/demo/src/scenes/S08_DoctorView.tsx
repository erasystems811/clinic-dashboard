import { useState } from "react";
import {
  Clock, Users, PhoneCall, ArrowRightLeft, AlertTriangle,
  CheckCircle2, ClipboardList, MessageSquare, Send, CheckCheck,
  Search, CalendarPlus, X,
} from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

type Tab = "queue" | "followups" | "messages";

export default function S08_DoctorView({ prospect, onNext }: Props) {
  const [tab, setTab] = useState<Tab>("queue");
  const [calledIn, setCalledIn] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // Messages state
  const [threadOpen, setThreadOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [resolved, setResolved] = useState(false);
  type Msg = { id: number; sender: "patient" | "hospital"; content: string; time: string };
  const [messages, setMessages] = useState<Msg[]>([
    { id: 1, sender: "patient", content: `Hi doctor, I'm not sure how many times a day I should take the Paracetamol. Can you clarify?`, time: "9:40 AM" },
  ]);
  const [replySent, setReplySent] = useState(false);

  function handleCallIn() {
    setCalledIn(true);
    setTimeout(() => setTab("messages"), 800);
  }

  function handleClaim() {
    setClaimed(true);
  }

  function handleSendReply() {
    const text = reply.trim() || "Take it 3 times daily after meals — morning, afternoon, and evening. Let me know if you experience any side effects.";
    setMessages(m => [...m, { id: m.length + 1, sender: "hospital" as "hospital", content: text, time: "Now" }]);
    setReply("");
    setReplySent(true);
    setTimeout(() => {
      setMessages(m => [...m, { id: m.length + 1, sender: "patient" as "patient", content: "Thank you doctor! That's very helpful. I'll follow the schedule as prescribed.", time: "Now" }]);
    }, 1000);
  }

  function handleResolve() {
    setResolved(true);
    setTimeout(onNext, 800);
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "queue",    label: "Queue",     icon: <Users className="w-3.5 h-3.5" /> },
    { id: "followups",label: "Follow-Ups",icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: "messages", label: "Messages",  icon: <MessageSquare className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="relative space-y-5 max-w-2xl">
      {/* Doctor header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dr. Emmanuel Obi</h1>
          <p className="text-muted-foreground text-sm mt-0.5">General Practice</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unavailable && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> Unavailable
            </span>
          )}
          <Button
            variant={unavailable ? "default" : "outline"}
            size="sm"
            onClick={() => setUnavailable(v => !v)}
            className="gap-1.5"
          >
            {unavailable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {unavailable ? "Mark Available" : "Mark Unavailable"}
          </Button>
        </div>
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
            {t.id === "messages" && !replySent && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">1</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Queue tab ── */}
      {tab === "queue" && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">My Queue</span>
            <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
              {calledIn ? "0" : "1"} waiting
            </span>
          </div>
          {calledIn ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Your queue is empty</div>
          ) : (
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Position badge */}
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>12 mins</span>
                    <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">In Care</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                    <ArrowRightLeft className="w-3 h-3" /> Reassign
                  </Button>
                  <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleCallIn}>
                    <PhoneCall className="w-3 h-3" /> Call In
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Follow-Ups tab ── */}
      {tab === "followups" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Search a patient to view their active care plan and flag them for follow-up or schedule a return visit.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input className="pl-9" placeholder="Search patient name or ID… (min 2 characters)" />
          </div>
          {/* Example selected patient */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {prospect.firstName[0]}{prospect.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{prospect.firstName} {prospect.lastName}</p>
                <p className="text-xs text-muted-foreground">{prospect.phone}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs flex-1 sm:flex-none">
                  <ClipboardList className="w-3.5 h-3.5" /> Flag for Outreach
                </Button>
                <Button size="sm" className="gap-1.5 h-8 text-xs flex-1 sm:flex-none">
                  <CalendarPlus className="w-3.5 h-3.5" /> Schedule Return Visit
                </Button>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Active Care Plans</p>
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold text-primary mb-0.5">General Outpatient</p>
                <p className="text-sm">Upper Respiratory Tract Infection. Paracetamol 500mg × 5 days, Amoxicillin 250mg × 7 days.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Messages tab ── */}
      {tab === "messages" && (
        <div className="flex gap-3 h-[420px]">
          {/* Conversation list */}
          <div className={`flex flex-col border border-border rounded-lg bg-card shrink-0 ${threadOpen ? "hidden md:flex w-56" : "flex w-full md:w-56"}`}>
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-sm font-semibold">ERA Messages</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <button
                onClick={() => setThreadOpen(true)}
                className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/40 transition ${threadOpen ? "bg-muted/60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {prospect.firstName[0]}{prospect.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs truncate ${!replySent ? "font-bold" : "font-medium"}`}>{prospect.firstName} {prospect.lastName}</p>
                      {!replySent && <span className="min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1 shrink-0">1</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mb-1">How many times a day should I take…</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">General Practice</span>
                      {!claimed
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">Unclaimed</span>
                        : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Mine</span>}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Thread */}
          {threadOpen && (
            <div className="flex-1 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
              {/* Thread header */}
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
                <button onClick={() => setThreadOpen(false)} className="md:hidden p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {prospect.firstName[0]}{prospect.lastName[0]}
                </div>
                <p className="text-sm font-semibold flex-1 min-w-0 truncate">{prospect.firstName} {prospect.lastName}</p>

                {!claimed && !resolved && (
                  <button
                    onClick={handleClaim}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition shrink-0"
                  >
                    <ArrowRightLeft className="w-3 h-3" /> Claim
                  </button>
                )}
                {claimed && !resolved && (
                  <button
                    onClick={handleResolve}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition border border-green-500/20 shrink-0"
                  >
                    <CheckCheck className="w-3 h-3" /> Resolve
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender === "hospital" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.sender === "hospital"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}>
                      <p className="leading-relaxed">{m.content}</p>
                      <p className={`text-[9px] mt-0.5 ${m.sender === "hospital" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{m.time}</p>
                    </div>
                  </div>
                ))}
                {resolved && (
                  <div className="flex justify-center py-1">
                    <span className="text-[10px] text-muted-foreground bg-muted/60 border border-border rounded-full px-2.5 py-0.5">Conversation resolved by Dr. Emmanuel Obi</span>
                  </div>
                )}
              </div>

              {/* Reply input */}
              {resolved ? (
                <div className="px-4 py-2.5 border-t border-border text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 shrink-0">
                  <CheckCheck className="w-3.5 h-3.5 text-green-500" /> Conversation resolved
                </div>
              ) : !claimed ? (
                <div className="px-4 py-2.5 border-t border-border text-center text-xs text-muted-foreground shrink-0">
                  Claim this conversation to reply
                </div>
              ) : (
                <div className="px-3 py-2.5 border-t border-border flex gap-2 shrink-0">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    placeholder="Type a reply…"
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary transition"
                    style={{ maxHeight: 80 }}
                    defaultValue={!replySent ? "Take it 3 times daily after meals — morning, afternoon, and evening. Let me know if you experience any side effects." : ""}
                  />
                  <button
                    onClick={handleSendReply}
                    className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <NarrationBubble
        text={
          tab === "queue" && !calledIn
            ? <>Doctors see only <strong>their assigned patients</strong> — no digging through everyone else's queue. Position, wait time, reassign or call in, right here.</>
            : tab === "queue" && calledIn
            ? <><strong>{prospect.firstName} called in.</strong> ERA moves them to In Care automatically. Now check your messages — there's a question waiting.</>
            : tab === "followups"
            ? <>From Follow-Ups, doctors can view a patient's active care plan and <strong>flag them for outreach</strong> or <strong>schedule a return visit</strong> — without touching the nurse station.</>
            : !threadOpen
            ? <>Patients message their care team directly through the ERA app. <strong>No personal phone numbers shared.</strong> Open the conversation to see the question.</>
            : !claimed
            ? <>Conversations are unclaimed until a doctor takes ownership. Click <strong>Claim</strong> to take this one — then you can reply.</>
            : !replySent
            ? <><strong>Claimed.</strong> Now reply to {prospect.firstName}'s question about their medication.</>
            : !resolved
            ? <><strong>Message sent.</strong> {prospect.firstName} got the answer instantly. Click <strong>Resolve</strong> when the conversation is complete.</>
            : <><strong>Conversation resolved.</strong> Everything stays on record — the full thread, who replied, when it was closed.</>
        }
        onNext={
          tab === "queue" && !calledIn ? handleCallIn
          : tab === "queue" && calledIn ? () => setTab("messages")
          : tab === "followups" ? () => setTab("messages")
          : !threadOpen ? () => setThreadOpen(true)
          : !claimed ? handleClaim
          : !replySent ? handleSendReply
          : !resolved ? handleResolve
          : onNext
        }
        nextLabel={
          tab === "queue" && !calledIn ? "Call In →"
          : tab === "queue" && calledIn ? "See Messages →"
          : tab === "followups" ? "See Messages →"
          : !threadOpen ? "Open conversation →"
          : !claimed ? "Claim →"
          : !replySent ? "Send reply →"
          : !resolved ? "Resolve →"
          : "Continue →"
        }
      />
    </div>
  );
}
