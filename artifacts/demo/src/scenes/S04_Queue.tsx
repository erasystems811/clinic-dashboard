import { useState } from "react";
import { Users, Search, Stethoscope, Loader2, Clock } from "lucide-react";
import { Button, Input } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props {
  prospect: Prospect;
  onNext: () => void;
  onSMSBanner: (msg: string) => void;
}

export default function S04_Queue({ prospect, onNext, onSMSBanner }: Props) {
  const [step, setStep]       = useState<"search" | "found" | "added">("search");
  const [isAdding, setIsAdding] = useState(false);

  function handleSearch() {
    setStep("found");
  }

  function handleAddToQueue() {
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      setStep("added");
      onSMSBanner(`Hello ${prospect.firstName}, you've been added to the queue at ERA Hospital. Your current position is #1. We'll keep you updated.`);
    }, 800);
  }

  return (
    <div className="relative space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Queue Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Live patient queue</p>
        </div>
      </div>

      {/* Current Queue */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Current Queue</span>
          <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
            {step === "added" ? "1 waiting" : "0 waiting"}
          </span>
        </div>

        {step === "added" ? (
          <div className="divide-y divide-border">
            <div className="flex items-center gap-4 px-4 py-3 bg-primary/5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">1</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">ID: ERA-001</span>
                  <span className="flex items-center gap-1 text-primary/80">
                    <Stethoscope className="w-3 h-3" /> Dr. Emmanuel Obi
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" /> Just added
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input type="checkbox" className="w-4 h-4 accent-primary cursor-pointer" onChange={() => {}} />
                <span className="text-xs text-muted-foreground">Called in</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">Queue is empty</div>
        )}
      </div>

      {/* Search & Add to Queue */}
      {step !== "added" && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Add Patient to Queue</span>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">Search for an existing patient, or register a new file for first-time visitors.</p>

            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-muted-foreground shrink-0" />
              <select className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option>Dr. Emmanuel Obi — General Practice</option>
              </select>
            </div>

            <div className="relative">
              <Input
                value={step === "search" ? "" : `${prospect.firstName} ${prospect.lastName}`}
                placeholder="Search by name or ID..."
                onChange={() => {}}
                onClick={step === "search" ? handleSearch : undefined}
                readOnly={step !== "search"}
                className={step === "found" ? "border-primary/50" : ""}
              />
            </div>

            {step === "found" && (
              <div className="space-y-2 scale-in">
                <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    {prospect.firstName[0]}{prospect.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">ID: ERA-001</span>
                      <span>Active</span>
                      <span>{prospect.phone}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddToQueue}
                    disabled={isAdding}
                    className="shrink-0"
                  >
                    {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add to Queue"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <NarrationBubble
        text={
          step === "search"
            ? <><strong>Your receptionist</strong> searches for the patient. ERA finds their record instantly — name, ID, history, everything.</>
            : step === "found"
            ? <>Patient found. Click <strong>"Add to Queue"</strong> to check them in. An SMS goes to them automatically.</>
            : <><strong>{prospect.firstName}</strong> is now in the queue. They received an SMS with their position number.</>
        }
        onNext={step === "search" ? handleSearch : step === "found" ? handleAddToQueue : onNext}
        nextLabel={step === "search" ? "Search" : step === "found" ? "Add to Queue →" : "Continue →"}
      />
    </div>
  );
}
