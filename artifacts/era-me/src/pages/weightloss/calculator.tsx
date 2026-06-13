import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useLocation } from "wouter";
import { useWLCalcCalories } from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";

export default function WLCalculatorPage() {
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const calc = useWLCalcCalories();
  useWLTheme();

  function handleSearch() {
    if (!input.trim()) return;
    calc.mutate(input.trim());
  }

  return (
    <div className="px-5 pt-6 pb-24">
      <button onClick={() => navigate("/weightloss")} className="flex items-center gap-1.5 mb-5 -ml-1" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      <h1 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Calorie Calculator</h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>
        Describe your meal in plain English. Nigeria-aware estimates.
      </p>

      <div className="relative mb-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
          placeholder={"e.g. 1 plate of jollof rice with fried chicken and coleslaw\nor: amala with ewedu and 2 pieces of beef"}
          rows={4}
          className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none resize-none placeholder:opacity-50"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-main)",
          }}
        />
      </div>

      <button
        onClick={handleSearch}
        disabled={!input.trim() || calc.isPending}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
        style={{ background: "var(--accent)" }}>
        {calc.isPending
          ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Calculating…</>
          : <><Search className="w-4 h-4" /> Calculate calories</>}
      </button>

      {calc.data && (
        <div className="mt-6 space-y-4">
          {/* Total */}
          <div className="rounded-2xl p-5 text-center"
            style={{ background: "rgba(var(--glow-rgb),0.07)", border: "1.5px solid rgba(var(--glow-rgb),0.21)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--accent)" }}>Total calories</p>
            <p className="text-5xl font-black" style={{ color: "var(--text-main)" }}>{calc.data.totalCalories}</p>
            <p className="text-sm" style={{ color: "var(--text-sub)" }}>kcal</p>
          </div>

          {/* Breakdown */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)" }}>Breakdown</p>
            <div className="space-y-2">
              {calc.data.items.map((item, i) => (
                <div key={i} className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{item.name}</p>
                      {item.portion && (
                        <p className="text-xs" style={{ color: "var(--text-sub)" }}>{item.portion}</p>
                      )}
                    </div>
                    <p className="text-base font-black shrink-0" style={{ color: "var(--accent)" }}>{item.calories}</p>
                  </div>
                  <div className="flex gap-4 mt-2 pt-2" style={{ borderTop: "1px solid var(--glass-border)" }}>
                    <MacroChip label="Protein" value={item.protein_g} />
                    <MacroChip label="Carbs" value={item.carbs_g} />
                    <MacroChip label="Fat" value={item.fat_g} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coach advice */}
          {calc.data.advice && (
            <div className="rounded-2xl p-4"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dim)" }}>Coach says</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-main)" }}>{calc.data.advice}</p>
            </div>
          )}

          {/* Quick log hint */}
          <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
            Head to Today's Plan to log this meal
          </p>
        </div>
      )}

      {calc.isError && (
        <div className="mt-6 rounded-2xl p-4 text-center"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <p className="text-sm font-semibold" style={{ color: "#f87171" }}>Could not calculate. Try being more specific.</p>
        </div>
      )}
    </div>
  );
}

function MacroChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>{label}</p>
      <p className="text-xs font-bold" style={{ color: "var(--text-main)" }}>{value}g</p>
    </div>
  );
}
