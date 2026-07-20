"use client";

import { useActionState } from "react";
import { saveSkillGroupAction, createSkillGroupAction, deleteSkillGroupAction } from "./actions";
import type { SkillGroupView } from "@/lib/profile/skills";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon, PlusIcon } from "@/components/icons";

function SkillGroupForm({ profileId, group }: { profileId: string; group: SkillGroupView }) {
  const action = saveSkillGroupAction.bind(null, profileId, group.category);
  const [state, formAction, pending] = useActionState(action, undefined);
  const formId = `skill-group-form-${group.category}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <form id={formId} action={formAction} className="flex flex-col gap-3">
        <FormField label="Category name" htmlFor={`${formId}-category`}>
          <Input id={`${formId}-category`} name="category" required defaultValue={group.category} />
        </FormField>
        <FormField label="Skills" htmlFor={`${formId}-skills`}>
          <Input
            id={`${formId}-skills`}
            name="skills"
            placeholder="Comma-separated, e.g. TypeScript, Python, Go"
            defaultValue={group.skills.join(", ")}
          />
        </FormField>
        {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      </form>

      <div className="flex items-center gap-2">
        <Button type="submit" form={formId} variant="secondary" size="sm" loading={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <ConfirmDialog
          title="Delete this category?"
          description={`This permanently removes the "${group.category}" skill category from this profile.`}
          action={deleteSkillGroupAction.bind(null, profileId, group.category)}
          triggerVariant="ghost"
          triggerSize="sm"
          triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          triggerContent={
            <>
              <TrashIcon className="size-4" />
              Delete
            </>
          }
        />
      </div>
    </div>
  );
}

function NewSkillGroupForm({ profileId }: { profileId: string }) {
  const action = createSkillGroupAction.bind(null, profileId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      key={state?.success ? "reset" : "form"}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4"
    >
      <FormField label="Category name" htmlFor="new-skill-category">
        <Input id="new-skill-category" name="category" required placeholder="e.g. Certifications" />
      </FormField>
      <FormField label="Skills" htmlFor="new-skill-skills">
        <Input id="new-skill-skills" name="skills" placeholder="Comma-separated, e.g. AWS, PMP" />
      </FormField>
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      <Button type="submit" size="sm" loading={pending} className="self-start">
        <PlusIcon className="size-4" />
        {pending ? "Adding…" : "Add category"}
      </Button>
    </form>
  );
}

export function SkillsSection({ profileId, groups }: { profileId: string; groups: SkillGroupView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
        <CardDescription>
          Tailoring selects and reorders from these — it never adds a skill that isn&apos;t listed.
          Add, rename, or remove categories as needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">No skill categories yet.</p>
        )}
        {groups.map((group) => (
          <SkillGroupForm key={group.category} profileId={profileId} group={group} />
        ))}
        <NewSkillGroupForm profileId={profileId} />
      </CardContent>
    </Card>
  );
}
