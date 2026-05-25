import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
  useListCallTasks,
  useLogCallOutcome,
  useUpdateCallTaskActionType,
  getListCallTasksQueryKey,
} from "@workspace/api-client-react";
import type { CallTask } from "@workspace/api-client-react";
import {
  Phone, CheckCircle, Clock, Loader2, PhoneCall,
  Send, ChevronDown, ChevronUp, Flag, Bot, Sparkles, RefreshCw, Pencil,
} from "lucide-react";

import { apiUrl } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const ACTION_TYPES = [
  {
    value: "automated_message",
    label: "Automated Message",
    icon: Bot,
    description: "AI generates a personalised message — review and edit before sending as Important Email",
    color: "text-violet-400",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
  {
    value: "manual_call",
    label: "Manual Call",
    icon: PhoneCall,
    description: "Staff makes a direct phone call and logs the outcome",
    color: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
] as const;

/* ── Action Panel ── */
function ActionPanel({ task }: { task: CallTask }) {
  const { toast } = useToast();
  const { hospital } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [draftMsg, setDraftMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);

  const logOutcome = useLogCallOutcome({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task completed", description: `Follow-up for ${task.patientName} recorded.` });
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  const handleGenerateDraft = async () => {
    if (!hospital?.token) { toast({ title: "Not authenticated", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const res = await fetch(apiUrl(`/api/call-tasks/${task.id}/generate-draft`), {
        method: "POST",
        headers: { "x-hospital-token": hospital.token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setDraftMsg(data.draft ?? "");
      setEditingDraft(false);
    } catch (err: unknown) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendDraft = async () => {
    if (!hospital?.token || !draftMsg.trim()) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/call-tasks/${task.id}/send-message`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
        body: JSON.stringify({ message: draftMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      toast({ title: "Email sent", description: `Important email sent to ${task.patientName}.` });
      logOutcome.mutate({ id: task.id, data: { outcome: `[Important email sent] ${draftMsg}` } });
    } catch (err: unknown) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const submit = (outcome: string) => {
    logOutcome.mutate({ id: task.id, data: { outcome } });
  };

  /* ── Manual Call ── */
  if (task.actionType === "manual_call") {
    return !open ? (
      <Button size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
        <CheckCircle className="w-4 h-4" />
        Log Call Outcome
      </Button>
    ) : (
      <div className="space-y-2">
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="What happened on the call? Notes on patient's condition, next steps..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setOpen(false); setText(""); }}>Cancel</Button>
          <Button size="sm" className="flex-1 gap-2" disabled={!text.trim() || logOutcome.isPending} onClick={() => submit(text)}>
            {logOutcome.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Outcome
          </Button>
        </div>
      </div>
    );
  }

  /* ── Automated Message → AI draft → receptionist edits → sends as Important Email ── */
  return (
    <div className="space-y-2">
      {!draftMsg ? (
        <div className="space-y-2">
          <div className="rounded-md bg-violet-500/5 border border-violet-500/20 px-3 py-2.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI will read the patient's situation and reason for flag, then generate a personalised message. You can review and edit it before sending as an Important email.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
            onClick={handleGenerateDraft}
            disabled={generating}
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" />Generating draft…</>
              : <><Sparkles className="w-4 h-4" />Generate Draft</>}
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-md border border-violet-500/30 bg-violet-500/5 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-500/20 bg-violet-500/10">
              <Bot className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-400">AI Draft · Review before sending</span>
              <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={handleGenerateDraft} disabled={generating}>
                <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
                Regenerate
              </button>
            </div>
            {editingDraft ? (
              <textarea className="w-full bg-transparent px-3 py-2.5 text-sm min-h-[110px] resize-none focus:outline-none" value={draftMsg} onChange={(e) => setDraftMsg(e.target.value)} autoFocus />
            ) : (
              <div className="px-3 py-2.5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{draftMsg}</p>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-2 border-t border-violet-500/20 bg-violet-500/5">
              <span className="text-xs text-muted-foreground">{draftMsg.length} chars</span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => setEditingDraft(!editingDraft)}>
                <Pencil className="w-3 h-3" />
                {editingDraft ? "Done" : "Edit"}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setDraftMsg(""); setEditingDraft(false); }}>Discard</Button>
            <Button size="sm" className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700 text-white" disabled={!draftMsg.trim() || sending} onClick={handleSendDraft}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send as Important Email
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Task Card ── */
function TaskCard({ task }: { task: CallTask }) {
  const queryClient = useQueryClient();
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  const updateAction = useUpdateCallTaskActionType({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
        setShowMethodPicker(false);
      },
    },
  });

  const isComplete = !!task.completedAt;
  const currentAction = ACTION_TYPES.find((a) => a.value === task.actionType) ?? ACTION_TYPES[1];
  const Icon = currentAction.icon;

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${isComplete ? "opacity-60 border-border" : "border-border"}`}>
      <div className="flex items-start gap-3 p-4">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isComplete ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"}`}>
          {task.patientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{task.patientName}</p>
            {isComplete && <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full font-medium border border-green-500/20">Completed</span>}
            {!!task.department && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{task.department}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{task.phone}</span>
            {task.whatsappNumber && task.whatsappNumber !== task.phone && <span className="text-xs text-muted-foreground">WA: {task.whatsappNumber}</span>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" />{formatDate(task.flaggedAt)}
        </div>
      </div>

      <div className="mx-4 mb-4 space-y-2">
        <div className="flex items-center gap-2">
          {task.taskType === "check_in" ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <CheckCircle className="w-3 h-3" />{task.checkInType ?? "Check-In"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              <Flag className="w-3 h-3" />Follow-Up
            </span>
          )}
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Reason</p>
          <p className="text-sm">{task.reason}</p>
        </div>
      </div>

      {!isComplete && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${currentAction.badge}`}
              onClick={() => setShowMethodPicker(!showMethodPicker)}
            >
              <Icon className="w-3 h-3" />
              {currentAction.label}
              {showMethodPicker ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
            </button>
            <span className="text-xs text-muted-foreground">— {currentAction.description}</span>
          </div>

          {showMethodPicker && (
            <div className="grid grid-cols-2 gap-2">
              {ACTION_TYPES.map((action) => {
                const AI = action.icon;
                const isSelected = task.actionType === action.value;
                return (
                  <button
                    key={action.value}
                    type="button"
                    onClick={() => {
                      if (!isSelected) {
                        updateAction.mutate({ id: task.id, data: { actionType: action.value } });
                      } else {
                        setShowMethodPicker(false);
                      }
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-md border text-center transition-colors text-xs font-medium ${
                      isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-border/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <AI className={`w-4 h-4 ${isSelected ? "text-primary" : action.color}`} />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          <ActionPanel task={task} />
        </div>
      )}

      {isComplete && (
        <div className="mx-4 mb-4 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs font-medium text-green-400 uppercase tracking-wide">Completed</p>
            <span className="text-xs text-muted-foreground ml-auto">{formatDate(task.completedAt!)}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{task.outcome}</p>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <Icon className="w-3 h-3" />via {currentAction.label}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Page ── */
export default function CallTasks() {
  const [showCompleted, setShowCompleted] = useState(false);
  const { data: tasks = [], isLoading } = useListCallTasks(
    { completed: showCompleted },
    { query: { refetchInterval: 10000 } },
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Call Tasks</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Patients flagged for follow-up — pick the right method per patient
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button type="button" onClick={() => setShowCompleted(false)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!showCompleted ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Open</button>
            <button type="button" onClick={() => setShowCompleted(true)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showCompleted ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Completed</button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Phone className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{showCompleted ? "No completed tasks" : "No open tasks — all clear!"}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
