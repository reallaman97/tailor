import { auth } from "@/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/resumes", "/admin", "/account", "/interview"];
const RESUME_PLATFORM_ROLES = new Set(["SUPERADMIN", "BIDDER"]);
const INTERVIEW_ROLES = new Set(["SUPERADMIN", "MANAGER", "CALLER"]);

// UX convenience only — redirects logged-out visitors away from protected
// pages, non-admins away from /admin, and roles without Resume Platform
// access away from it. This is NOT the security boundary: Server Actions
// are not covered by this matcher, and the role claim here comes from the
// JWT (can be briefly stale after a role change). Every server
// action/route handler must call requireUser()/requireSuperAdmin()/
// requireResumePlatformAccess() itself, which re-checks the database. See
// src/lib/auth/require-user.ts.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    req.nextUrl.pathname.startsWith(prefix)
  );

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  // /dashboard is a superadmin-only aggregate view, same gating as /admin.
  if (
    (req.nextUrl.pathname.startsWith("/admin") || req.nextUrl.pathname.startsWith("/dashboard")) &&
    req.auth?.user?.role !== "SUPERADMIN"
  ) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  if (
    (req.nextUrl.pathname.startsWith("/resumes") || req.nextUrl.pathname.startsWith("/profile")) &&
    req.auth?.user?.role &&
    !RESUME_PLATFORM_ROLES.has(req.auth.user.role)
  ) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  if (
    req.nextUrl.pathname.startsWith("/interview") &&
    req.auth?.user?.role &&
    !INTERVIEW_ROLES.has(req.auth.user.role)
  ) {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/resumes/:path*", "/admin/:path*", "/account/:path*", "/interview/:path*"],
};
