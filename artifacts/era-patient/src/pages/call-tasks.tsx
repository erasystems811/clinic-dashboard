import { useState, useEffect, useCallback } from "react";
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
  Send, ChevronDown, ChevronUp, Flag, MessageSquare, Sparkles,
} from "lucide-react";

import { apiUrl } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const ACTION_TYPES = [
  {
    value: "manual_call",
    label: "Call",
    icon: PhoneCall,
    description: "Call patient and log the outcome",
    color: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  {
    value: "manual_text",
    label: "Text",
    icon: MessageSquare,
    description: "Compose or AI-generate a message to send",
    color: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
] as const;

/* ── Action Panel ── */
function ActionPanel({ task, aiUsedToday, aiDailyLimit, onAiUsed }: { task: CallTask; aiUsedToday: number; aiDailyLimit: number; onAiUsed: (newCount: number) => void }) {
  const { toast } = useToast();
  const { hospital } = useAuth();
  const queryClient = useQueryClient();

  const [callOpen, setCallOpen] = useState(false);
  const [callText, setCallText] = useState("");

  const [textMsg, setTextMsg] = useState("");
  const [draftIsAi, setDraftIsAi] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const logOutcome = useLogCallOutcome({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task completed", description: `Follow-up for ${task.patientName} recorded.` });
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  /* ── Call panel ── */
  if (task.actionType === "manual_call") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <PhoneCall className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold tracking-wide">
            {task.phone || "No number on file"}
          </span>
        </div>

        {!callOpen ? (
          <Button size="sm" className="w-full gap-2" onClick={() => setCallOpen(true)}>
            <CheckCircle className="w-4 h-4" />
            Log Call Outcome
          </Button>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="What happened on the call? Patient's response, next steps..."
              value={callText}
              onChange={(e) => setCallText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { setCallOpen(false); setCallText(""); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-2"
                disabled={!callText.trim() || logOutcome.isPending}
                onClick={() => logOutcome.mutate({ id: task.id, data: { outcome: callText } })}
              >
                {logOutcome.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle className="w-4 h-4" />}
                Save & Complete
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Text panel ── */
  const aiRemaining = Math.max(0, aiDailyLimit - aiUsedToday);

  const handleGenerateDraft = async () => {
    if (!hospital?.token) { toast({ title: "Not authenticated", variant: "destructive" }); return; }
    if (aiRemaining === 0) {
      toast({ title: "Daily AI limit reached", description: `Max ${aiDailyLimit} AI drafts per day across all flags.`, variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(apiUrl(`/api/call-tasks/${task.id}/generate-draft`), {
        method: "POST",
        headers: { "x-hospital-token": hospital.token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setTextMsg(data.draft ?? "");
      setDraftIsAi(true);
      if (data.dailyCount !== undefined) onAiUsed(data.dailyCount);
    } catch (err: unknown) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendText = async () => {
    if (!textMsg.trim()) return;
    if (!hospital?.token) {
      toast({ title: "Not authenticated", description: "Please log in again and retry.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const endpoint = draftIsAi
        ? `/api/call-tasks/${task.id}/send-message`
        : `/api/call-tasks/${task.id}/send-manual-email`;
      const res = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
        body: JSON.stringify({ message: textMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      logOutcome.mutate(
        { id: task.id, data: { outcome: `[Text sent] ${textMsg}` } },
        { onError: () => { toast({ title: "Sent but failed to complete task", variant: "destructive" }); setSending(false); } },
      );
    } catch (err: unknown) {
      toast({ title: "Failed to send", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Type your message here, or generate one with AI…"
        value={textMsg}
        onChange={(e) => { setTextMsg(e.target.value); setDraftIsAi(false); }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-violet-400 border-violet-500/40 hover:bg-violet-500/10 shrink-0"
          onClick={handleGenerateDraft}
          disabled={generating || aiRemaining === 0}
          title={aiRemaining === 0 ? `Daily AI limit reached (${aiDailyLimit}/${aiDailyLimit})` : `${aiRemaining} AI generations left today`}
        >
          {generating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />}
          AI Draft ({aiRemaining}/{aiDailyLimit})
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-2"
          disabled={!textMsg.trim() || sending || logOutcome.isPending}
          onClick={handleSendText}
        >
          {(sending || logOutcome.isPending)
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />}
          Send Text
        </Button>
      </div>
    </div>
  );
}

/* ── Task Card ── */
function TaskCard({ task, aiUsedToday, aiDailyLimit, onAiUsed }: { task: CallTask; aiUsedToday: number; aiDailyLimit: number; onAiUsed: (n: number) => void }) {
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
  const currentAction = ACTION_TYPES.find((a) => a.value === task.actionType) ?? ACTION_TYPES[0];
  const Icon = currentAction.icon;

  const outcomeText = task.outcome?.startsWith("[Text sent] ")
    ? task.outcome.slice("[Text sent] ".length)
    : task.outcome;
  const wasText = task.outcome?.startsWith("[Text sent] ");

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
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" />{task.phone || "No number"}
            </span>
            {task.whatsappNumber && task.whatsappNumber !== task.phone && (
              <span className="text-xs text-muted-foreground">WA: {task.whatsappNumber}</span>
            )}
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

          <ActionPanel task={task} aiUsedToday={aiUsedToday} aiDailyLimit={aiDailyLimit} onAiUsed={onAiUsed} />
        </div>
      )}

      {isComplete && (
        <div className="mx-4 mb-4 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs font-medium text-green-400 uppercase tracking-wide">
              {wasText ? "Text Sent" : "Call Logged"}
            </p>
            <span className="text-xs text-muted-foreground ml-auto">{formatDate(task.completedAt!)}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{outcomeText}</p>
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
  const { hospital } = useAuth();
  const [aiUsedToday, setAiUsedToday] = useState(0);
  const [aiDailyLimit, setAiDailyLimit] = useState(20);

  const { data: tasks = [], isLoading } = useListCallTasks(
    {},
    { query: { refetchInterval: 10000 } },
  );

  const openTasks = tasks.filter(t => !t.completedAt);
  const completedTasks = tasks.filter(t => !!t.completedAt);

  const fetchAiCount = useCallback(async () => {
    if (!hospital?.token) return;
    try {
      const res = await fetch(apiUrl("/api/call-tasks/ai-draft-count"), {
        headers: { "x-hospital-token": hospital.token },
      });
      if (res.ok) {
        const data = await res.json();
        setAiUsedToday(data.dailyCount ?? 0);
        if (data.dailyLimit) setAiDailyLimit(data.dailyLimit);
      }
    } catch { /* silent */ }
  }, [hospital?.token]);

  useEffect(() => { fetchAiCount(); }, [fetchAiCount]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Call Tasks</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            All follow-up tasks — open and completed
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Phone className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No tasks yet — all clear!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Open tasks */}
            {openTasks.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Open · {openTasks.length}
                </p>
                {openTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    aiUsedToday={aiUsedToday}
                    aiDailyLimit={aiDailyLimit}
                    onAiUsed={setAiUsedToday}
                  />
                ))}
              </div>
            )}

            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                    Completed · {completedTasks.length}
                  </p>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    aiUsedToday={aiUsedToday}
                    aiDailyLimit={aiDailyLimit}
                    onAiUsed={setAiUsedToday}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
