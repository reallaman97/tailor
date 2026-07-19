import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { assertUnderRateLimit, recordRateLimitHit, RateLimitExceededError } from "@/lib/rate-limit";

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const rateLimitKey = `login:${email.toLowerCase()}`;
        try {
          await assertUnderRateLimit(rateLimitKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
        } catch (err) {
          if (err instanceof RateLimitExceededError) return null; // ambiguous with wrong-password
          throw err;
        }

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) {
          await recordRateLimitHit(rateLimitKey);
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) {
          await recordRateLimitHit(rateLimitKey);
          return null;
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
