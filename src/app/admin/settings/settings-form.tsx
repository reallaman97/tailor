"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "./actions";
import { OpenAiKeyField } from "./openai-key-field";
import type { AppSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume generation</CardTitle>
        <CardDescription>
          Controls how every tailored resume is generated and rendered, app-wide.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <OpenAiKeyField hasCustomKey={settings.hasCustomApiKey} apiKeyHint={settings.apiKeyHint} />

          <FormField
            label="OpenAI model"
            htmlFor="openaiModel"
            hint="Any valid OpenAI model name, e.g. gpt-4.1-mini, gpt-4.1."
          >
            <Input
              id="openaiModel"
              name="openaiModel"
              required
              defaultValue={settings.openaiModel}
              className="max-w-xs"
            />
          </FormField>

          <FormField label="Resume PDF template" htmlFor="resumeTemplate">
            <Select id="resumeTemplate" name="resumeTemplate" defaultValue={settings.resumeTemplate} className="max-w-xs">
              <option value="MODERN">Modern</option>
              <option value="CLASSIC">Classic</option>
            </Select>
          </FormField>

          <FormField
            label="Tailoring prompt"
            htmlFor="tailoringPrompt"
            hint="The system instructions sent to the model for every tailoring request. Edit with care — it's what keeps the model grounded in the candidate's real data."
          >
            <Textarea
              id="tailoringPrompt"
              name="tailoringPrompt"
              required
              rows={14}
              className="font-mono text-xs"
              defaultValue={settings.tailoringPrompt}
            />
          </FormField>

          {state?.error && <Alert variant="destructive">{state.error}</Alert>}
          {state?.success && <Alert variant="success">Settings saved.</Alert>}

          <Button type="submit" loading={pending} className="self-start">
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
