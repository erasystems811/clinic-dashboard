import { useState, useEffect } from "react";

const WORKING_DAYS = 26;
const SMS_COST = 6;
const EMAIL_COST = 0.15;
const AI_COST = 0.22;
const AI_VARIED_MULT = 10;
const MED_SLOTS = 3;
const BENEFICIARY_RATE = 0.70;
const EMAIL_RATE = 0.85;
const MARKUP = 1 / 0.50;
const VARIED_RATE = 0.20;
const CARE_PLAN_RATE = 0.70;
const GP_DURATION = 10;
const DEPT_DURATION = 30;
const NOSHOW_RATE = 0.30;
const CARE_PLAN_MULTIPLIER = 3;
const PRICE_FLOOR = 80000;

const FLOOR_PRICES = {
  core: 48000,
  queue: 19734,
  appointments: 4266,
  newsletter: 8000,
};

function calcActivePlans(dp: number, gp: number) {
  const base = dp * CARE_PLAN_RATE * (gp * GP_DURATION + (1 - gp) * DEPT_DURATION);
  return {
    activeGP: base * gp * CARE_PLAN_MULTIPLIER,
    activeDept: base * (1 - gp) * CARE_PLAN_MULTIPLIER,
  };
}

interface Inputs {
  totalPatients: string;
  dailyPatients: string;
  apptPercent: string;
  gpPercent: string;
}

interface Costs {
  core: number;
  queue: number;
  appointments: number;
  newsletter: number;
  useFloor: boolean;
}

function calcCosts({ totalPatients, dailyPatients, apptPercent, gpPercent }: Inputs): Costs {
  const tp = Number(totalPatients) || 0;
  const dp = Number(dailyPatients) || 0;
  const appt = Number(apptPercent) / 100 || 0;
  const gp = Number(gpPercent) / 100 || 0;
  const monthly = dp * WORKING_DAYS;
  const newPlans = monthly * CARE_PLAN_RATE;
  const { activeGP, activeDept } = calcActivePlans(dp, gp);
  const totalActivePlans = activeGP + activeDept;

  const uniformAI = newPlans * (1 - VARIED_RATE) * AI_COST;
  const variedAI = newPlans * VARIED_RATE * AI_COST * AI_VARIED_MULT;
  const inCareAI = uniformAI + variedAI;
  const carePlanSMS = newPlans * SMS_COST;
  const carePlanSummaryEmail = newPlans * EMAIL_COST;
  const incareGPEmail = activeGP * MED_SLOTS * (1 + BENEFICIARY_RATE) * WORKING_DAYS * EMAIL_COST;
  const incareDeptEmail = activeDept * 6 * EMAIL_COST;
  const postTreatEmail = newPlans * 3 * EMAIL_COST;
  const postTreatAI = newPlans * (1 - gp) * 3 * AI_COST;
  const birthdayEmail = (tp / 365) * 30 * EMAIL_COST;
  const birthdayAI = (tp / 365) * 30 * AI_COST;
  const callTaskEmail = 20 * WORKING_DAYS * EMAIL_COST;
  const callTaskAI = 20 * WORKING_DAYS * AI_COST;
  const wellnessEmail = tp * 0.3 * EMAIL_COST;
  const beneficiaryEmail = totalActivePlans * BENEFICIARY_RATE * WORKING_DAYS * EMAIL_COST;
  const deptFollowupAI = activeDept * AI_COST;

  const coreCost = inCareAI + carePlanSMS + carePlanSummaryEmail +
    incareGPEmail + incareDeptEmail + postTreatEmail + postTreatAI +
    birthdayEmail + birthdayAI + callTaskEmail + callTaskAI +
    wellnessEmail + beneficiaryEmail + deptFollowupAI;

  const queueSMS = monthly * 4 * SMS_COST;
  const feedbackEmail = monthly * EMAIL_RATE * EMAIL_COST;
  const queueCost = queueSMS + feedbackEmail;

  const apptPatients = monthly * appt;
  const apptEmail = apptPatients * (1 + 1 + 1 + NOSHOW_RATE) * EMAIL_COST;
  const apptAI = apptPatients * NOSHOW_RATE * AI_COST;
  const apptCost = apptEmail + apptAI;

  const newsletterEmail = tp * EMAIL_RATE * 4 * EMAIL_COST;
  const bulkEmail = tp * EMAIL_RATE * 2 * EMAIL_COST;
  const newsletterAI = 4 * AI_COST * 10;
  const newsletterCost = newsletterEmail + bulkEmail + newsletterAI;

  const rawTotal = (coreCost + queueCost + apptCost + newsletterCost) * MARKUP;
  const useFloor = rawTotal < PRICE_FLOOR;

  return {
    core: coreCost, queue: queueCost, appointments: apptCost, newsletter: newsletterCost,
    useFloor,
  };
}

