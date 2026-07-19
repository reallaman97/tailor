"use client";

import { useActionState } from "react";
import {
  createWorkHistoryAction,
  updateWorkHistoryAction,
  deleteWorkHistoryAction,
} from "./actions";
import type { DecryptedWorkHistoryEntry } from "@/lib/profile/work-history";

function WorkHistoryEntryForm({ entry }: { entry?: DecryptedWorkHistoryEntry }) {
  const action = entry ? updateWorkHistoryAction.bind(null, entry.id) : createWorkHistoryAction;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border p-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          name="company"
          placeholder="Company"
          required
          defaultValue={entry?.company}
          className="rounded border px-3 py-2"
        />
        <input
          name="jobTitle"
          placeholder="Job title"
          required
          defaultValue={entry?.jobTitle}
          className="rounded border px-3 py-2"
        />
        <input
          name="location"
          placeholder="Location"
          defaultValue={entry?.location ?? ""}
          className="rounded border px-3 py-2"
        />
        <div className="flex gap-2">
          <label className="flex flex-col text-sm text-gray-600">
            Start date
            <input
              name="startDate"
              type="date"
              required
              defaultValue={entry?.startDate}
              className="rounded border px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm text-gray-600">
            End date (blank = current)
            <input
              name="endDate"
              type="date"
              defaultValue={entry?.endDate ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>
        </div>
      </div>

      <textarea
        name="achievements"
        placeholder="One achievement per line"
        rows={4}
        defaultValue={entry?.achievements.join("\n")}
        className="rounded border px-3 py-2"
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : entry ? "Update" : "Add entry"}
        </button>

        {entry && (
          <form action={deleteWorkHistoryAction.bind(null, entry.id)}>
            <button type="submit" className="text-sm text-red-600 underline">
              Delete
            </button>
          </form>
        )}
      </div>
    </form>
  );
}

export function WorkHistorySection({ entries }: { entries: DecryptedWorkHistoryEntry[] }) {
  return (
    <section className="flex flex-col gap-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Work history</h2>

      {entries.map((entry) => (
        <WorkHistoryEntryForm key={entry.id} entry={entry} />
      ))}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-600">Add another role</h3>
        <WorkHistoryEntryForm />
      </div>
    </section>
  );
}
