import { supabase } from "./supabase.js";

export const SMS_COST_KOBO = 700; // ₦7

export async function hasSufficientSmsBalance(hospitalId: number): Promise<boolean> {
  const balance = await getWalletBalance(hospitalId);
  return balance >= SMS_COST_KOBO;
}

export async function deductSmsFromWallet(
  hospitalId: number,
  description: string,
): Promise<{ ok: boolean; insufficientFunds: boolean }> {
  const { data } = await supabase.from("hospitals").select("wallet_balance_kobo").eq("id", hospitalId).single();
  const balance = (data?.wallet_balance_kobo as number) ?? 0;

  if (balance < SMS_COST_KOBO) return { ok: false, insufficientFunds: true };

  await supabase.from("hospitals").update({ wallet_balance_kobo: balance - SMS_COST_KOBO }).eq("id", hospitalId);
  await supabase.from("wallet_transactions").insert({
    hospital_id: hospitalId,
    type: "debit",
    amount_kobo: SMS_COST_KOBO,
    description,
  });

  return { ok: true, insufficientFunds: false };
}

export async function getWalletBalance(hospitalId: number): Promise<number> {
  const { data } = await supabase.from("hospitals").select("wallet_balance_kobo").eq("id", hospitalId).single();
  return (data?.wallet_balance_kobo as number) ?? 0;
}

export async function creditWallet(hospitalId: number, amountKobo: number, description: string, flutterwaveRef?: string): Promise<void> {
  const { data: current } = await supabase.from("hospitals").select("wallet_balance_kobo").eq("id", hospitalId).single();
  const newBalance = ((current?.wallet_balance_kobo as number) ?? 0) + amountKobo;
  await supabase.from("hospitals").update({ wallet_balance_kobo: newBalance }).eq("id", hospitalId);
  await supabase.from("wallet_transactions").insert({
    hospital_id: hospitalId,
    type: "credit",
    amount_kobo: amountKobo,
    description,
    flutterwave_ref: flutterwaveRef ?? null,
  });
}
