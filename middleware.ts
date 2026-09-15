import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value }) =>
            response.cookies.set(name, value)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // maybeSingle() instead of single() — a missing profiles row
    // (auth user exists, profile doesn't — see the email
    // confirmation timing issue) returns null cleanly instead of
    // throwing, so `profile` below is reliably null rather than
    // an error object with undefined shape.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      // Auth account exists but has no profile row at all — don't
      // send them to /student/dashboard, it's equally broken for
      // the same reason. Send them back to login with a flag the
      // login page can use to explain what happened.
      const url = new URL("/auth/login", request.url);
      url.searchParams.set("error", "no_profile");
      return NextResponse.redirect(url);
    }

    if (!profile.is_admin) {
      return NextResponse.redirect(new URL("/student/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};