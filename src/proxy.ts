import { auth } from "@/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/resumes"];

// UX convenience only — redirects logged-out visitors away from protected
// pages. This is NOT the security boundary: Server Actions are not covered by
// this matcher, so every server action/route handler must call requireUser()
// itself. See src/lib/auth/require-user.ts.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    req.nextUrl.pathname.startsWith(prefix)
  );

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/resumes/:path*"],
};
