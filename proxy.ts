import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAuthRoute, routeRequiresAuth } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return handleProxy(request);
}

async function handleProxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isGetRequest = request.method === "GET";
  let response = NextResponse.next({
    request,
  });

  if (!hasSupabaseEnv()) {
    return response;
  }

  const sessionState = await updateSupabaseSession(request, response);
  response = sessionState.response;
  const requiresAuth = routeRequiresAuth(pathname);

  if (requiresAuth && !sessionState.user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGetRequest && isAuthRoute(pathname) && sessionState.user) {
    return NextResponse.redirect(new URL("/learn", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/learn/:path*",
    "/profiles/:path*",
    "/purchases/:path*",
    "/auth/:path*",
    "/api/stripe/checkout",
    "/api/stripe/portal",
  ],
};
