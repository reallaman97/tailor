import { auth } from "@/auth";
import { hasTeamAdminPower, isServiceAdmin } from "@/lib/auth/roles";

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/resumes", "/rates", "/admin", "/account", "/interview", "/platform"];
// Admin roles (SERVICE_ADMIN/TEAM_ADMIN, plus legacy SUPERADMIN) can reach every tool.
const RESUME_PLATFORM_ROLES = new Set(["SUPERADMIN", "SERVICE_ADMIN", "TEAM_ADMIN", "BIDDER"]);
const INTERVIEW_ROLES = new Set(["SUPERADMIN", "SERVICE_ADMIN", "TEAM_ADMIN", "MANAGER", "CALLER"]);
// Bidder-rate management lives in the Resume Platform — team admins only.
const RATE_ROLES = new Set(["SUPERADMIN", "SERVICE_ADMIN", "TEAM_ADMIN"]);

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

  // /admin is team-admin-only.
  if (req.nextUrl.pathname.startsWith("/admin") && !hasTeamAdminPower(req.auth?.user?.role)) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  // /dashboard is shared by the Resume Platform: team admins see the org-wide
  // aggregate, bidders see their personal view. Callers/managers have no
  // applications, so they're kept out.
  if (
    req.nextUrl.pathname.startsWith("/dashboard") &&
    req.auth?.user?.role &&
    !RESUME_PLATFORM_ROLES.has(req.auth.user.role)
  ) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  // /rates: team admins and Managers set each bidder's per-application rate.
  if (
    req.nextUrl.pathname.startsWith("/rates") &&
    req.auth?.user?.role &&
    !RATE_ROLES.has(req.auth.user.role)
  ) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  // /platform is the platform owner (Service Real Admin) area.
  if (req.nextUrl.pathname.startsWith("/platform") && !isServiceAdmin(req.auth?.user?.role)) {
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
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/resumes/:path*",
    "/rates/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/interview/:path*",
    "/platform/:path*",
  ],
};
