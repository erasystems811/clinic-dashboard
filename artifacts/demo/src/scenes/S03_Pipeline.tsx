import { Badge } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import { PIPELINE_STAGES } from "@/types";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

// Fake patients per stage for realism
const FAKE_PATIENTS: Record<string, string[]> = {
  "Booked":         ["Ngozi Adeyemi", "Emeka Okonkwo", "Fatima Bello"],
  "Queued":         ["Chukwudi Nwachukwu", "Amaka Eze"],
  "In Care":        ["Biodun Abiodun", "Hauwa Musa", "Sade Okafor"],
  "Post Treatment": ["Tunde Alabi", "Chioma Obi", "Yusuf Garba", "Blessing Nwosu"],
  "Active":         ["Oluwaseun Adeleke", "Kelechi Obi", "Aisha Mohammed"],
  "Dormant":        ["Rotimi Adebayo"],
};

export default function S03_Pipeline({ prospect, onNext }: Props) {

  return (
    <div className="relative flex flex-col h-full space-y-6">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground mt-1">Live view of patients across each clinical stage.</p>
      </div>

      <div className="flex-1 overflow-x-auto pb-20">
        <div className="flex gap-5 min-w-max">
          {PIPELINE_STAGES.map((stage) => {
            const patients = FAKE_PATIENTS[stage.name] ?? [];
            const isActive = stage.name === "Active";
            return (
              <div key={stage.name} className="w-56 flex flex-col">
                {/* Stage header */}
                <div className="flex items-center justify-between mb-3 bg-card px-3 py-2.5 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-semibold text-sm">{stage.name}</span>
                  </div>
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {stage.name === "Active" ? patients.length + 1 : patients.length}
                  </Badge>
                </div>

                {/* Patient cards */}
                <div className="space-y-2">
                  {/* Prospect's card appears in Active with highlight */}
                  {isActive && (
                    <div className="relative bg-primary/10 border border-primary/40 px-2.5 py-1.5 rounded-md scale-in">
                      <div className="demo-spotlight" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 border border-primary/30">
                          {prospect.firstName[0]}{prospect.lastName[0]}
                        </div>
                        <span className="text-xs font-semibold leading-tight truncate text-primary">
                          {prospect.firstName} {prospect.lastName}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0">ERA-001</span>
                      </div>
                      <p className="text-[9px] text-primary/60 mt-0.5 ml-[26px]">Just registered</p>
                    </div>
                  )}
                  {patients.map((name) => (
                    <div key={name} className="bg-card px-2.5 py-1.5 rounded-md border border-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-secondary text-muted-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
                          {name[0]}{name.split(" ")[1]?.[0]}
                        </div>
                        <span className="text-xs font-medium leading-tight truncate flex-1">{name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <NarrationBubble
        text={<><strong>{prospect.firstName} {prospect.lastName}</strong> is now live in the pipeline. Watch how they move through each stage as their journey progresses.</>}
        onNext={onNext}
        nextLabel="Next →"
      />
    </div>
  );
}
