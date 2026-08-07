/**
 * Idempotent bootstrap run after the DB schema is deployed (see the `setup` and
 * `vercel-build` npm scripts). It:
 *   1. ensures the AppSettings singleton row exists,
 *   2. seeds the default Interview config lists (stages / statuses / meeting types),
 *   3. creates/promotes a superadmin from env vars.
 *
 * Safe to run repeatedly — every write is an upsert, and an existing superadmin
 * keeps their password and encryption key (we only ensure role + approval).
 *
 * Env vars used:
 *   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD  — create the first admin (both required)
 *   SUPERADMIN_USERNAME                     — optional, defaults to the email's local part
 */
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { generateDek, wrapDek } from "@/lib/crypto/envelope";

const STAGES: [id: string, label: string, sortOrder: number][] = [
  ["stage_introduce", "Introduce", 0],
  ["stage_technical", "Technical", 1],
  ["stage_coding_test", "Coding Test", 2],
  ["stage_culture", "Culture", 3],
  ["stage_final", "Final", 4],
];

const STATUSES: [id: string, label: string, color: string, sortOrder: number][] = [
  ["status_scheduled", "Scheduled", "#3b82f6", 0],
  ["status_done", "Done", "#22c55e", 1],
  ["status_rejected", "Rejected", "#ef4444", 2],
  ["status_failed", "Failed", "#f59e0b", 3],
];

const MEETING_TYPES: [id: string, label: string, sortOrder: number][] = [
  ["meeting_zoom", "Zoom", 0],
  ["meeting_google_meet", "Google Meet", 1],
  ["meeting_phone", "Phone", 2],
  ["meeting_onsite", "Onsite", 3],
];

async function ensureSettings(): Promise<void> {
  await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  console.log("✓ app settings singleton ready");
}

async function ensureInterviewConfig(): Promise<void> {
  for (const [id, label, sortOrder] of STAGES) {
    await db.interviewStage.upsert({ where: { id }, create: { id, label, sortOrder }, update: {} });
  }
  for (const [id, label, color, sortOrder] of STATUSES) {
    await db.interviewStatus.upsert({ where: { id }, create: { id, label, color, sortOrder }, update: {} });
  }
  for (const [id, label, sortOrder] of MEETING_TYPES) {
    await db.interviewMeetingType.upsert({ where: { id }, create: { id, label, sortOrder }, update: {} });
  }
  console.log("✓ interview config (stages / statuses / meeting types) ready");
}

async function ensureSuperadmin(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.log("• superadmin skipped — set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD to create one");
    return;
  }
  const username = (process.env.SUPERADMIN_USERNAME ?? email.split("@")[0]).trim();

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    // Don't reset an existing admin's password or DEK — just guarantee access.
    await db.user.update({ where: { email }, data: { role: "SERVICE_ADMIN", approved: true } });
    console.log(`✓ superadmin ensured (existing account): ${email}`);
    return;
  }

  try {
    await db.user.create({
      data: {
        email,
        username,
        passwordHash: await hashPassword(password),
        encryptedDek: wrapDek(generateDek()),
        role: "SERVICE_ADMIN",
        approved: true,
      },
    });
    console.log(`✓ superadmin created: ${email} (@${username})`);
  } catch (err) {
    // A taken username shouldn't crash setup (e.g. a Vercel build) — warn instead.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(",") : String(err.meta?.target ?? "");
      console.warn(`• superadmin not created — ${target.includes("username") ? "username" : "email"} already in use. Adjust SUPERADMIN_USERNAME / SUPERADMIN_EMAIL.`);
      return;
    }
    throw err;
  }
}

const DEFAULT_TEAM_ID = "team_default";

/** Maps a legacy global User.role to the team-scoped role for its membership. */
function teamRole(role: string): "TEAM_ADMIN" | "MANAGER" | "CALLER" | "BIDDER" {
  if (role === "SUPERADMIN" || role === "TEAM_ADMIN") return "TEAM_ADMIN";
  if (role === "MANAGER") return "MANAGER";
  if (role === "CALLER") return "CALLER";
  return "BIDDER";
}

/**
 * Phase 1 tenancy backfill (idempotent): ensures a single default team, tags all
 * existing data with it, clones the AppSettings singleton into that team's
 * settings, and gives every non-platform user a membership carrying their
 * current role. Behavior is unchanged — this just populates the new structures.
 */
async function ensureDefaultTenancy(): Promise<void> {
  const team = await db.team.upsert({
    where: { id: DEFAULT_TEAM_ID },
    create: { id: DEFAULT_TEAM_ID, name: "Default Team" },
    update: {},
  });

  await db.profile.updateMany({ where: { teamId: null }, data: { teamId: team.id } });
  await db.resume.updateMany({ where: { teamId: null }, data: { teamId: team.id } });
  await db.interview.updateMany({ where: { teamId: null }, data: { teamId: team.id } });
  await db.interviewStage.updateMany({ where: { teamId: null }, data: { teamId: team.id } });
  await db.interviewStatus.updateMany({ where: { teamId: null }, data: { teamId: team.id } });
  await db.interviewMeetingType.updateMany({ where: { teamId: null }, data: { teamId: team.id } });

  const app = await db.appSettings.findUnique({ where: { id: "singleton" } });
  await db.teamSettings.upsert({
    where: { teamId: team.id },
    create: {
      teamId: team.id,
      openaiModel: app?.openaiModel ?? "gpt-4.1-mini",
      openaiApiKeyEnc: app?.openaiApiKeyEnc ?? null,
      tailoringPrompt: app?.tailoringPrompt ?? null,
      resumeTemplate: app?.resumeTemplate ?? "MODERN",
      interviewTimezone: app?.interviewTimezone ?? "UTC",
      checkCountry: app?.checkCountry ?? "US",
      checkWorkStyle: app?.checkWorkStyle ?? "REMOTE",
      ...(app?.checkJobCategory ? { checkJobCategory: app.checkJobCategory } : {}),
    },
    update: {},
  });

  const users = await db.user.findMany({ select: { id: true, role: true, profileId: true } });
  for (const u of users) {
    if (u.role === "SERVICE_ADMIN") continue; // platform owner belongs to no team
    await db.teamMembership.upsert({
      where: { userId_teamId: { userId: u.id, teamId: team.id } },
      create: { userId: u.id, teamId: team.id, role: teamRole(u.role), assignedProfileId: u.profileId },
      update: {},
    });
  }

  // Promote today's admins to the platform "Service Real Admin" role. Their
  // TEAM_ADMIN membership (created above) keeps the default team administered.
  const promoted = await db.user.updateMany({ where: { role: "SUPERADMIN" }, data: { role: "SERVICE_ADMIN" } });

  console.log(
    `✓ default tenancy ready (team ${team.id}; ${users.length} memberships ensured; ${promoted.count} SUPERADMIN→SERVICE_ADMIN)`
  );
}

async function main(): Promise<void> {
  console.log("Running setup…");
  await ensureSettings();
  await ensureInterviewConfig();
  await ensureSuperadmin();
  await ensureDefaultTenancy();
  console.log("Setup complete.");
}

main()
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
