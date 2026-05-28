import { useState } from "react";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import { post } from "@/lib/api";
import { CheckCircle2, XCircle, Loader2, Play, PlayCircle, Mail, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type TestStatus = "idle" | "running" | "passed" | "failed";

interface AutomationTest {
  type: string;
  label: string;
  description: string;
  category: string;
}

const AUTOMATIONS: AutomationTest[] = [
  // Appointment
  { type: "appointment_confirmation",  label: "Appointment Confirmation",       description: "Sent when a nurse books an appointment", category: "Appointments" },
  { type: "appointment_reminder_24h",  label: "Appointment Reminder (24h)",     description: "Sent 24 hours before scheduled appointment", category: "Appointments" },
  { type: "appointment_reminder_2h",   label: "Appointment Reminder (2h)",      description: "Sent 2 hours before scheduled appointment", category: "Appointments" },
  { type: "no_show_followup",          label: "No-Show Follow-up",              description: "Sent ~75 minutes after a missed appointment", category: "Appointments" },
  // Post-treatment
  { type: "post_treatment_day1",       label: "Post-Treatment Day 1 Check-in",  description: "Sent the day after treatment ends", category: "Post-Treatment" },
  { type: "post_treatment_day4",       label: "Post-Treatment Day 4 Check-in",  description: "Sent 4 days after treatment ends", category: "Post-Treatment" },
  { type: "post_treatment_day7",       label: "Post-Treatment Day 7 Check-in",  description: "Sent 7 days after treatment ends", category: "Post-Treatment" },
  // Ongoing patient care
  { type: "post_care_email",           label: "Post-Care Wellness (30-day)",    description: "Sent 30 days after last treatment — Active patients", category: "Patient Care" },
  { type: "birthday_email",            label: "Birthday Email",                 description: "Sent on the patient's birthday each year", category: "Patient Care" },
  { type: "feedback_email",            label: "Feedback Request",               description: "Sent the day after a queue visit", category: "Patient Care" },
  // AI-generated
  { type: "care_plan_email",           label: "Care Plan Summary (AI — Claude)", description: "Claude-written care plan email, sent 20 min after plan creation", category: "AI Emails" },
  { type: "in_care_reminder_morning",  label: "In-Care Morning Reminder (AI — OpenAI)", description: "OpenAI-written morning care reminder for in-care patients", category: "AI Emails" },
  { type: "care_visit_reminder",       label: "Care Visit Reminder (AI — OpenAI)", description: "OpenAI-written reminder for specialist department visits", category: "AI Emails" },
  // Manual triggers
  { type: "call_task_manual",          label: "Manual Patient Message",         description: "Custom message typed by a nurse or receptionist", category: "Manual" },
];

const CATEGORIES = ["Appointments", "Post-Treatment", "Patient Care", "AI Emails", "Manual"];

interface TestResult {
  ok: boolean;
  error?: string;
}

export default function AutomationTests() {
  const [hospitalId, setHospitalId] = useState<string>("");
  const [toEmail, setToEmail] = useState("");
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [runningAll, setRunningAll] = useState(false);

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["hospitals"],
    queryFn: () => api.listHospitals(),
  });

  const activeHospitals = hospitals.filter(h => h.active);

  function setStatus(type: string, status: TestStatus, error?: string) {
    setStatuses(prev => ({ ...prev, [type]: status }));
    setErrors(prev => error ? { ...prev, [type]: error } : { ...prev, [type]: "" });
  }

  async function runTest(type: string): Promise<boolean> {
    if (!hospitalId || !toEmail) return false;
    setStatus(type, "running");
    try {
      await post<TestResult>("/super-admin/automation-test", {
        automationType: type,
        hospitalId: Number(hospitalId),
        toEmail,
      });
      setStatus(type, "passed");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus(type, "failed", msg);
      return false;
    }
  }

  async function runAll() {
    if (!hospitalId || !toEmail || runningAll) return;
    setRunningAll(true);
    for (const a of AUTOMATIONS) {
      await runTest(a.type);
    }
    setRunningAll(false);
  }

  function resetAll() {
    setStatuses({});
    setErrors({});
  }

  const totalRan = AUTOMATIONS.filter(a => statuses[a.type] && statuses[a.type] !== "idle").length;
  const totalPassed = AUTOMATIONS.filter(a => statuses[a.type] === "passed").length;
  const totalFailed = AUTOMATIONS.filter(a => statuses[a.type] === "failed").length;
  const canRun = !!hospitalId && toEmail.includes("@");

  return (
    <Layout breadcrumb={[{ label: "Automation Tests" }]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">Email Automation Tests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fire each email automation to a test address and confirm delivery. AI emails (Claude/OpenAI) generate real content.
          </p>
        </div>

        {/* Config panel */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hospital</label>
              <select
                value={hospitalId}
                onChange={e => setHospitalId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a hospital…</option>
                {activeHospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Test Email Address</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input
                  type="email"
                  value={toEmail}
                  onChange={e => setToEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-9 rounded-lg border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Summary + Run All */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1 border-t border-border">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {totalRan > 0 && (
                <>
                  <span>{totalRan}/{AUTOMATIONS.length} run</span>
                  {totalPassed > 0 && <span className="text-emerald-400">{totalPassed} passed</span>}
                  {totalFailed > 0 && <span className="text-red-400">{totalFailed} failed</span>}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalRan > 0 && (
                <button
                  onClick={resetAll}
                  disabled={runningAll}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-white/5 transition disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
              <button
                onClick={runAll}
                disabled={!canRun || runningAll}
                className="flex items-center gap-1.5 px-4 h-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-40"
              >
                {runningAll
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Running…</>
                  : <><PlayCircle className="w-3.5 h-3.5" />Run All</>}
              </button>
            </div>
          </div>
        </div>

        {/* Test list by category */}
        {CATEGORIES.map(cat => {
          const items = AUTOMATIONS.filter(a => a.category === cat);
          return (
            <div key={cat} className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">{cat}</h2>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {items.map(a => {
                  const status = statuses[a.type] ?? "idle";
                  const error = errors[a.type];
                  return (
                    <div key={a.type} className="flex items-center gap-3 px-4 py-3">
                      {/* Status icon */}
                      <div className="shrink-0 w-5 flex items-center justify-center">
                        {status === "idle"    && <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />}
                        {status === "running" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                        {status === "passed"  && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {status === "failed"  && <XCircle className="w-4 h-4 text-red-400" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{a.label}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5 leading-tight truncate">
                          {status === "failed" && error ? (
                            <span className="text-red-400">{error}</span>
                          ) : (
                            a.description
                          )}
                        </p>
                      </div>

                      {/* Run button */}
                      <button
                        onClick={() => runTest(a.type)}
                        disabled={!canRun || status === "running" || runningAll}
                        className={`shrink-0 flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium transition disabled:opacity-40 ${
                          status === "passed" ? "text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10" :
                          status === "failed" ? "text-red-400 border border-red-400/30 hover:bg-red-400/10" :
                          "text-muted-foreground border border-border hover:text-foreground hover:bg-white/5"
                        }`}
                      >
                        {status === "running"
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Play className="w-3 h-3" />}
                        {status === "passed" ? "Re-run" : status === "failed" ? "Retry" : "Run"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Note */}
        <p className="text-xs text-muted-foreground/40 pb-4">
          All test emails are sent to the address above using each hospital's actual sender configuration. AI emails consume real API tokens. Test entries logged with patient ID −1 to avoid affecting real patient data.
        </p>
      </div>
    </Layout>
  );
}
