import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface VitalsSettings {
  trackBP?: boolean;
  trackSugar?: boolean;
  trackWeight?: boolean;
}

interface VitalsLog {
  bpSystolic?: number;
  bpDiastolic?: number;
  bloodSugar?: number;
  weight?: number;
}

export default function VitalsPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: VitalsSettings; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("vitals");
  const saveModule = useSaveModule("vitals");
  const logToday = useLogToday("vitals");

  const mod = modules?.vitals;
  const settings: VitalsSettings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;

  const [setupMode, setSetupMode] = useState(false);
  const [trackBP, setTrackBP] = useState(settings.trackBP ?? true);
  const [trackSugar, setTrackSugar] = useState(settings.trackSugar ?? true);
  const [trackWeight, setTrackWeight] = useState(settings.trackWeight ?? true);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === todayStr)?.data as VitalsLog | undefined;

  const [bpS, setBpS] = useState(String(todayLog?.bpSystolic ?? ""));
  const [bpD, setBpD] = useState(String(todayLog?.bpDiastolic ?? ""));
  const [sugar, setSugar] = useState(String(todayLog?.bloodSugar ?? ""));
  const [weight, setWeight] = useState(String(todayLog?.weight ?? ""));
  const [saved, setSaved] = useState(!!todayLog);

  function saveSetup() {
    saveModule.mutate({ settings: { trackBP, trackSugar, trackWeight }, enabled: true });
    setSetupMode(false);
  }

  function saveLog() {
    const data: VitalsLog = {};
    if (settings.trackBP && bpS && bpD) { data.bpSystolic = parseFloat(bpS); data.bpDiastolic = parseFloat(bpD); }
    if (settings.trackSugar && sugar) data.bloodSugar = parseFloat(sugar);
    if (settings.trackWeight && weight) data.weight = parseFloat(weight);
    logToday.mutate(data, { onSuccess: () => setSaved(true) });
  }

  function trend(key: keyof VitalsLog): "up" | "down" | "flat" | null {
    if (!weekLogs || weekLogs.length < 2) return null;
    const vals = weekLogs.map((l) => (l.data as VitalsLog)[key]).filter((v) => v != null) as number[];
    if (vals.length < 2) return null;
    const last = vals[vals.length - 1];
    const prev = vals[vals.length - 2];
    if (last > prev) return "up";
    if (last < prev) return "down";
    return "flat";
  }

  function TrendIcon({ t }: { t: "up" | "down" | "flat" | null }) {
    if (!t || t === "flat") return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    if (t === "up") return <TrendingUp className="w-3.5 h-3.5 text-rose-500" />;
    return <TrendingDown className="w-3.5 h-3.5 text-green-500" />;
  }

  if (isLoading) return <Spinner />;

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setupMode ? setSetupMode(false) : navigate("/wellness")}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-2xl">❤️</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Body Vitals</h1>
            <p className="text-sm text-muted-foreground">Choose what to track</p>
          </div>
        </div>
        <div className="space-y-3 mb-6">
          {[
            { key: "bp", label: "Blood Pressure", sub: "Systolic / Diastolic (mmHg)", val: trackBP, set: setTrackBP },
            { key: "sugar", label: "Blood Sugar", sub: "mmol/L or mg/dL", val: trackSugar, set: setTrackSugar },
            { key: "weight", label: "Weight", sub: "in kg", val: trackWeight, set: setTrackWeight },
          ].map((item) => (
            <button key={item.key} onClick={() => item.set(!item.val)}
              className={cn("w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition",
                item.val ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                item.val ? "border-primary bg-primary" : "border-muted-foreground")}>
                {item.val && <span className="text-primary-foreground text-xs font-bold">✓</span>}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={saveSetup} disabled={(!trackBP && !trackSugar && !trackWeight) || saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Save & Start Tracking"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">❤️</span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Body Vitals</h1>
          <p className="text-xs text-muted-foreground">Daily readings & trends</p>
        </div>
      </div>

      {/* Log today */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {saved ? "Today (logged)" : "Log today's readings"}
        </p>
        <div className="space-y-3">
          {settings.trackBP && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                Blood Pressure (mmHg) <TrendIcon t={trend("bpSystolic")} />
              </p>
              <div className="flex gap-2 items-center">
                <input type="number" value={bpS} onChange={(e) => { setBpS(e.target.value); setSaved(false); }}
                  placeholder="120" className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-base font-bold text-foreground text-center outline-none" />
                <span className="text-muted-foreground font-bold">/</span>
                <input type="number" value={bpD} onChange={(e) => { setBpD(e.target.value); setSaved(false); }}
                  placeholder="80" className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-base font-bold text-foreground text-center outline-none" />
              </div>
            </div>
          )}
          {settings.trackSugar && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                Blood Sugar (mmol/L) <TrendIcon t={trend("bloodSugar")} />
              </p>
              <input type="number" step="0.1" value={sugar} onChange={(e) => { setSugar(e.target.value); setSaved(false); }}
                placeholder="5.4" className="w-full bg-muted rounded-xl px-3 py-2.5 text-base font-bold text-foreground text-center outline-none" />
            </div>
          )}
          {settings.trackWeight && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                Weight (kg) <TrendIcon t={trend("weight")} />
              </p>
              <input type="number" step="0.1" value={weight} onChange={(e) => { setWeight(e.target.value); setSaved(false); }}
                placeholder="70.0" className="w-full bg-muted rounded-xl px-3 py-2.5 text-base font-bold text-foreground text-center outline-none" />
            </div>
          )}
        </div>
        <button onClick={saveLog} disabled={logToday.isPending}
          className={cn("w-full mt-4 py-3 rounded-xl font-semibold text-sm transition active:scale-95",
            saved ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground")}>
          {logToday.isPending ? "Saving…" : saved ? "Saved ✓ — update" : "Save readings"}
        </button>
      </div>

      {/* This week table */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Day</th>
                {settings.trackBP && <th className="text-right text-muted-foreground font-medium pb-2 pr-3">BP</th>}
                {settings.trackSugar && <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Sugar</th>}
                {settings.trackWeight && <th className="text-right text-muted-foreground font-medium pb-2">Weight</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (6 - i));
                const dateStr = d.toISOString().split("T")[0];
                const log = weekLogs?.find((l) => l.log_date === dateStr)?.data as VitalsLog | undefined;
                const isToday = dateStr === todayStr;
                return (
                  <tr key={i} className={isToday ? "font-semibold" : ""}>
                    <td className={cn("pr-3 py-1", isToday ? "text-primary" : "text-muted-foreground")}>{DAY_LABELS[d.getDay()]}</td>
                    {settings.trackBP && <td className="text-right pr-3 py-1 text-foreground">{log?.bpSystolic ? `${log.bpSystolic}/${log.bpDiastolic}` : "—"}</td>}
                    {settings.trackSugar && <td className="text-right pr-3 py-1 text-foreground">{log?.bloodSugar ?? "—"}</td>}
                    {settings.trackWeight && <td className="text-right py-1 text-foreground">{log?.weight ?? "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit settings
      </button>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
