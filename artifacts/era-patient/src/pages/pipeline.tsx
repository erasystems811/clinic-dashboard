import { useMemo } from "react";
import { Link } from "wouter";
import { 
  useListPatients, 
  getListPatientsQueryKey,
  useListPipelineStages,
  getListPipelineStagesQueryKey
} from "@workspace/api-client-react";
import { getPatientStages } from "@/lib/utils";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, GitBranch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Pipeline() {
  const { data: stages, isLoading: stagesLoading } = useListPipelineStages({
    query: { queryKey: getListPipelineStagesQueryKey() }
  });

  const { data: patients, isLoading: patientsLoading } = useListPatients(
    {},
    { query: { queryKey: getListPatientsQueryKey({}) } }
  );

  const groupedPatients = useMemo(() => {
    if (!patients || !stages) return {};
    
    const grouped: Record<string, typeof patients> = {};
    stages.forEach(stage => {
      // A patient can be in multiple stages simultaneously — show them in every matching column
      grouped[stage.name] = patients.filter(
        p => getPatientStages(p as never).includes(stage.name)
      );
    });
    return grouped;
  }, [patients, stages]);

  const isLoading = stagesLoading || patientsLoading;

  return (
    <Layout>
      <div className="flex flex-col h-full space-y-6">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
            <p className="text-muted-foreground mt-1">
              Visual overview of patients across clinical stages.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-6 h-full min-w-max">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-80 flex flex-col gap-4">
                  <div className="h-12 rounded-lg bg-card border border-border flex items-center px-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-8 rounded-full ml-auto" />
                  </div>
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              ))
            ) : stages?.map((stage) => (
              <div key={stage.id} className="w-80 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 bg-card p-3 rounded-lg border border-border shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h3 className="font-semibold">{stage.name}</h3>
                  </div>
                  <Badge variant="secondary" className="rounded-full">{groupedPatients[stage.name]?.length || 0}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                  {groupedPatients[stage.name]?.map((patient) => (
                    <Link key={patient.id} href={`/patients/${patient.id}`}>
                      <div className="bg-card p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold group-hover:text-primary transition-colors">
                            {patient.firstName} {patient.lastName}
                          </h4>
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] border border-border">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </div>
                        </div>
                        
                        <div className="space-y-2 mt-3">
                          <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{patient.department || 'No department'}</span>
                          </div>
                          {patient.nextAppointment && (
                            <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                              <Calendar className="w-3 h-3" />
                              <span>{format(new Date(patient.nextAppointment), "MMM d, yyyy")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  
                  {(!groupedPatients[stage.name] || groupedPatients[stage.name].length === 0) && (
                    <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm opacity-50">
                      Empty stage
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}