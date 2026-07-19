"use client";

import { useActionState } from "react";
import { saveSkillGroupAction } from "./actions";
import type { SkillGroupView } from "@/lib/profile/skills";

const CATEGORY_LABELS: Record<SkillGroupView["category"], string> = {
  LANGUAGES: "Languages",
  FRAMEWORKS: "Frameworks",
  TOOLS: "Tools",
  SOFT_SKILLS: "Soft skills",
};

function SkillCategoryForm({ group }: { group: SkillGroupView }) {
  const [state, formAction, pending] = useActionState(saveSkillGroupAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-600">
        {CATEGORY_LABELS[group.category]}
      </label>
      <input type="hidden" name="category" value={group.category} />
      <input
        name="skills"
        placeholder="Comma-separated, e.g. TypeScript, Python, Go"
        defaultValue={group.skills.join(", ")}
        className="rounded border px-3 py-2"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function SkillsSection({ groups }: { groups: SkillGroupView[] }) {
  return (
    <section className="flex flex-col gap-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Skills</h2>
      {groups.map((group) => (
        <SkillCategoryForm key={group.category} group={group} />
      ))}
    </section>
  );
}
