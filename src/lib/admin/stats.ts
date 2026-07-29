import { db } from "@/lib/db";
import type { UserRole } from "@/generated/prisma/client";

export type AdminStats = {
  totalUsers: number;
  pendingApprovals: number;
  usersByRole: Record<UserRole, number>;
  totalProfiles: number;
  totalApplications: number;
  totalInterviews: number;
};

/** Aggregate counts for the Admin panel landing page. */
export async function getAdminStats(): Promise<AdminStats> {
  const [totalUsers, pendingApprovals, roleGroups, totalProfiles, totalApplications, totalInterviews] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { approved: false } }),
      db.user.groupBy({ by: ["role"], _count: { _all: true } }),
      db.profile.count(),
      db.resume.count(),
      db.interview.count({ where: { deletedAt: null } }),
    ]);

  const usersByRole: Record<UserRole, number> = { SUPERADMIN: 0, BIDDER: 0, CALLER: 0, MANAGER: 0 };
  for (const g of roleGroups) usersByRole[g.role] = g._count._all;

  return { totalUsers, pendingApprovals, usersByRole, totalProfiles, totalApplications, totalInterviews };
}
