import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFlagMissedTreatment,
  getListCallTasksQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Flag, Bot, MessageSquare, PhoneCall, X } from "lucide-react";

const FOLLOWUP_TYPES = [
  {
    value: "automated_message" as const,
    label: "Automated Message",
    sub: "AI generates a follow-up message",
    icon: Bot,
    active: "border-violet-500 bg-violet-500/10 text-violet-400",
    color: "text-violet-400",
  },
  {
    value: "manual_text" as const,
    label: "Manual Text",
    sub: "Staff composes a personal text",
    icon: MessageSquare,
    active: "border-blue-500 bg-blue-500/10 text-blue-400",
    color: "text-blue-400",
  },
  {
    value: "manual_call" as const,
    label: "Manual Call",
    sub: "Staff makes a direct phone call",
    icon: PhoneCall,
    active: "border-primary bg-primary/10 text-primary",
    color: "text-primary",
  },
];

type FollowupType = typeof FOLLOWUP_TYPES[number]["value"];

interface ModalProps {
  patientName: string;
  patientId: number;
  onClose: () => void;
}

function MethodPicker({ value, onChange }: { value: FollowupType; onChange: (v: FollowupType) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Contact Method *</label>
      <div className="grid grid-cols-3 gap-2">
        {FOLLOWUP_TYPES.map(ft => {
          const Icon = ft.icon;
          const isSelected = value === ft.value;
          return (
            <button
              key={ft.value}
              type="button"
              onClick={() => onChange(ft.value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center text-xs transition-colors ${
                isSelected ? ft.active : "border-border hover:border-border/60 text-muted-foreground"
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? "" : ft.color}`} />
              <span className="font-semibold">{ft.label}</span>
              <span className="leading-snug opacity-80">{ft.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FollowUpFlagModal({ patientName, patientId, onClose }: ModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [actionType, setActionType] = useState<FollowupType>("manual_call");

  const flagMissed = useFlagMissedTreatment({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Follow-up task created",
          description: `${patientName} has been flagged. The task will appear in the receptionist's call list.`,
        });
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
        onClose();
      },
      onError: () => toast({ title: "Failed to flag patient", variant: "destructive" }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    flagMissed.mutate({ id: patientId, data: { reason, actionType } });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold">Flag for Follow-up</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="w-9 h-9 rounded-full bg-destructive/20 text-destructive font-bold text-sm flex items-center justify-center shrink-0">
              {patientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-sm">{patientName}</p>
              <p className="text-xs text-muted-foreground">Will be added to receptionist call tasks</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for follow-up *</label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Missed appointment, needs check-up reminder…"
              required
            />
          </div>

          <MethodPicker value={actionType} onChange={setActionType} />

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" className="flex-1" disabled={!reason.trim() || flagMissed.isPending}>
              {flagMissed.isPending ? "Flagging…" : "Flag & Create Task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
