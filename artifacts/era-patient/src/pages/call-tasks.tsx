import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCallTasks,
  useLogCallOutcome,
  useUpdateCallTaskActionType,
  getListCallTasksQueryKey,
} from "@workspace/api-client-react";
import type { CallTask } from "@workspace/api-client-react";
import { Phone, CheckCircle, Clock, Loader2, MessageSquare, Bot, PhoneCall } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ACTION_TYPES = [
  { value: "automated_message", label: "Automated Message", icon: Bot, description: "Send automated WhatsApp/SMS follow-up", color: "text-violet-400" },
  { value: "manual_text", label: "Manual Text", icon: MessageSquare, description: "Staff sends a personal text message", color: "text-blue-400" },
  { value: "manual_call", label: "Manual Call", icon: PhoneCall, description: "Staff makes a direct phone call", color: "text-primary" },
] as const;

function TaskCard({ task }: { task: CallTask }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState("");
  const [expanded, setExpanded] = useState(false);

  const logOutcome = useLogCallOutcome({
    mutation: {
      onSuccess: () => {
        toast({ title: "Outcome logged", description: `Task for ${task.patientName} marked complete.` });
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
      },
      onError: () => toast({ title: "Failed to log outcome", variant: "destructive" }),
    },
  });

  const updateAction = useUpdateCallTaskActionType({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
      },
    },
  });

  const isComplete = !!task.completedAt;
  const currentAction = ACTION_TYPES.find(a => a.value === task.actionType) ?? ACTION_TYPES[2];

  return (
    <div className={`rounded-lg border bg-card p-4 space-y-3 ${isComplete ? "opacity-60 border-border" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isComplete ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"}`}>
          {task.patientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{task.patientName}</p>
            {isComplete && <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full font-medium">Completed</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{task.phone}</span>
            </div>
            {task.whatsappNumber && task.whatsappNumber !== task.phone && (
              <span className="text-xs text-muted-foreground">WA: {task.whatsappNumber}</span>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" />
          {formatDate(task.flaggedAt)}
        </div>
      </div>

      <div className="rounded-md bg-muted/40 px-3 py-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Reason</p>
        <p className="text-sm">{task.reason}</p>
      </div>

      {!isComplete && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Follow-up Method</p>
          <div className="grid grid-cols-3 gap-2">
            {ACTION_TYPES.map((action) => {
              const Icon = action.icon;
              const isSelected = task.actionType === action.value;
              return (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => {
                    if (!isSelected) {
                      updateAction.mutate({ id: task.id, data: { actionType: action.value } });
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-md border text-center transition-colors text-xs font-medium ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-border/80 text-muted-foreground hover:text-foreground"
                  }`}
                  title={action.description}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? "text-primary" : action.color}`} />
                  {action.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{currentAction.description}</p>
        </div>
      )}

      {isComplete ? (
        <div className="rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Outcome</p>
          <p className="text-sm">{task.outcome}</p>
          <p className="text-xs text-muted-foreground mt-1">
            via {currentAction.label} · {formatDate(task.completedAt!)}
          </p>
        </div>
      ) : (
        <div>
          {!expanded ? (
            <Button size="sm" className="gap-2 w-full" onClick={() => setExpanded(true)}>
              <CheckCircle className="w-4 h-4" />
              Log Outcome
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                logOutcome.mutate({ id: task.id, data: { outcome } });
              }}
              className="space-y-2"
            >
              <Input
                placeholder="Describe what happened..."
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                required
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)} className="flex-1">Cancel</Button>
                <Button type="submit" size="sm" className="flex-1" disabled={logOutcome.isPending}>
                  {logOutcome.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function CallTasks() {
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: tasks = [], isLoading } = useListCallTasks({ completed: showCompleted }, {});

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Call Tasks</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Patients flagged for follow-up — choose the method per patient</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompleted(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!showCompleted ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setShowCompleted(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showCompleted ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Completed
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Phone className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{showCompleted ? "No completed tasks" : "No open tasks"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
