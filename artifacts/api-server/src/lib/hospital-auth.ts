import crypto from "crypto";
import { supabase } from "./supabase.js";
import type { Request } from "express";

const HOSPITAL_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.SUPER_ADMIN_PASSWORD ?? "EraAdmin2024!";
}

export function signHospitalToken(hospitalId: number): string {
  const expiry = Date.now() + HOSPITAL_TOKEN_TTL_MS;
  const payload = `h:${hospitalId}:${expiry}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyHospitalToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const parts = payload.split(":");
    if (parts[0] !== "h") return null;
    const expiry = parseInt(parts[2], 10);
    if (Date.now() > expiry) return null;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    return parseInt(parts[1], 10);
  } catch {
    return null;
  }
}

export interface HospitalContext {
  intId: number;
  username: string;
  /** UUID — used as hospital_id in patient-facing tables (patients, care_plans, queue) */
  code: string;
}

export async function getHospitalFromRequest(req: Request): Promise<HospitalContext | null> {
  const token = req.headers["x-hospital-token"] as string | undefined;
  if (!token) return null;
  const hospitalIntId = verifyHospitalToken(token);
  if (!hospitalIntId) return null;
  const { data } = await supabase.from("hospitals").select("*").eq("id", hospitalIntId).single();
  if (!data) return null;
  // Fall back to username if hospital_code column doesn't exist yet or is null.
  // The startup migration will backfill the UUID; until then username keeps data visible.
  const code = (data.hospital_code as string | null) ?? (data.username as string);
  return { intId: data.id as number, username: data.username as string, code };
}

export async function getPatientIdsForHospital(hospitalCode: string): Promise<number[]> {
  const { data } = await supabase.from("patients").select("id").eq("hospital_id", hospitalCode);
  return (data ?? []).map((p) => p.id as number);
}
