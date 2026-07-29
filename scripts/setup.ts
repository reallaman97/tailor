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
    await db.user.update({ where: { email }, data: { role: "SUPERADMIN", approved: true } });
    console.log(`✓ superadmin ensured (existing account): ${email}`);
    return;
  }

  await db.user.create({
    data: {
      email,
      username,
      passwordHash: await hashPassword(password),
      encryptedDek: wrapDek(generateDek()),
      role: "SUPERADMIN",
      approved: true,
    },
  });
  console.log(`✓ superadmin created: ${email} (@${username})`);
}

async function main(): Promise<void> {
  console.log("Running setup…");
  await ensureSettings();
  await ensureInterviewConfig();
  await ensureSuperadmin();
  console.log("Setup complete.");
}

main()
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
