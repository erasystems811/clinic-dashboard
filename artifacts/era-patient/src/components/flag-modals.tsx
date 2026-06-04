import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFlagMissedTreatment,
  getListCallTasksQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { Flag, MessageSquare, PhoneCall, X, User, Users, Send, Loader2, CheckCircle2, Sparkles, Mail } from "lucide-react";

interface ModalProps {
  patientName: string;
  patientId: number;
  onClose: () => void;
}

type Step = "choose" | "self" | "receptionist";
type ActionType = "manual_call" | "manual_email" | "automated_message";

export function FollowUpFlagModal({ patientName, patientId, onClose }: ModalProps) {
  const { toast } = useToast();
  const { hospital } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("choose");

  // ── Send to Receptionist state ──────────────────────────────────────────────
  const [reason, setReason] = useState("");
  const [actionType, setActionType] = useState<ActionType>("manual_call");

  const flagMissed = useFlagMissedTreatment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task sent to receptionist", description: `${patientName} added to call list.` });
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
        onClose();
      },
      onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
    },
  });

  // ── Handle Myself state ─────────────────────────────────────────────────────
  const [selfMethod, setSelfMethod] = useState<"email" | "call">("email");
  const [selfReason, setSelfReason] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleGenerateDraft = async () => {
    if (!hospital?.token || !selfReason.trim()) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${patientId}/ai-draft-message`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
        body: JSON.stringify({ reason: selfReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setEmailSubject("Follow-up from " + (hospital?.name ?? "clinic"));
      setEmailBody(data.draft ?? "");
    } catch (err: unknown) {
      toast({ title: "AI draft failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendSelf = async () => {
    if (!hospital?.token) return;
    const isEmail = selfMethod === "email";
    if (isEmail && (!emailSubject.trim() || !emailBody.trim())) return;
    if (!isEmail && !callOutcome.trim()) return;
    setSending(true);
    try {
      const body = isEmail
        ? { sendEmail: true, subject: emailSubject.trim(), message: emailBody.trim(), reason: selfReason.trim() }
        : { logOnly: true, reason: selfReason.trim(), callOutcome: callOutcome.trim() };
      const res = await fetch(apiUrl(`/api/patients/${patientId}/direct-message`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSent(true);
      toast({
        title: isEmail ? "Email sent" : "Call logged",
        description: isEmail ? `Email sent to ${patientName}.` : undefined,
      });
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const initials = patientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold">Follow-up for {patientName}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step 1: Choose who handles it ── */}
        {step === "choose" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground">Who will handle this follow-up?</p>
            <button
              onClick={() => setStep("self")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">I'll handle it myself</p>
                <p className="text-xs text-muted-foreground mt-0.5">Compose and send a message directly to the patient now</p>
              </div>
            </button>
            <button
              onClick={() => setStep("receptionist")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Send to receptionist</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add to the receptionist's call task list to action</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Step 2a: Handle Myself ── */}
        {step === "self" && (
          <div className="p-5 space-y-4">
            <button onClick={() => setStep("choose")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>

            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div>
                <p className="font-semibold text-sm">{patientName}</p>
                <p className="text-xs text-muted-foreground">You are handling this follow-up directly</p>
              </div>
            </div>

            {/* Method picker */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "email" as const, label: "Email", icon: MessageSquare, cls: "border-blue-500 bg-blue-500/10 text-blue-400" },
                { value: "call" as const, label: "Phone Call", icon: PhoneCall, cls: "border-primary bg-primary/10 text-primary" },
              ].map(opt => {
                const Icon = opt.icon;
                const sel = selfMethod === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => setSelfMethod(opt.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${sel ? opt.cls : "border-border text-muted-foreground hover:border-border/60"}`}>
                    <Icon className="w-4 h-4 shrink-0" />{opt.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(for your records)</span></label>
              <Input value={selfReason} onChange={e => setSelfReason(e.target.value)}
                placeholder="e.g. Missed last appointment, checking in…" />
            </div>

            {selfMethod === "email" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Email subject *</label>
                <input type="text" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  placeholder="e.g. Follow-up from your clinic…" />

                <label className="text-sm font-medium mt-3 block">Email body *</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Type your message, or use AI to generate one…"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm"
                    className="gap-1.5 text-violet-400 border-violet-500/40 hover:bg-violet-500/10 shrink-0"
                    onClick={handleGenerateDraft}
                    disabled={sending || !selfReason.trim()}
                    title={!selfReason.trim() ? "Enter a reason first" : "Generate AI draft"}>
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    AI Draft
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleSendSelf}
                    disabled={!emailSubject.trim() || !emailBody.trim() || sending || sent}>
                    {sent ? <><CheckCircle2 className="w-4 h-4" />Sent</> :
                     sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> :
                     <><Send className="w-4 h-4" />Send Email</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Call outcome *</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={callOutcome}
                  onChange={e => setCallOutcome(e.target.value)}
                  placeholder="What happened on the call? Patient's response, next steps…"
                />
                <Button className="w-full gap-2" onClick={handleSendSelf}
                  disabled={!callOutcome.trim() || sending || sent}>
                  {sent ? <><CheckCircle2 className="w-4 h-4" />Logged</> :
                   sending ? <><Loader2 className="w-4 h-4 animate-spin" />Logging…</> :
                   <><CheckCircle2 className="w-4 h-4" />Log Call</>}
                </Button>
              </div>
            )}

            {step === "self" && !sent && (
              <Button type="button" variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onClose} disabled={sending}>
                Cancel
              </Button>
            )}
          </div>
        )}

        {/* ── Step 2b: Send to Receptionist ── */}
        {step === "receptionist" && (
          <div className="p-5 space-y-4">
            <button onClick={() => setStep("choose")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← Back
            </button>

            <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div>
                <p className="font-semibold text-sm">{patientName}</p>
                <p className="text-xs text-muted-foreground">Will be added to the receptionist's call list</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason for follow-up *</label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Missed appointment, needs check-up reminder…"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contact method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "manual_call" as ActionType, label: "Phone Call", icon: PhoneCall, cls: "border-primary bg-primary/10 text-primary" },
                  { value: "manual_email" as ActionType, label: "Email", icon: Mail, cls: "border-blue-500 bg-blue-500/10 text-blue-400" },
                ].map(opt => {
                  const Icon = opt.icon;
                  const sel = actionType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setActionType(opt.value)}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${sel ? opt.cls : "border-border text-muted-foreground hover:border-border/60"}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!reason.trim() || flagMissed.isPending}
                onClick={() => flagMissed.mutate({ id: patientId, data: { reason, actionType } })}
              >
                {flagMissed.isPending ? "Creating…" : "Create Task"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
