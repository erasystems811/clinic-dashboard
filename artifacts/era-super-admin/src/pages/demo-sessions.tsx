import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, CheckCircle2, Clock, Phone, User, Search } from "lucide-react";
import Layout from "@/components/layout";
import { get } from "@/lib/api";

interface DemoSession {
  id: number;
  session_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  stage_reached: string | null;
  completed: boolean;
  started_at: string;
  completed_at: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  "1":  "Admin Dashboard",
  "2":  "Register Patient",
  "3":  "Live Pipeline",
  "4":  "Queue Management",
  "5":  "Patient Called In",
  "6":  "Treatment Plan",
  "7":  "Message Log",
  "8":  "Doctor View",
  "9":  "Feedback",
  "10": "EMR Integration",
  "11": "Get Started / CTA",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

export default function DemoSessionsPage() {
  const [search, setSearch] = useState("");

  const { data: sessions = [], isLoading } = useQuery<DemoSession[]>({
    queryKey: ["/api/demo/sessions"],
    queryFn: () => get<DemoSession[]>("/api/demo/sessions"),
    refetchInterval: 30_000,
  });

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.phone.includes(q)
    );
  });

  const completed = sessions.filter(s => s.completed).length;
  const dropOff   = sessions.length - completed;

  return (
    <Layout breadcrumb={[{ label: "Demo Sessions" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Demo Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">Prospects who started the interactive ERA Patient demo</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground font-medium">Total Sessions</p>
            <p className="text-3xl font-bold mt-1">{sessions.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground font-medium">Completed</p>
            <p className="text-3xl font-bold mt-1 text-primary">{completed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground font-medium">Dropped Off</p>
            <p className="text-3xl font-bold mt-1 text-amber-400">{dropOff}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground font-medium uppercase tracking-wide">
                <th className="px-4 py-3 w-8">#</th>
                <th className="px-4 py-3">Prospect</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Stage Reached</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    {sessions.length === 0 ? "No demo sessions yet. Share the demo link to get started." : "No results match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium">{s.first_name} {s.last_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" /> {s.phone}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.stage_reached ? (
                        <span className="text-xs font-medium">
                          {STAGE_LABELS[s.stage_reached] ?? `Scene ${s.stage_reached}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.completed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                          <Clock className="w-3.5 h-3.5" /> In progress
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(s.started_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
