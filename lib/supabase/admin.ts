import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// `server-only` fails the build if this module is ever pulled into a
// Client Component bundle, guarding against leaking the service-role key.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
