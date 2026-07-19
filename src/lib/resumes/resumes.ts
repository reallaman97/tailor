import { db } from "@/lib/db";
import type { CreateResumeInput } from "@/lib/resumes/schemas";
import type { ResumeStatus } from "@/generated/prisma/client";

export class ResumeNotFoundError extends Error {
  constructor() {
    super("Resume not found");
  }
}

export type ResumeSummary = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  status: ResumeStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ResumeDetail = ResumeSummary & {
  jobDescription: string;
  generatedAt: Date | null;
  appliedAt: Date | null;
  modelUsed: string | null;
};

export async function createResume(userId: string, input: CreateResumeInput): Promise<string> {
  const resume = await db.resume.create({
    data: {
      userId,
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      jobLink: input.jobLink || null,
      jobDescription: input.jobDescription,
    },
  });
  return resume.id;
}

export async function listResumes(userId: string): Promise<ResumeSummary[]> {
  const resumes = await db.resume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      jobTitle: true,
      jobLink: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return resumes;
}

export async function getResume(userId: string, resumeId: string): Promise<ResumeDetail | null> {
  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId },
    select: {
      id: true,
      companyName: true,
      jobTitle: true,
      jobLink: true,
      jobDescription: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      generatedAt: true,
      appliedAt: true,
      modelUsed: true,
    },
  });
  return resume;
}

export async function updateResumeStatus(
  userId: string,
  resumeId: string,
  status: ResumeStatus
): Promise<void> {
  const existing = await db.resume.findFirst({
    where: { id: resumeId, userId },
    select: { appliedAt: true },
  });
  if (!existing) throw new ResumeNotFoundError();

  const result = await db.resume.updateMany({
    where: { id: resumeId, userId },
    data: {
      status,
      // Set once, the first time a resume moves to APPLIED — later status
      // changes (e.g. to INTERVIEWING) don't overwrite when it happened.
      appliedAt: status === "APPLIED" && !existing.appliedAt ? new Date() : undefined,
    },
  });

  if (result.count === 0) throw new ResumeNotFoundError();
}

export async function deleteResume(userId: string, resumeId: string): Promise<void> {
  const result = await db.resume.deleteMany({ where: { id: resumeId, userId } });
  if (result.count === 0) throw new ResumeNotFoundError();
}
