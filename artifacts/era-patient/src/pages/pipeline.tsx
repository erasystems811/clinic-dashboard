import { Link } from "wouter";
import { useListPatients, getListPatientsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Users } from "lucide-react";

export default function Pipeline() {
  const { data: patients, isLoading } = useListPatients(
    {},
    { query: { queryKey: getListPatientsQueryKey({}) } }
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            All patients and the departments they are currently receiving treatment from.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex gap-8">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-48" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-border last:border-0 flex gap-8">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-56" />
              </div>
            ))}
          </div>
        ) : !patients || patients.length === 0 ? (
          <div className="rounded-xl border border-border py-20 text-center">
            <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground text-sm">No patients registered yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_3fr] gap-4 px-5 py-3 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient Name</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient ID</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Departments
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {patients.map((patient) => {
                const depts = (patient as unknown as Record<string, unknown>).carePlanDepartments as string[] | undefined;
                const hasDepts = depts && depts.length > 0;

                return (
                  <Link key={patient.id} href={`/patients/${patient.id}/history`}>
                    <div className="grid grid-cols-[2fr_1fr_3fr] gap-4 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer group">
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 border border-primary/20">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {patient.firstName} {patient.lastName}
                        </span>
                      </div>

                      {/* ID */}
                      <div className="flex items-center">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          {patient.patientId}
                        </span>
                      </div>

                      {/* Departments */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasDepts ? (
                          depts.map((dept) => (
                            <Badge
                              key={dept}
                              variant="secondary"
                              className="text-xs font-normal flex items-center gap-1"
                            >
                              <Building2 className="w-3 h-3" />
                              {dept}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No departments yet</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/20">
              <span className="text-xs text-muted-foreground">{patients.length} patient{patients.length !== 1 ? "s" : ""} total</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
