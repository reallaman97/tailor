"use client";

import { useActionState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { saveCriteriaAction } from "./actions";

export function CriteriaForm({ techStack }: { techStack: string }) {
  const [state, formAction, pending] = useActionState(saveCriteriaAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField
        label="Target tech stack"
        htmlFor="techStack"
        required
        hint="Comma-separated. Each application is checked only on whether its stack is relevant to these (close equivalents count)."
      >
        <Textarea
          id="techStack"
          name="techStack"
          rows={3}
          defaultValue={techStack}
          placeholder="e.g. Python, Django, React, PostgreSQL, AWS, Docker"
        />
      </FormField>

      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      {state?.ok && <Alert variant="success">{state.ok}</Alert>}

      <div>
        <Button type="submit" loading={pending}>
          Save stack
        </Button>
      </div>
    </form>
  );
}
