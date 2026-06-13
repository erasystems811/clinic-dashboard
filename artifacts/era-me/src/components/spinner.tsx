export function Spinner({ size = 24 }: { size?: number }) {
  const thickness = Math.max(2.5, Math.round(size * 0.12));
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(from 0deg, var(--accent) 0%, rgba(var(--glow-rgb), 0.06) 72%)`,
        animation: "era-spin 0.75s linear infinite",
        mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), black calc(100% - ${thickness}px))`,
        WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), black calc(100% - ${thickness}px))`,
        flexShrink: 0,
      }}
    />
  );
}

export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "72vh", gap: 14 }}>
      <Spinner size={32} />
      <p style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600, letterSpacing: 0.4 }}>{label}</p>
    </div>
  );
}
