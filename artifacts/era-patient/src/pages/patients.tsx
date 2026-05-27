import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useListPatients, useListPipelineStages, getListPipelineStagesQueryKey, type Patient } from "@workspace/api-client-react";
import { getPatientStages } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, ChevronRight, ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 50;

export default function Patients() {
  const { hospitalConfig } = useAuth();
  const apptEnabled = hospitalConfig?.modules?.appointmentsEnabled ?? true;
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);

  const offset = page * PAGE_SIZE;

  const { data: stages } = useListPipelineStages({
    query: { queryKey: getListPipelineStagesQueryKey() }
  });

  const { data: pageData, isLoading } = useListPatients(
    {
      search: search || undefined,
      stage: stageFilter !== "all" ? stageFilter : undefined,
      limit: PAGE_SIZE,
      offset,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: true } as any }
  );

  useEffect(() => {
    if (pageData !== undefined) {
      setAllPatients(pageData);
    }
  }, [pageData]);

  useEffect(() => {
    setPage(0);
  }, [search, stageFilter]);

  const hasMore = (pageData?.length ?? 0) === PAGE_SIZE;
  const start = offset + 1;
  const end = offset + (pageData?.length ?? 0);

  return (
    <Layout>
      <div className="flex flex-col h-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
            <p className="text-muted-foreground mt-1">Click any patient to open their full file.</p>
          </div>
          <Link href="/patients/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Patient
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages?.map(stage => (
                  <SelectItem key={stage.id} value={stage.name}>{stage.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : allPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No patients found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  allPatients.map((patient) => {
                    return (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer hover:bg-muted/30 group"
                        onClick={() => setLocation(`/patients/${patient.id}/history`)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs border border-border shrink-0">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </div>
                            <span>{patient.firstName} {patient.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">
                          {patient.patientId || <span className="opacity-40">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{patient.email}</span>
                            <span className="text-xs text-muted-foreground">{patient.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getPatientStages(patient as never, { apptEnabled }).map(s => {
                              const sc = stages?.find(st => st.name === s)?.color || "gray";
                              return (
                                <Badge key={s} variant="outline" style={{ borderColor: sc, color: sc, backgroundColor: `${sc}15` }}>
                                  {s}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const depts = ((patient as Record<string, unknown>).carePlanDepartments as string[] | undefined) ?? [];
                              const all = depts.length > 0 ? depts : (patient.department ? [patient.department] : []);
                              return all.length === 0 ? <span className="text-muted-foreground text-sm">—</span> : all.map(d => (
                                <span key={d} className="text-xs bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground">{d}</span>
                              ));
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && allPatients.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card shrink-0">
              <span className="text-xs text-muted-foreground">
                Showing {start}–{end} patients
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground px-1">Page {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