function fmt(n: number) { return "₦" + Math.round(n).toLocaleString("en-NG"); }

const FEATURES = [
  { key: "core", label: "Core", icon: "🏥", desc: "Treatment guidance, care plans, post-treatment check-ins, call tasks, birthdays, beneficiary reminders", color: "#C0392B", light: "#FADBD8", required: true },
  { key: "queue", label: "Queue Management + Feedback", icon: "📱", desc: "Queue SMS (4 triggers) + feedback email after every visit", color: "#E67E22", light: "#FDEBD0", required: false },
  { key: "appointments", label: "Appointments", icon: "📅", desc: "Confirmation, 24h + 2h reminders, no-show follow-up", color: "#2980B9", light: "#D6EAF8", required: false },
  { key: "newsletter", label: "Newsletter + Bulk Email", icon: "📰", desc: "4× wellness newsletter + 2× bulk email monthly", color: "#8E44AD", light: "#E8DAEF", required: false },
];

const INPUTS = [
  { key: "totalPatients", label: "Total patients in your database", placeholder: "e.g. 5000" },
  { key: "dailyPatients", label: "Average patients seen per day", placeholder: "e.g. 60" },
  { key: "apptPercent", label: "Appointment patients (out of 100)", placeholder: "e.g. 70 = 70 appointment / 30 walk-in" },
  { key: "gpPercent", label: "General Outpatient patients (out of 100)", placeholder: "e.g. 60 = 60 GP / 40 Specialist" },
];

type FeatureKey = "core" | "queue" | "appointments" | "newsletter";

