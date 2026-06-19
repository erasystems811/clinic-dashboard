import { useState, useCallback, useEffect, useRef } from "react";
import { Button, Input, Card, CardContent } from "@/components/ui";
import DemoShell from "@/components/DemoShell";
import RoleSwitchOverlay from "@/components/RoleSwitchOverlay";
import SMSBanner from "@/components/SMSBanner";
import { SCENES } from "@/types";
import type { Prospect, Role } from "@/types";
import { apiUrl } from "@/lib/utils";

import S01_Dashboard from "@/scenes/S01_Dashboard";
import S02_NewPatient from "@/scenes/S02_NewPatient";
import S03_Pipeline from "@/scenes/S03_Pipeline";
import S04_Queue from "@/scenes/S04_Queue";
import S05_QueueCalledIn from "@/scenes/S05_QueueCalledIn";
import S06_NurseStation from "@/scenes/S06_NurseStation";
import S07_MessageLog from "@/scenes/S07_MessageLog";
import S08_Automations from "@/scenes/S08_Automations";
import S08_DoctorView from "@/scenes/S08_DoctorView";
import S09_Feedback from "@/scenes/S09_Feedback";
import S10_SelfBooking from "@/scenes/S_SelfBooking";
import S11_EMRCallout from "@/scenes/S10_EMRCallout";
import S12_CTA from "@/scenes/S11_CTA";

// ── Landing page ──────────────────────────────────────────────────────────────
function LandingPage({ onStart }: { onStart: (p: Prospect) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    const sessionId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await fetch(apiUrl("/api/demo/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() }),
      });
    } catch {
      // non-blocking — demo still runs if API is unavailable
    }
    setLoading(false);
    onStart({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim(), sessionId });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="px-8 py-4 border-b border-border flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-sm bg-primary" />
        </div>
        <span className="text-sm font-bold">ERA Systems</span>
        <span className="ml-auto text-xs text-muted-foreground">Interactive Demo</span>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-xl w-full space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live interactive demo
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
              The clinic management<br />
              system that <span className="text-primary">works for you.</span>
            </h1>
            <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
              ERA Patient handles your queue, care plans, automations, and patient communication — so your team focuses on care, not admin.
            </p>

            {/* Problem bullets */}
            <div className="grid grid-cols-1 gap-2 text-left max-w-sm mx-auto pt-2">
              {[
                "Patients leave because they don't know how long they'll wait",
                "No-shows with no warning and no automatic follow-up",
                "Medication instructions lost on paper slips",
                "No visibility into which patients stopped coming back",
                "Feedback that never gets collected",
                "Double entry between your hospital systems",
              ].map(p => (
                <div key={p} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  {p}
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-primary">ERA solves all of this. See how below.</p>
          </div>

          <Card className="max-w-sm mx-auto text-left">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">First Name</label>
                  <Input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="e.g. Chike"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Last Name</label>
                  <Input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="e.g. Okonkwo"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Email Address</label>
                  <Input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. chike@gmail.com"
                    type="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Phone Number</label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    type="tel"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Starting demo…" : "Start interactive demo →"}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  No account needed. Your info personalises the demo.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Social proof */}
          <div className="flex justify-center gap-8 text-center">
            {[["248+", "Patients managed"], ["6", "Automation stages"], ["4", "Staff role views"]].map(([n, l]) => (
              <div key={l}>
                <p className="text-2xl font-bold text-primary">{n}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Progress bar at the top of the demo ──────────────────────────────────────
function DemoProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur border-b border-border">
      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">{current + 1} / {total}</span>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [scene, setScene]       = useState(0);
  const [roleSwitchRole, setRoleSwitchRole] = useState<Role | null>(null);
  const [pendingScene, setPendingScene]     = useState<number | null>(null);
  const [smsBanner, setSmsBanner] = useState<{ msg: string; visible: boolean }>({ msg: "", visible: false });
  const smsDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSMS = useCallback((msg: string) => {
    setSmsBanner({ msg, visible: true });
    if (smsDismissTimer.current) clearTimeout(smsDismissTimer.current);
    smsDismissTimer.current = setTimeout(() => setSmsBanner(s => ({ ...s, visible: false })), 9000);
  }, []);

  const advanceScene = useCallback(() => {
    const nextIdx = scene + 1;
    if (nextIdx >= SCENES.length) return;
    const currentRole = SCENES[scene].role;
    const nextRole    = SCENES[nextIdx].role;

    // Only show the role-switch overlay when switching TO a real staff role.
    // Transitions to/from null-role (full-screen) scenes advance directly.
    if (nextRole !== null && nextRole !== currentRole) {
      setPendingScene(nextIdx);
      setRoleSwitchRole(nextRole);
    } else {
      setScene(nextIdx);
    }
  }, [scene]);

  useEffect(() => {
    if (prospect) {
      try {
        fetch(apiUrl("/api/demo/progress"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: prospect.sessionId,
            stageReached: String(SCENES[scene].id),
            completed: scene === SCENES.length - 1,
          }),
        }).catch(() => {});
      } catch { /* ignore */ }
    }
  }, [scene, prospect]);

  if (!prospect) {
    return <LandingPage onStart={setProspect} />;
  }

  const meta = SCENES[scene];

  const sceneProps = {
    prospect,
    onNext: advanceScene,
    onSMSBanner: showSMS,
  };

  const SCENE_MAP: Record<number, React.ReactNode> = {
    0:  <S01_Dashboard {...sceneProps} />,
    1:  <S02_NewPatient {...sceneProps} />,
    2:  <S03_Pipeline {...sceneProps} />,
    3:  <S04_Queue {...sceneProps} />,
    4:  <S05_QueueCalledIn {...sceneProps} />,
    5:  <S06_NurseStation {...sceneProps} />,
    6:  <S07_MessageLog {...sceneProps} />,
    7:  <S08_Automations prospect={prospect} onNext={advanceScene} />,
    8:  <S08_DoctorView {...sceneProps} />,
    9:  <S09_Feedback {...sceneProps} />,
    10: <S10_SelfBooking prospect={prospect} onNext={advanceScene} />,
    11: <S11_EMRCallout {...sceneProps} />,
    12: <S12_CTA prospect={prospect} />,
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      {/* SMS notification banner (floats above everything) */}
      <SMSBanner
        message={smsBanner.msg}
        visible={smsBanner.visible}
        onDismiss={() => setSmsBanner(s => ({ ...s, visible: false }))}
      />

      {/* Role switch overlay */}
      {roleSwitchRole && (
        <RoleSwitchOverlay
          role={roleSwitchRole}
          visible={!!roleSwitchRole}
          onDone={() => {
            if (pendingScene !== null) setScene(pendingScene);
            setPendingScene(null);
            setRoleSwitchRole(null);
          }}
        />
      )}

      {/* Demo chrome — ERA Patient shell */}
      <div className="relative flex-1 overflow-hidden">
        <DemoProgress current={scene} total={SCENES.length} />

        <div className="h-full pt-8">
          {meta.role !== null ? (
            <DemoShell role={meta.role} activePage={meta.page} userName={prospect.firstName}>
              <div key={scene} className="fade-in-up h-full">
                {SCENE_MAP[scene]}
              </div>
            </DemoShell>
          ) : (
            /* EMR callout + CTA are full-screen, no sidebar */
            <div className="h-full overflow-y-auto">
              <div key={scene} className="fade-in-up">
                {SCENE_MAP[scene]}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
