import { Link } from "wouter";
import { Building2, Plus, Crown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function HospitalsPage() {
  const { account } = useAuth();
  const isPremium = account?.isPremium ?? false;

  if (!isPremium) {
    return (
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground mb-6">Hospitals</h1>
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Premium Feature</h2>
          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
            Connect your hospital accounts to see your care plans, appointments, and treatment details — all in one place.
          </p>
          <Link href="/pricing">
            <button className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold text-sm transition active:scale-95">
              Unlock with ERA Premium
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Hospitals</h1>
        <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95">
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Empty state */}
      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium mb-2">No hospitals connected</p>
        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
          Add a hospital to see your care plans, appointments, and messages from your doctor.
        </p>
        <button className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold transition active:scale-95">
          Add your first hospital
        </button>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          <strong>How it works:</strong> Search for your hospital, enter your patient ID, and we'll send a code to the email your hospital has on file to verify it's you.
        </p>
      </div>
    </div>
  );
}
