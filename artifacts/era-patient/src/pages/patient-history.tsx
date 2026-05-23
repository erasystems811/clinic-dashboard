import { useRoute, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { useGetPatientHistory } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, User, Phone, Mail, Hash, Calendar, Stethoscope,
  ClipboardList, PhoneCall, MessageSquare, Bot, Activity, Star
} from "lucide-react";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "d MMM yyyy, HH:mm"); } catch { return iso; }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "d MMM yyyy"); } catch { return iso; }
}

const ACTION_ICONS: Record<string, typeof PhoneCall> = {
  automated_message: Bot,
  manual_text: MessageSquare,
  manual_call: PhoneCall,
};

const ACTIVITY_COLORS: Record<string, string> = {
  patient_created: "bg-green-500/20 text-green-400",
  stage_changed: "bg-blue-500/20 text-blue-400",
  checkin: "bg-primary/20 text-primary",
  dequeued: "bg-muted text-muted-foreground",
  treatment_plan_logged: "bg-violet-500/20 text-violet-400",
  treatment_reminder: "bg-amber-500/20 text-amber-400",
  missed_treatment_flagged: "bg-destructive/20 text-destructive",
  no_show: "bg-destructive/20 text-destructive",
  appointment_scheduled: "bg-teal-500/20 text-teal-400",
  appointment_rescheduled: "bg-amber-500/20 text-amber-400",
  call_task_completed: "bg-green-500/20 text-green-400",
  call_task_action_updated: "bg-muted text-muted-foreground",
};

export default function PatientHistory() {
  const [, params] = useRoute("/patients/:id/history");
  const id = parseInt(params?.id ?? "", 10);

  const { data, isLoading, error } = useGetPatientHistory({ id }, {});

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="py-20 text-center text-muted-foreground">
          <p>Patient not found.</p>
          <Link href="/patients" className="text-primary underline text-sm mt-2 inline-block">← Back to patients</Link>
        </div>
      </Layout>
    );
  }

  const { patient, activity, appointments, callTasks } = data;

  const treatmentTypes: Record<string, string> = {
    medication_only: "Medication Only",
    come_to_hospital: "Come to Hospital",
    combination: "Combination",
  };

  return (
    <Layout>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/patients">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              All Patients
            </button>
          </Link>
        </div>

        {/* Patient summary card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary text-xl font-bold flex items-center justify-center shrink-0 border border-primary/20">
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h1>
                <Badge variant="outline" className="font-normal">
                  {patient.stage}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {patient.hospitalId && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono">{patient.hospitalId}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {patient.phone}
                </div>
                {patient.whatsappNumber && patient.whatsappNumber !== patient.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    WA: {patient.whatsappNumber}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {patient.email}
                </div>
                {patient.age && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    {patient.age} yrs{patient.gender ? ` · ${patient.gender}` : ""}
                  </div>
                )}
                {patient.department && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                    {patient.department}
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Registered {fmt(patient.createdAt)}
              </div>
            </div>
          </div>

          {/* Diagnosis / notes */}
          {(patient.diagnosis || patient.notes) && (
            <div className="mt-5 grid md:grid-cols-2 gap-4 pt-5 border-t border-border">
              {patient.diagnosis && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Diagnosis</p>
                  <p className="text-sm">{patient.diagnosis}</p>
                </div>
              )}
              {patient.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm">{patient.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Treatment plan (if any) */}
        {patient.treatmentPlan && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Current Treatment Plan</h2>
              {patient.treatmentEndDate && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${new Date(patient.treatmentEndDate) > new Date() ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {new Date(patient.treatmentEndDate) > new Date() ? "Active" : "Ended"} · ends {fmtDate(patient.treatmentEndDate)}
                </span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Type</p>
                <p>{treatmentTypes[patient.treatmentType ?? ""] ?? patient.treatmentType ?? "—"}</p>
              </div>
              {patient.medicationTiming && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Medication Timing</p>
                  <p className="capitalize">{patient.medicationTiming.replace(/,/g, " · ")}</p>
                </div>
              )}
              {patient.treatmentDurationDays && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                  <p>{patient.treatmentDurationDays} days</p>
                </div>
              )}
              {patient.treatmentStartedAt && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Started</p>
                  <p>{fmtDate(patient.treatmentStartedAt)}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Plan Notes</p>
              <p className="text-sm whitespace-pre-wrap">{patient.treatmentPlan}</p>
            </div>
          </div>
        )}

        {/* Appointments */}
        {appointments.length > 0 && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Appointments ({appointments.length})</h2>
            </div>
            <div className="divide-y divide-border">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex flex-col items-center justify-center shrink-0 text-xs border border-border">
                    <span className="font-bold text-primary uppercase">{format(parseISO(appt.scheduledAt), "MMM")}</span>
                    <span className="font-bold leading-none">{format(parseISO(appt.scheduledAt), "d")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{appt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(appt.scheduledAt), "h:mm a")} · {appt.duration} min
                      {appt.department ? ` · ${appt.department}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    appt.status === "completed" ? "bg-green-500/10 text-green-400" :
                    appt.status === "no_show" ? "bg-destructive/10 text-destructive" :
                    appt.status === "rescheduled" ? "bg-amber-500/10 text-amber-400" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call Tasks */}
        {callTasks.length > 0 && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <PhoneCall className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Follow-up Tasks ({callTasks.length})</h2>
            </div>
            <div className="divide-y divide-border">
              {callTasks.map((task) => {
                const Icon = ACTION_ICONS[task.actionType] ?? PhoneCall;
                return (
                  <div key={task.id} className="px-5 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground capitalize">{task.actionType.replace(/_/g, " ")}</span>
                      <span className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full ${task.completedAt ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {task.completedAt ? "Done" : "Open"}
                      </span>
                    </div>
                    <p className="text-sm">{task.reason}</p>
                    {task.outcome && <p className="text-xs text-muted-foreground">Outcome: {task.outcome}</p>}
                    <p className="text-xs text-muted-foreground">{fmt(task.flaggedAt)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Activity Log */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Full Activity History ({activity.length} events)</h2>
          </div>
          {activity.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No activity recorded yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {[...activity].reverse().map((item) => {
                const colorClass = ACTIVITY_COLORS[item.type] ?? "bg-muted text-muted-foreground";
                return (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${colorClass.split(" ")[0]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmt(item.createdAt)}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ${colorClass}`}>
                      {item.type.replace(/_/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
