import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isInvalidRefreshToken(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const authError = error as {
    code?: string;
    message?: string;
  };

  return (
    authError.code === "refresh_token_not_found" ||
    authError.message?.includes("Invalid Refresh Token") === true ||
    authError.message?.includes("Refresh Token Not Found") === true
  );
}

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith("sb-") &&
      cookie.name.includes("-auth-token")
    ) {
      request.cookies.set(cookie.name, "");
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  let user = null;

  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isInvalidRefreshToken(error)) {
        clearSupabaseAuthCookies(request, response);
      } else {
        console.error("Supabase auth error:", error);
      }
    } else {
      user = data.user;
    }
  } catch (error) {
    if (isInvalidRefreshToken(error)) {
      clearSupabaseAuthCookies(request, response);
    } else {
      throw error;
    }
  }

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  const isProtected =
    !isAuthRoute && request.nextUrl.pathname !== "/";

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";

    const redirectResponse = NextResponse.redirect(url);
    clearSupabaseAuthCookies(request, redirectResponse);

    return redirectResponse;
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
