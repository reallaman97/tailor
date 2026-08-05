import type { DefaultSession } from "next-auth";

type Role = "SUPERADMIN" | "BIDDER" | "CALLER" | "MANAGER" | "SERVICE_ADMIN" | "TEAM_ADMIN";

declare module "next-auth" {
  interface User {
    role?: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
