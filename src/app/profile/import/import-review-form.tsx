"use client";

import { useState, useTransition } from "react";
import { confirmImportAction } from "./actions";
import type { ResumeDraft, WorkHistoryDraft, EducationDraft } from "@/lib/import/schema";

function emptyWorkHistoryEntry(): WorkHistoryDraft {
  return {
    company: "",
    jobTitle: "",
    location: null,
    startDate: null,
    endDate: null,
    achievements: [],
  };
}

function emptyEducationEntry(): EducationDraft {
  return { institution: "", degree: "", field: null, startDate: null, endDate: null };
}

export function ImportReviewForm({ draft: initialDraft }: { draft: ResumeDraft }) {
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await confirmImportAction(draft);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded border border-dashed p-3 text-sm text-gray-600">
        Review the extracted info below and fix anything the model got wrong before saving.
        Nothing has been saved yet.
      </p>

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Personal info</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Full name"
            value={draft.personalInfo.fullName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, personalInfo: { ...d.personalInfo, fullName: e.target.value } }))
            }
            className="rounded border px-3 py-2"
          />
          <input
            placeholder="Contact email"
            value={draft.personalInfo.contactEmail ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personalInfo: { ...d.personalInfo, contactEmail: e.target.value || null },
              }))
            }
            className="rounded border px-3 py-2"
          />
          <input
            placeholder="Phone"
            value={draft.personalInfo.phone ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, personalInfo: { ...d.personalInfo, phone: e.target.value || null } }))
            }
            className="rounded border px-3 py-2"
          />
          <input
            placeholder="LinkedIn URL"
            value={draft.personalInfo.linkedinUrl ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personalInfo: { ...d.personalInfo, linkedinUrl: e.target.value || null },
              }))
            }
            className="rounded border px-3 py-2"
          />
          <input
            placeholder="City"
            value={draft.personalInfo.city ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, personalInfo: { ...d.personalInfo, city: e.target.value || null } }))
            }
            className="rounded border px-3 py-2"
          />
          <input
            placeholder="State"
            value={draft.personalInfo.state ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, personalInfo: { ...d.personalInfo, state: e.target.value || null } }))
            }
            className="rounded border px-3 py-2"
          />
        </div>
        <textarea
          placeholder="Professional summary"
          rows={3}
          value={draft.personalInfo.professionalSummary ?? ""}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              personalInfo: { ...d.personalInfo, professionalSummary: e.target.value || null },
            }))
          }
          className="rounded border px-3 py-2"
        />
      </section>

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Work history</h2>
        {draft.workHistory.map((entry, i) => (
          <div key={i} className="flex flex-col gap-2 rounded border p-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Company"
                value={entry.company}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    workHistory: d.workHistory.map((w, j) =>
                      j === i ? { ...w, company: e.target.value } : w
                    ),
                  }))
                }
                className="rounded border px-3 py-2"
              />
              <input
                placeholder="Job title"
                value={entry.jobTitle}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    workHistory: d.workHistory.map((w, j) =>
                      j === i ? { ...w, jobTitle: e.target.value } : w
                    ),
                  }))
                }
                className="rounded border px-3 py-2"
              />
              <input
                type="date"
                value={entry.startDate ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    workHistory: d.workHistory.map((w, j) =>
                      j === i ? { ...w, startDate: e.target.value || null } : w
                    ),
                  }))
                }
                className="rounded border px-3 py-2"
              />
              <input
                type="date"
                placeholder="End date (blank = current)"
                value={entry.endDate ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    workHistory: d.workHistory.map((w, j) =>
                      j === i ? { ...w, endDate: e.target.value || null } : w
                    ),
                  }))
                }
                className="rounded border px-3 py-2"
              />
            </div>
            <textarea
              placeholder="One achievement per line"
              rows={3}
              value={entry.achievements.join("\n")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  workHistory: d.workHistory.map((w, j) =>
                    j === i ? { ...w, achievements: e.target.value.split("\n") } : w
                  ),
                }))
              }
              className="rounded border px-3 py-2"
            />
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, workHistory: d.workHistory.filter((_, j) => j !== i) }))
              }
              className="self-start text-sm text-red-600 underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({ ...d, workHistory: [...d.workHistory, emptyWorkHistoryEntry()] }))
          }
          className="self-start rounded border px-3 py-1 text-sm"
        >
          Add role
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Education</h2>
        {draft.education.map((entry, i) => (
          <div key={i} className="flex flex-col gap-2 rounded border p-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Institution"
                value={entry.institution}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    education: d.education.map((ed, j) =>
                      j === i ? { ...ed, institution: e.target.value } : ed
                    ),
                  }))
                }
                className="rounded border px-3 py-2"
              />
              <input
                placeholder="Degree"
                value={entry.degree}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    education: d.education.map((ed, j) =>
                      j === i ? { ...ed, degree: e.target.value } : ed
                    ),
                  }))
                }
                className="rounded border px-3 py-2"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, education: d.education.filter((_, j) => j !== i) }))
              }
              className="self-start text-sm text-red-600 underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({ ...d, education: [...d.education, emptyEducationEntry()] }))
          }
          className="self-start rounded border px-3 py-1 text-sm"
        >
          Add education
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Skills</h2>
        {(
          [
            ["languages", "Languages"],
            ["frameworks", "Frameworks"],
            ["tools", "Tools"],
            ["softSkills", "Soft skills"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1 text-sm text-gray-600">
            {label}
            <input
              value={draft.skills[key].join(", ")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  skills: { ...d.skills, [key]: e.target.value.split(",").map((s) => s.trim()) },
                }))
              }
              className="rounded border px-3 py-2 text-base text-black"
            />
          </label>
        ))}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save to profile"}
      </button>
    </div>
  );
}