export default function PricingPage() {
  const [inputs, setInputs] = useState<Inputs>({ totalPatients: "", dailyPatients: "", apptPercent: "", gpPercent: "" });
  const [selected, setSelected] = useState<Record<FeatureKey, boolean>>({ core: true, queue: true, appointments: true, newsletter: true });
  const [costs, setCosts] = useState<Costs | null>(null);

  useEffect(() => {
    const allFilled = Object.values(inputs).every((v) => v !== "");
    if (allFilled) setCosts(calcCosts(inputs));
    else setCosts(null);
  }, [inputs]);

  const handleInput = (key: string, val: string) => setInputs((p) => ({ ...p, [key]: val }));
  const toggleFeature = (key: FeatureKey) => { if (key === "core") return; setSelected((p) => ({ ...p, [key]: !p[key] })); };

  const getFeaturePrice = (key: FeatureKey): number | null => {
    if (!costs) return null;
    if (costs.useFloor) return selected[key] ? FLOOR_PRICES[key] : 0;
    return costs[key] * MARKUP;
  };

  const totalPrice = costs
    ? costs.useFloor
      ? FEATURES.filter(f => selected[f.key as FeatureKey]).reduce((s, f) => s + FLOOR_PRICES[f.key as FeatureKey], 0)
      : FEATURES.reduce((s, f) => s + (selected[f.key as FeatureKey] ? costs[f.key as FeatureKey] * MARKUP : 0), 0)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", fontFamily: "'Georgia',serif", color: "#f0f0f0" }}>
      <div style={{ background: "#C0392B", padding: "28px 32px 20px", borderBottom: "4px solid #922B21" }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#FADBD8", marginBottom: 6, fontFamily: "monospace" }}>ERA SYSTEMS</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>ERA Patient</div>
        <div style={{ fontSize: 13, color: "#FADBD8", marginTop: 4, fontStyle: "italic" }}>Hospital Pricing Calculator</div>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#C0392B", marginBottom: 14, fontFamily: "monospace", fontWeight: 700 }}>STEP 1 — HOSPITAL DETAILS</div>
          {INPUTS.map(({ key, label, placeholder }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 5 }}>{label}</div>
              <input
                type="number" placeholder={placeholder} value={inputs[key as keyof Inputs]}
                onChange={(e) => handleInput(key, e.target.value)}
                style={{ width: "100%", padding: "11px 14px", background: "#1a1a1a", border: inputs[key as keyof Inputs] ? "1.5px solid #C0392B" : "1.5px solid #333", borderRadius: 6, color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 28, padding: "14px 16px", background: "#1a1200", border: "1.5px solid #856404", borderRadius: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#FFC107", fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>⚠ IMPORTANT NOTICE</div>
          <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.7 }}>
            Pricing is based on your declared figures. Hospitals found to have a significant gap between declared and actual usage will have their subscription reviewed and may be <strong style={{ color: "#C0392B" }}>suspended without notice</strong>. Minor variances are accepted.
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#C0392B", marginBottom: 6, fontFamily: "monospace", fontWeight: 700 }}>STEP 2 — SELECT FEATURES</div>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 14, fontStyle: "italic" }}>Toggle off features you don't need</div>
          {FEATURES.map((f) => {
            const key = f.key as FeatureKey;
            const isOn = selected[key];
            const featurePrice = getFeaturePrice(key);
            return (
              <div key={f.key} onClick={() => toggleFeature(key)} style={{ marginBottom: 10, padding: "14px 16px", background: isOn ? f.light : "#1a1a1a", border: isOn ? `2px solid ${f.color}` : "2px solid #2a2a2a", borderRadius: 8, cursor: f.required ? "default" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 22, borderRadius: 11, background: isOn ? f.color : "#444", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: isOn ? 21 : 3, transition: "left 0.2s" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isOn ? f.color : "#666", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {f.icon} {f.label}
                    {f.required && <span style={{ fontSize: 9, background: f.color, color: "#fff", padding: "1px 6px", borderRadius: 3, letterSpacing: 1, fontFamily: "monospace" }}>REQUIRED</span>}
                  </div>
                  <div style={{ fontSize: 10, color: isOn ? "#555" : "#444", marginTop: 2 }}>{f.desc}</div>
                </div>
                {featurePrice !== null && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isOn ? f.color : "#444", fontFamily: "monospace" }}>{fmt(featurePrice)}</div>
                    <div style={{ fontSize: 9, color: "#666" }}>/month</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {costs && (
          <div style={{ background: "#1a1a1a", border: "2px solid #C0392B", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ background: "#C0392B", padding: "12px 18px", fontSize: 11, letterSpacing: 3, fontFamily: "monospace", fontWeight: 700, color: "#fff" }}>PRICE SUMMARY</div>
            <div style={{ padding: "16px 18px" }}>
              {FEATURES.filter((f) => selected[f.key as FeatureKey]).map((f) => (
                <div key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #2a2a2a" }}>
                  <div style={{ fontSize: 12, color: "#ccc" }}>{f.icon} {f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: f.color, fontFamily: "monospace" }}>{fmt(getFeaturePrice(f.key as FeatureKey)!)}</div>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: "18px 16px", background: "#C0392B", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#FADBD8", letterSpacing: 2, fontFamily: "monospace" }}>TOTAL MONTHLY PRICE</div>
                  <div style={{ fontSize: 10, color: "#FADBD8", marginTop: 2, fontStyle: "italic" }}>includes ERA Systems service fee</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{fmt(totalPrice)}</div>
              </div>
            </div>
          </div>
        )}

        {!costs && (
          <div style={{ textAlign: "center", padding: "32px 20px", color: "#444", fontSize: 13, fontStyle: "italic", border: "1px dashed #2a2a2a", borderRadius: 8 }}>
            Fill in all 4 fields above to see your pricing
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 10, color: "#333", marginTop: 8, fontStyle: "italic" }}>
          ERA Systems • Confidential • erasystems.com.ng
        </div>
      </div>
    </div>
  );
}
