import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // When Chrome/Edge DevTools has "Disable cache" checked or on a hard refresh,
  // browsers send 'cache-control: no-cache'. This triggers Next.js's
  // "Route ... is rendering with server caches disabled" warning in development.
  // Stripping this header prevents the warning from displaying.
  const cacheControl = request.headers.get("cache-control");
  if (cacheControl && cacheControl.includes("no-cache")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("cache-control");
    requestHeaders.delete("pragma");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
