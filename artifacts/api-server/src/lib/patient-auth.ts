import crypto from "crypto";
import type { Request } from "express";
import { supabase } from "./supabase.js";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  return process.env.SUPER_ADMIN_PASSWORD ?? "EraAdmin2024!";
}

export function signPatientToken(accountId: number): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `p:${accountId}:${expiry}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyPatientToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const parts = payload.split(":");
    if (parts[0] !== "p") return null;
    const expiry = parseInt(parts[2], 10);
    if (Date.now() > expiry) return null;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    return parseInt(parts[1], 10);
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
  try {
    return crypto.timingSafeEqual(hashBuf, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  let pass = upper[Math.floor(Math.random() * upper.length)];
  pass += lower[Math.floor(Math.random() * lower.length)];
  pass += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 7; i++) pass += all[Math.floor(Math.random() * all.length)];
  return pass.split("").sort(() => Math.random() - 0.5).join("");
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface PatientAccount {
  id: number;
  username: string;
  email: string;
  accountType: string;
  displayName: string | null;
  themeColor: string;
  darkMode: boolean;
}

export async function getPatientFromRequest(req: Request): Promise<PatientAccount | null> {
  const token = req.headers["x-patient-token"] as string | undefined;
  if (!token) return null;
  const accountId = verifyPatientToken(token);
  if (!accountId) return null;
  const { data } = await supabase
    .from("patient_accounts")
    .select("id, username, email, account_type, display_name, theme_color, dark_mode")
    .eq("id", accountId)
    .single();
  if (!data) return null;
  return {
    id: data.id as number,
    username: data.username as string,
    email: data.email as string,
    accountType: data.account_type as string,
    displayName: (data.display_name as string | null) ?? null,
    themeColor: (data.theme_color as string) ?? "blue",
    darkMode: (data.dark_mode as boolean) ?? false,
  };
}
