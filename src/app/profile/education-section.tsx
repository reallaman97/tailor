"use client";

import { useActionState } from "react";
import { createEducationAction, updateEducationAction, deleteEducationAction } from "./actions";
import type { EducationEntry } from "@/lib/profile/education";

function EducationEntryForm({ entry }: { entry?: EducationEntry }) {
  const action = entry ? updateEducationAction.bind(null, entry.id) : createEducationAction;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border p-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          name="institution"
          placeholder="Institution"
          required
          defaultValue={entry?.institution}
          className="rounded border px-3 py-2"
        />
        <input
          name="degree"
          placeholder="Degree"
          required
          defaultValue={entry?.degree}
          className="rounded border px-3 py-2"
        />
        <input
          name="field"
          placeholder="Field of study"
          defaultValue={entry?.field ?? ""}
          className="rounded border px-3 py-2"
        />
        <div className="flex gap-2">
          <label className="flex flex-col text-sm text-gray-600">
            Start date
            <input
              name="startDate"
              type="date"
              defaultValue={entry?.startDate ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm text-gray-600">
            End date
            <input
              name="endDate"
              type="date"
              defaultValue={entry?.endDate ?? ""}
              className="rounded border px-3 py-2"
            />
          </label>
        </div>
      </div>

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
          <form action={deleteEducationAction.bind(null, entry.id)}>
            <button type="submit" className="text-sm text-red-600 underline">
              Delete
            </button>
          </form>
        )}
      </div>
    </form>
  );
}

export function EducationSection({ entries }: { entries: EducationEntry[] }) {
  return (
    <section className="flex flex-col gap-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Education</h2>

      {entries.map((entry) => (
        <EducationEntryForm key={entry.id} entry={entry} />
      ))}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-600">Add another</h3>
        <EducationEntryForm />
      </div>
    </section>
  );
}
