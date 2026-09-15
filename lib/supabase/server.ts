import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used in Server Components, Route Handlers, and Server Actions —
// anywhere you're NOT in a "use client" file. Example:
//
//   import { createClient } from "@/lib/supabase/server";
//   const supabase = await createClient();
//   const { data: { user } } = await supabase.auth.getUser();
//
// This has to be a factory function (called fresh each time),
// unlike the browser client, because it needs to read the
// current request's cookies — those differ per request on the
// server, so it can't be a single module-level instance.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll was called from a Server Component, which
            // can't set cookies directly. This is safe to ignore
            // as long as middleware.ts (below) is refreshing the
            // session on every request.
          }
        },
      },
    }
  );
}