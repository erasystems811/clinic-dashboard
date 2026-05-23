import { useState } from "react";
import { Link } from "wouter";
import { useListPatients, getListPatientsQueryKey, useListPipelineStages, getListPipelineStagesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Patients() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: stages } = useListPipelineStages({
    query: { queryKey: getListPipelineStagesQueryKey() }
  });

  const { data: patients, isLoading } = useListPatients(
    { search: search || undefined, stage: stageFilter !== "all" ? stageFilter : undefined },
    { query: { queryKey: getListPatientsQueryKey({ search: search || undefined, stage: stageFilter !== "all" ? stageFilter : undefined }) } }
  );

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
              placeholder="Search by name, ID, email, or phone..."
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
                  <TableHead>Hospital ID</TableHead>
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
                ) : patients?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No patients found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  patients?.map((patient) => {
                    const stageColor = stages?.find(s => s.name === patient.stage)?.color || "gray";
                    return (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer hover:bg-muted/30 group"
                        onClick={() => window.location.href = `${import.meta.env.BASE_URL}patients/${patient.id}/history`.replace('//', '/')}
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
                          {patient.hospitalId || <span className="opacity-40">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{patient.email}</span>
                            <span className="text-xs text-muted-foreground">{patient.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            style={{ borderColor: stageColor, color: stageColor, backgroundColor: `${stageColor}15` }}
                          >
                            {patient.stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{patient.department || "—"}</TableCell>
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
        </div>
      </div>
    </Layout>
  );
}
