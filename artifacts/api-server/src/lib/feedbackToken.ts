import crypto from "crypto";

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "fallback-feedback-secret";

export function signFeedbackToken(patientId: number, hospitalId: number): string {
  const payload = `f:${patientId}:${hospitalId}`;
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
  return `${encoded}.${sig}`;
}

export function verifyFeedbackToken(token: string): { patientId: number; hospitalId: number } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
    if (sig !== expected) return null;
    const parts = payload.split(":");
    if (parts[0] !== "f" || parts.length !== 3) return null;
    const patientId = parseInt(parts[1], 10);
    const hospitalId = parseInt(parts[2], 10);
    if (isNaN(patientId) || isNaN(hospitalId)) return null;
    return { patientId, hospitalId };
  } catch {
    return null;
  }
}
