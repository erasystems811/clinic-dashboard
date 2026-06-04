import { useMemo, useState } from "react";
import {
  useListPatients,
  getListPatientsQueryKey,
  useListPipelineStages,
  getListPipelineStagesQueryKey,
} from "@workspace/api-client-react";
import { getPatientStages } from "@/lib/utils";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Building2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";

const CARD_RENDER_LIMIT = 200;

export default function Pipeline() {
  const { hospitalConfig } = useAuth();
  const apptEnabled = hospitalConfig?.modules?.appointmentsEnabled ?? true;

  const { data: allStages, isLoading: stagesLoading } = useListPipelineStages({
    query: { queryKey: getListPipelineStagesQueryKey() },
  });

  const stages = useMemo(
    () => (allStages ?? []).filter(s => apptEnabled || s.name !== "Booked"),
    [allStages, apptEnabled]
  );

  const { data: patients, isLoading: patientsLoading } = useListPatients(
    { limit: 2000 },
    { query: { queryKey: getListPatientsQueryKey({ limit: 2000 }) } }
  );

  const groupedPatients = useMemo(() => {
    if (!patients || !stages) return {};
    const grouped: Record<string, typeof patients> = {};
    stages.forEach((stage) => {
      grouped[stage.name] = patients.filter((p) =>
        getPatientStages(p as never, { apptEnabled }).includes(stage.name)
      );
    });
    return grouped;
  }, [patients, stages]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isLoading = stagesLoading || patientsLoading;

  return (
    <Layout>
      <div className="flex flex-col h-full space-y-6">
        <div className="shrink-0">
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Live view of patients across each clinical stage. Open patient files from the Patients tab.
          </p>
        </div>

        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-5 h-full min-w-max">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-64 flex flex-col gap-3">
                    <div className="h-10 rounded-lg bg-card border border-border flex items-center px-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-6 rounded-full ml-auto" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ))
              : stages.map((stage) => {
                  const list = groupedPatients[stage.name] ?? [];
                  const isLarge = list.length > CARD_RENDER_LIMIT;
                  const isExpanded = expanded.has(stage.name);

                  return (
                    <div key={stage.id} className="w-64 flex flex-col h-full">
                      {/* Stage header */}
                      <div className="flex items-center justify-between mb-3 bg-card px-3 py-2.5 rounded-lg border border-border shrink-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="font-semibold text-sm">{stage.name}</span>
                        </div>
                        <Badge variant="secondary" className="rounded-full text-xs">
                          {list.length}
                        </Badge>
                      </div>

                      {/* Patient list */}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                        {list.length === 0 ? (
                          <div className="h-10 border-2 border-dashed border-border rounded-md flex items-center justify-center text-muted-foreground text-xs opacity-40">
                            No patients
                          </div>
                        ) : isLarge && !isExpanded ? (
                          /* Count summary for large columns — show cards only if forced */
                          <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-center">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                              <Users className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{list.length.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{stage.name} patients</p>
                            </div>
                            <button
                              onClick={() => setExpanded(prev => { const s = new Set(prev); s.add(stage.name); return s; })}
                              className="w-full py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-muted/50 transition-colors"
                            >
                              Show all cards
                            </button>
                          </div>
                        ) : (
                          <>
                            {isLarge && isExpanded && (
                              <div className="flex items-center justify-between px-1 pb-1">
                                <span className="text-[10px] text-muted-foreground">{list.length} cards</span>
                                <button
                                  onClick={() => setExpanded(prev => { const s = new Set(prev); s.delete(stage.name); return s; })}
                                  className="text-[10px] text-primary hover:underline"
                                >
                                  Collapse
                                </button>
                              </div>
                            )}
                            {list.map((patient) => {
                              const depts = (patient as unknown as Record<string, unknown>)
                                .carePlanDepartments as string[] | undefined;
                              return (
                                <div
                                  key={patient.id}
                                  className="bg-card px-2.5 py-1.5 rounded-md border border-border"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 border border-primary/20">
                                      {patient.firstName[0]}{patient.lastName[0]}
                                    </div>
                                    <span className="text-xs font-medium leading-tight truncate flex-1">
                                      {patient.firstName} {patient.lastName}
                                    </span>
                                    <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                                      {patient.patientId}
                                    </span>
                                  </div>
                                  {depts && depts.length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-1">
                                      {depts.map((dept) => (
                                        <span
                                          key={dept}
                                          className="inline-flex items-center gap-0.5 text-[9px] px-1 py-px rounded bg-secondary text-secondary-foreground border border-border"
                                        >
                                          <Building2 className="w-2 h-2" />
                                          {dept}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
