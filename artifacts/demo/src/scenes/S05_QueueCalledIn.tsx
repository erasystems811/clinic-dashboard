import { useState } from "react";
import { Users, Clock, Stethoscope } from "lucide-react";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props {
  prospect: Prospect;
  onNext: () => void;
  onSMSBanner: (msg: string) => void;
}

export default function S05_QueueCalledIn({ prospect, onNext, onSMSBanner }: Props) {
  const [called, setCalled] = useState(false);

  function handleCalledIn() {
    setCalled(true);
    onSMSBanner(`It's your turn, ${prospect.firstName}! Please proceed to the consultation room. — ERA Hospital`);
  }

  return (
    <div className="relative space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Queue Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Live patient queue</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Current Queue</span>
          <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
            {called ? "0 waiting" : "1 waiting"}
          </span>
        </div>

        {called ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-3xl">✓</div>
            <p className="text-sm font-medium text-muted-foreground">Queue is empty</p>
            <p className="text-xs text-muted-foreground">{prospect.firstName} has been called in</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Prospect's queue entry */}
            <div className="flex items-center gap-4 px-4 py-3 bg-primary/5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">1</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{prospect.firstName} {prospect.lastName}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="font-mono">ERA-001</span>
                  <span className="flex items-center gap-1 text-primary/80">
                    <Stethoscope className="w-3 h-3" /> Dr. Emmanuel Obi
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" /> 3 mins
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0 relative">
                <div className="demo-spotlight rounded" />
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary cursor-pointer"
                  onChange={handleCalledIn}
                />
                <span className="text-xs text-muted-foreground">Called in</span>
              </label>
            </div>
          </div>
        )}
      </div>

      <NarrationBubble
        text={
          !called
            ? <><strong>The doctor is ready.</strong> Your receptionist ticks "Called in" — one click. The patient gets an SMS telling them to come through.</>
            : <><strong>Done.</strong> {prospect.firstName} received an SMS instantly. Their stage updates to "In Care" automatically.</>
        }
        onNext={!called ? handleCalledIn : onNext}
        nextLabel={!called ? "Call patient in →" : "Continue →"}
      />
    </div>
  );
}
