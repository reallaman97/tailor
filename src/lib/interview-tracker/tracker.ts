import { db } from "@/lib/db";
import { getProfileNames } from "@/lib/profile/personal-info";
import { getPrimaryStatus } from "@/lib/resume-status";
import type { ResumeStatus } from "@/generated/prisma/client";

// Interview tracker: applications that reached the interview process, with the
// admin's running notes (comment and/or meeting screenshot) per application.
// Lists never load note images — those are fetched one at a time, on view.

import { INTERVIEW_STAGES, CLOSING_STAGES, TRACKER_STAGES } from "@/lib/interview-tracker/stages";
export { INTERVIEW_STAGES, CLOSING_STAGES, TRACKER_STAGES };

export type TrackerView = "active" | "closed";

export type TrackedApplication = {
  id: string;
  companyName: string;
  jobTitle: string;
  candidateName: string | null;
  bidderName: string;
  statuses: ResumeStatus[];
  stage: ResumeStatus;
  updatedAt: Date;
  noteCount: number;
  lastNote: { body: string; hasImage: boolean; createdAt: Date } | null;
};

/** Reached the interview process, and (active) hasn't closed yet / (closed) has. */
function whereFor(view: TrackerView, teamId?: string) {
  const closed = { statuses: { hasSome: CLOSING_STAGES } };
  return {
    ...(teamId ? { teamId } : {}),
    AND: [{ statuses: { hasSome: INTERVIEW_STAGES } }, view === "active" ? { NOT: closed } : closed],
  };
}

export async function listTrackedApplications(view: TrackerView, opts: { teamId?: string } = {}): Promise<TrackedApplication[]> {
  const rows = await db.resume.findMany({
    where: whereFor(view, opts.teamId),
    orderBy: { updatedAt: "desc" },
    take: view === "closed" ? 200 : undefined,
    select: {
      id: true,
      companyName: true,
      jobTitle: true,
      profileId: true,
      statuses: true,
      updatedAt: true,
      user: { select: { username: true, email: true } },
      interviewNotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, imageMimeType: true, createdAt: true },
      },
      _count: { select: { interviewNotes: true } },
    },
  });
  const names = await getProfileNames([...new Set(rows.map((r) => r.profileId).filter((id): id is string => !!id))]);

  return rows
    .map((r) => {
      const last = r.interviewNotes[0];
      return {
        id: r.id,
        companyName: r.companyName,
        jobTitle: r.jobTitle,
        candidateName: r.profileId ? (names.get(r.profileId) ?? null) : null,
        bidderName: r.user.username || r.user.email,
        statuses: r.statuses,
        stage: getPrimaryStatus(r.statuses),
        updatedAt: r.updatedAt,
        noteCount: r._count.interviewNotes,
        lastNote: last ? { body: last.body, hasImage: last.imageMimeType !== null, createdAt: last.createdAt } : null,
      };
    })
    // Most recent activity first: a new note counts as activity too.
    .sort((a, b) => lastActivity(b).getTime() - lastActivity(a).getTime());
}

function lastActivity(a: TrackedApplication): Date {
  return a.lastNote && a.lastNote.createdAt > a.updatedAt ? a.lastNote.createdAt : a.updatedAt;
}

export type TrackerNote = {
  id: string;
  body: string;
  stage: ResumeStatus | null;
  hasImage: boolean;
  imageSize: number | null;
  authorName: string | null;
  createdAt: Date;
};

export type TrackerDetail = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  candidateName: string | null;
  bidderName: string;
  statuses: ResumeStatus[];
  stage: ResumeStatus;
  appliedAt: Date | null;
  createdAt: Date;
  hasResume: boolean;
  notes: TrackerNote[];
};

export async function getTrackerDetail(resumeId: string): Promise<TrackerDetail | null> {
  const r = await db.resume.findUnique({
    where: { id: resumeId },
    select: {
      id: true,
      companyName: true,
      jobTitle: true,
      jobLink: true,
      profileId: true,
      statuses: true,
      appliedAt: true,
      createdAt: true,
      tailoredContentEnc: true,
      user: { select: { username: true, email: true } },
      interviewNotes: {
        orderBy: { createdAt: "desc" },
        // Everything but the image bytes, which load one at a time.
        select: {
          id: true,
          body: true,
          stage: true,
          imageMimeType: true,
          imageSize: true,
          createdAt: true,
          author: { select: { username: true, email: true } },
        },
      },
    },
  });
  if (!r) return null;
  const candidateName = r.profileId ? ((await getProfileNames([r.profileId])).get(r.profileId) ?? null) : null;
  return {
    id: r.id,
    companyName: r.companyName,
    jobTitle: r.jobTitle,
    jobLink: r.jobLink,
    candidateName,
    bidderName: r.user.username || r.user.email,
    statuses: r.statuses,
    stage: getPrimaryStatus(r.statuses),
    appliedAt: r.appliedAt,
    createdAt: r.createdAt,
    hasResume: r.tailoredContentEnc !== null,
    notes: r.interviewNotes.map((n) => ({
      id: n.id,
      body: n.body,
      stage: n.stage,
      hasImage: n.imageMimeType !== null,
      imageSize: n.imageSize,
      authorName: n.author ? n.author.username || n.author.email : null,
      createdAt: n.createdAt,
    })),
  };
}

/**
 * Moves the application to an interview stage (or closes it). Statuses are an
 * accumulating history — the stage is added, never replacing earlier ones —
 * and the tracker shows the most advanced one (getPrimaryStatus).
 */
export async function setTrackerStage(resumeId: string, stage: ResumeStatus): Promise<void> {
  if (!TRACKER_STAGES.includes(stage)) throw new Error("Not an interview stage");
  const r = await db.resume.findUniqueOrThrow({ where: { id: resumeId }, select: { statuses: true } });
  if (r.statuses.includes(stage)) return;
  await db.resume.update({ where: { id: resumeId }, data: { statuses: [...r.statuses, stage] } });
}

export const MAX_NOTE_BODY = 5000;

export class NoteInputError extends Error {}

export async function addTrackerNote(
  authorId: string,
  resumeId: string,
  input: { body: string; image?: { data: Buffer; mimeType: string } | null }
): Promise<void> {
  const body = input.body.trim().slice(0, MAX_NOTE_BODY);
  if (!body && !input.image) throw new NoteInputError("Write a comment or add a screenshot.");
  const r = await db.resume.findUnique({ where: { id: resumeId }, select: { statuses: true } });
  if (!r) throw new NoteInputError("This application no longer exists.");
  await db.applicationNote.create({
    data: {
      resumeId,
      authorId,
      body,
      stage: getPrimaryStatus(r.statuses),
      ...(input.image
        ? { imageData: new Uint8Array(input.image.data), imageMimeType: input.image.mimeType, imageSize: input.image.data.byteLength }
        : {}),
    },
  });
}

export async function deleteTrackerNote(noteId: string): Promise<string | null> {
  const note = await db.applicationNote.findUnique({ where: { id: noteId }, select: { resumeId: true } });
  if (!note) return null;
  await db.applicationNote.delete({ where: { id: noteId } });
  return note.resumeId;
}

export async function getTrackerNoteImage(noteId: string): Promise<{ data: Buffer; mimeType: string } | null> {
  const n = await db.applicationNote.findUnique({ where: { id: noteId }, select: { imageData: true, imageMimeType: true } });
  if (!n?.imageData || !n.imageMimeType) return null;
  return { data: Buffer.from(n.imageData), mimeType: n.imageMimeType };
}
