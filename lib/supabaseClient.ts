import { createBrowserClient } from "@supabase/ssr";

// Used in "use client" components (login, register, dashboard,
// admin pages, etc.) — everywhere you currently do
// `import { supabase } from "@/lib/supabaseClient"`.
//
// createBrowserClient (from @supabase/ssr) stores the session in
// cookies rather than only localStorage, which is what lets a
// server-side check (middleware, a Server Component, a Route
// Handler) see the same session the browser has. The plain
// createClient() from @supabase/supabase-js can't do that — it's
// browser-only, which is fine for auth.signInWithPassword() etc.
// but breaks down the moment anything needs to check "is this
// user logged in?" from the server.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);