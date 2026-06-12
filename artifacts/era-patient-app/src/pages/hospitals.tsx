import { Building2, Plus, Search, Shield } from "lucide-react";
import { useState } from "react";

export default function HospitalsPage() {
  const [showAddFlow, setShowAddFlow] = useState(false);

  if (showAddFlow) {
    return <AddHospitalFlow onBack={() => setShowAddFlow(false)} />;
  }

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Hospitals</h1>
          <p className="text-muted-foreground text-sm mt-1">Connect to ERA hospitals to access your care plans.</p>
        </div>
        <button
          onClick={() => setShowAddFlow(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-primary/20 hover:brightness-105 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center text-center py-16">
        <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mb-5">
          <Building2 className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="font-bold text-foreground text-lg mb-2">No hospitals connected</h2>
        <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
          When you connect to an ERA hospital, your care plan, appointments, and doctor's instructions will appear here automatically.
        </p>
        <button
          onClick={() => setShowAddFlow(true)}
          className="mt-6 flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl shadow-sm shadow-primary/20 hover:brightness-105 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Connect a Hospital
        </button>
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-3 bg-muted rounded-2xl p-4">
        <Shield className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your personal wellness data is completely separate from your hospital records. No hospital can see your private journal, mood logs, or wellness habits.
        </p>
      </div>
    </div>
  );
}

function AddHospitalFlow({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [step, setStep] = useState<"search" | "id" | "otp">("search");

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-muted-foreground mb-6 hover:text-foreground transition-colors text-sm"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-foreground mb-2">Add a Hospital</h1>
      <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
        Search for the hospital, enter your patient ID, and we'll send a verification code to the email the hospital has on file for you.
      </p>

      {step === "search" && (
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">Hospital name</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for your hospital..."
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              autoFocus
            />
          </div>

          {/* Coming soon note */}
          <div className="mt-6 bg-primary/8 border border-primary/20 rounded-2xl p-4">
            <p className="text-primary font-semibold text-sm">Hospital search coming soon</p>
            <p className="text-muted-foreground text-xs mt-1">
              The hospital directory is being set up. Once live, you'll be able to search and connect to any ERA hospital in seconds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
