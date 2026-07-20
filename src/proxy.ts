import { auth } from "@/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/resumes", "/admin"];

// UX convenience only — redirects logged-out visitors away from protected
// pages, and non-admins away from /admin. This is NOT the security boundary:
// Server Actions are not covered by this matcher, and the role claim here
// comes from the JWT (can be briefly stale after a role change). Every
// server action/route handler must call requireUser()/requireSuperAdmin()
// itself, which re-checks the database. See src/lib/auth/require-user.ts.
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
    return Response.redirect(new URL("/resumes", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/resumes/:path*", "/admin/:path*"],
};
