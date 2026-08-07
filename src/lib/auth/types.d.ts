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
      // The team the user is currently acting in. Baked into the JWT (source of
      // truth), updated on team switch via unstable_update. null = no team.
      activeTeamId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    activeTeamId?: string | null;
  }
}
