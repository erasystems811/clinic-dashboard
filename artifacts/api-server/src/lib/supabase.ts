import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
// Service role key bypasses RLS — the API enforces hospital isolation in code.
// Falls back to anon key for local dev without the service role key set.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
