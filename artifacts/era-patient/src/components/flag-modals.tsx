import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
import { Flag, MessageSquare, PhoneCall, X, User, Users, Send, Loader2, CheckCircle2, Sparkles, Mail, Wallet } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface ModalProps {
  patientName: string;
  patientId: number;
  onClose: () => void;
}

type Step = "choose" | "self" | "receptionist";
type ActionType = "manual_call" | "manual_email" | "automated_message";

export function FollowUpFlagModal({ patientName, patientId, onClose }: ModalProps) {
  const { toast } = useToast();
  const { hospital, user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
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
  const [emailBody, setEmailBody] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [showSenderIdDialog, setShowSenderIdDialog] = useState(false);
  const [showDndDialog, setShowDndDialog] = useState(false);
  const [pendingDndMessage, setPendingDndMessage] = useState<string>("");
  const skipInsufficientToast = useRef(false);

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
    if (isEmail && !emailBody.trim()) return;
    if (!isEmail && !callOutcome.trim()) return;
    // Pre-flight: SMS restricted hours (5 PM – 8 AM WAT)
    if (isEmail && smsEnabled && promotionalSmsRestricted) {
      toast({ title: "SMS unavailable right now", description: "Promotional SMS is blocked by Termii between 5:00 PM and 8:00 AM. The message will be sent via email instead.", variant: "default" });
      skipInsufficientToast.current = true;
      await doSendSelf();
      return;
    }
    // Pre-flight: if SMS is on but sender ID not configured, prompt before sending
    if (isEmail && smsEnabled && !smsReady) {
      setShowSenderIdDialog(true);
      return;
    }
    // Pre-flight: if SMS is on and patient has known DND blocking, warn before sending
    if (isEmail && smsEnabled && patientDndBlocked) {
      setPendingDndMessage(emailBody.trim());
      setShowDndDialog(true);
      return;
    }
    // Pre-flight: if SMS is on and wallet is empty, prompt the user before sending
    if (isEmail && smsEnabled && walletBalance !== null && walletBalance < 7) {
      setShowWalletDialog(true);
      return;
    }
    await doSendSelf();
  };

  const doSendSelf = async () => {
    if (!hospital?.token) return;
    const isEmail = selfMethod === "email";
    setSending(true);
    try {
      const body = isEmail
        ? { sendEmail: true, message: emailBody.trim(), reason: selfReason.trim() }
        : { logOnly: true, reason: selfReason.trim(), callOutcome: callOutcome.trim() };
      const res = await fetch(apiUrl(`/api/patients/${patientId}/direct-message`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hospital-token": hospital.token,
          ...(user?.staffName ? { "x-performed-by": user.staffName } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string; sentViaSms?: boolean; insufficientFunds?: boolean; senderIdMissing?: boolean; dndBlocked?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.dndBlocked) {
        setPatientDndBlocked(true);
        setPendingDndMessage(emailBody.trim());
        setShowDndDialog(true);
        return;
      }
      setSent(true);
      if (!isEmail) {
        toast({ title: "Call logged" });
      } else if (data.senderIdMissing) {
        toast({ title: "Sent via email — SMS sender ID not set", description: "Your Termii Sender ID is not configured. Go to Settings → Notification Channel to set it up so messages can be delivered via SMS." });
      } else if (data.sentViaSms) {
        toast({ title: "SMS sent", description: `Message delivered via SMS (₦7 deducted from wallet).` });
      } else if (data.insufficientFunds && !skipInsufficientToast.current) {
        toast({ title: "Sent via email — wallet empty", description: "Your SMS wallet has insufficient funds. Top up in Settings → SMS Wallet to enable SMS delivery." });
      } else if (skipInsufficientToast.current) {
        toast({ title: "Sent via email", description: `Email sent to ${patientName}.` });
      } else {
        toast({ title: "Email sent", description: `Email sent to ${patientName}.` });
      }
      skipInsufficientToast.current = false;
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      skipInsufficientToast.current = false;
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null);
  const [smsReady, setSmsReady] = useState<boolean>(true);
  const [senderIdPending, setSenderIdPending] = useState<boolean>(false);
  const [smsToggleSaving, setSmsToggleSaving] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [patientDndBlocked, setPatientDndBlocked] = useState(false);
  const [promotionalSmsRestricted, setPromotionalSmsRestricted] = useState(false);

  useEffect(() => {
    if (!hospital?.token) return;
    fetch(apiUrl("/api/hospital/sms-modules"), { headers: { "x-hospital-token": hospital.token } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { const d = data as Record<string, unknown>; setSmsEnabled(d.followupSmsEnabled as boolean); setSmsReady((d.smsReady as boolean) ?? true); setSenderIdPending((d.senderIdPending as boolean) ?? false); setPromotionalSmsRestricted((d.promotionalSmsRestricted as boolean) ?? false); } });
    fetch(apiUrl("/api/wallet/balance"), { headers: { "x-hospital-token": hospital.token } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setWalletBalance((data as Record<string, unknown>).balanceNaira as number); });
    fetch(apiUrl(`/api/patients/${patientId}/dnd-status`), { headers: { "x-hospital-token": hospital.token } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPatientDndBlocked((data as Record<string, unknown>).dndBlocked as boolean ?? false); });
  }, [hospital?.token, patientId]);

  const handleSmsToggle = async (value: boolean) => {
    if (!hospital?.token || smsToggleSaving) return;
    // Block toggle during Termii promotional SMS restricted hours
    if (value && promotionalSmsRestricted) {
      toast({ title: "SMS unavailable right now", description: "Promotional SMS is blocked by Termii between 5:00 PM and 8:00 AM. Toggle SMS on after 8:00 AM.", variant: "destructive" });
      return;
    }
    // Warn immediately if this patient has known DND blocking
    if (value && patientDndBlocked) {
      setPendingDndMessage(emailBody.trim());
      setShowDndDialog(true);
      return;
    }
    setSmsToggleSaving(true);
    try {
      const res = await fetch(apiUrl("/api/hospital/sms-modules"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
        body: JSON.stringify({ followupSmsEnabled: value }),
      });
      if (res.ok) setSmsEnabled(value);
    } finally { setSmsToggleSaving(false); }
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
          <div className="flex items-center gap-3">
            {smsEnabled !== null && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>SMS</span>
                <button
                  onClick={() => handleSmsToggle(!smsEnabled)}
                  disabled={smsToggleSaving}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${smsEnabled ? "bg-primary" : "bg-muted-foreground/30"} disabled:opacity-50`}
                  role="switch"
                  aria-checked={smsEnabled}
                  title={smsEnabled ? "Follow-up SMS on — click to disable" : "Follow-up SMS off — click to enable"}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${smsEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
              <X className="w-4 h-4" />
            </button>
          </div>
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
                <label className="text-sm font-medium">Email message *</label>
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
                    disabled={!emailBody.trim() || sending || sent}>
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

      <AlertDialog open={showSenderIdDialog} onOpenChange={setShowSenderIdDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>SMS sender ID not active</AlertDialogTitle>
            <AlertDialogDescription>
              {senderIdPending
                ? "Your SMS Sender ID has been submitted and is awaiting Termii approval. SMS cannot be delivered yet. You can send via email now at no cost, or wait until approval comes through."
                : "Your hospital's SMS Sender ID has not been configured yet. Contact your administrator to set it up. You can still send this message via email at no cost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Don't send</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSenderIdDialog(false);
                skipInsufficientToast.current = true;
                void doSendSelf();
              }}
            >
              Send via Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDndDialog} onOpenChange={setShowDndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>DND blocking detected</AlertDialogTitle>
            <AlertDialogDescription>
              This patient's number has DND (Do Not Disturb) restriction — the SMS was not delivered and no charge was applied. Would you like to send via email instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDndDialog(false)}>Dismiss</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowDndDialog(false);
                if (!hospital?.token || !pendingDndMessage) return;
                setSending(true);
                try {
                  const res = await fetch(apiUrl(`/api/patients/${patientId}/direct-message`), {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-hospital-token": hospital.token,
                      ...(user?.staffName ? { "x-performed-by": user.staffName } : {}),
                    },
                    body: JSON.stringify({ sendEmail: true, message: pendingDndMessage, forceEmail: true }),
                  });
                  if (res.ok) { setSent(true); toast({ title: "Sent via email", description: `Email sent to ${patientName} instead.` }); setTimeout(onClose, 1500); }
                  else { toast({ title: "Email send failed", variant: "destructive" }); }
                } finally { setSending(false); }
              }}
            >
              Send via Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWalletDialog} onOpenChange={setShowWalletDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              SMS wallet is empty
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your SMS wallet has ₦0. You can fund your wallet to send this message via SMS, or send it via email now at no cost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Later</AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => { setShowWalletDialog(false); navigate("/settings"); }}
            >
              Fund Wallet
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowWalletDialog(false);
                skipInsufficientToast.current = true;
                void doSendSelf();
              }}
            >
              Send via Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
