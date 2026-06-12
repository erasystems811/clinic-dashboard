import { useLocation } from "wouter";
import { ArrowLeft, Crown, Check, Sparkles } from "lucide-react";
import { PRICING, formatNaira, cn } from "@/lib/utils";

type BillingCycle = "monthly" | "yearly";
type PlanType = "personal" | "student" | "family";

const PLAN_DETAILS: Record<PlanType, { label: string; description: string; highlight?: boolean }> = {
  personal: { label: "Personal",   description: "For individuals",              highlight: true },
  student:  { label: "Student",    description: "Verified with school email"                   },
  family:   { label: "Family",     description: "Covers you + family members"                  },
};

const PREMIUM_FEATURES = [
  "AI companion & private diary",
  "Personality profile & growth insights",
  "Hospital connections (unlimited)",
  "Body vitals tracking & trends",
  "Women's health modules",
  "Lifestyle habit trackers",
  "Preventive health reminders",
  "Family sub-accounts",
  "Accountability partner",
  "Streak rewards & coins",
];

const YEARLY_SAVING_PERCENT = 5;

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [plan, setPlan] = useState<PlanType>("personal");

  const price = billing === "monthly" ? PRICING[plan].monthly : PRICING[plan].yearly;
  const monthlyCost = billing === "yearly" ? Math.round(PRICING[plan].yearly / 12) : PRICING[plan].monthly;
  const yearlySaving = Math.round(PRICING[plan].monthly * 12 * YEARLY_SAVING_PERCENT / 100);

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate(-1 as unknown as string)}
        className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
          <Crown className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">ERA Premium</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Unlock your AI companion, hospital connections, and everything that makes ERA Me powerful.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex rounded-xl bg-muted p-1 mb-5">
        {(["monthly", "yearly"] as BillingCycle[]).map((b) => (
          <button key={b} onClick={() => setBilling(b)}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition",
              billing === b ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}>
            {b === "monthly" ? "Monthly" : (
              <span className="flex items-center justify-center gap-1.5">
                Yearly
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  Save {YEARLY_SAVING_PERCENT}%
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plan selector */}
      <div className="space-y-3 mb-6">
        {(Object.entries(PLAN_DETAILS) as [PlanType, typeof PLAN_DETAILS[PlanType]][]).map(([id, { label, description, highlight }]) => {
          const monthly = PRICING[id].monthly;
          const yearly = PRICING[id].yearly;
          const displayPrice = billing === "monthly" ? monthly : Math.round(yearly / 12);
          const active = plan === id;

          return (
            <button key={id} onClick={() => setPlan(id)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition",
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              )}>
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition",
                active ? "border-primary bg-primary" : "border-muted-foreground"
              )}>
                {active && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground text-sm">{label}</p>
                  {highlight && (
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Popular</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">{formatNaira(displayPrice)}</p>
                <p className="text-xs text-muted-foreground">/month</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Price summary */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">
            {billing === "monthly" ? "Billed monthly" : "Billed annually"}
          </span>
          <span className="font-bold text-foreground text-lg">{formatNaira(price)}</span>
        </div>
        {billing === "yearly" && (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
            You save {formatNaira(yearlySaving)} compared to monthly
          </p>
        )}
        {billing === "monthly" && (
          <p className="text-xs text-muted-foreground">
            Switch to yearly to save {YEARLY_SAVING_PERCENT}% — {formatNaira(PRICING[plan].monthly * 12 - PRICING[plan].yearly)} off
          </p>
        )}
      </div>

      {/* CTA */}
      <button className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-base transition active:scale-95 shadow-lg shadow-amber-500/30 mb-6 flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5" />
        Start ERA Premium
      </button>

      {/* Features */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">What you get</p>
        <div className="space-y-2.5">
          {PREMIUM_FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span className="text-sm text-foreground">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Core is always free note */}
      <div className="mt-6 bg-muted rounded-2xl p-4">
        <p className="text-sm text-muted-foreground text-center">
          Water tracking, medications, workout, sleep, mood & energy remain <strong className="text-foreground">free forever</strong> — no card required.
        </p>
      </div>
    </div>
  );
}

// useState import needed
import { useState } from "react";
