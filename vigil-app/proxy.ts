import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// API routes and static assets are always public.
// Auth is only enforced on page routes when Convex is configured.
const isProtectedPage = createRouteMatcher([
  "/((?!api|_next|.*\\..*).*)",
]);

// Next.js 16+: request interception lives in `proxy.ts` (formerly `middleware.ts`).
const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Skip auth enforcement if Convex is not configured
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return;

  // Keep the landing page public so unauthenticated users can reach AuthGate/SignInForm.
  const isLandingPage = request.nextUrl.pathname === "/";
  if (!isLandingPage && isProtectedPage(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export default proxy;

export const config = {
  // Only run middleware on page routes — never on API routes or static files
  matcher: ["/((?!.*\\..*|_next|api).*)", "/"],
};
