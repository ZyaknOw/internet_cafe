import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = async (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: AbortSignal.timeout(5_000),
        }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  // This proxy refreshes cookies; authorization remains in the authenticated
  // API. A stalled auth service must not prevent the public page from loading.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Session refresh timed out")), 8_000);
      }),
    ]);
  } catch {
    // Let the client display a recoverable session error if auth is unavailable.
  } finally {
    clearTimeout(timer);
  }

  return supabaseResponse
};
