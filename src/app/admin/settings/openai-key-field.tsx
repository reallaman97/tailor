"use client";

import { useState, useTransition } from "react";
import { testOpenAiKeyAction } from "./actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function OpenAiKeyField({
  hasCustomKey,
  apiKeyHint,
}: {
  hasCustomKey: boolean;
  apiKeyHint: string | null;
}) {
  const [value, setValue] = useState("");
  const [clear, setClear] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  function testKey() {
    setResult(null);
    startTransition(async () => {
      const outcome = await testOpenAiKeyAction(value);
      setResult(outcome);
    });
  }

  return (
    <FormField
      label="OpenAI API key"
      htmlFor="openaiApiKey"
      hint={
        hasCustomKey
          ? `A custom key is set (${apiKeyHint}). Leave the field blank to keep it, or type a new one to replace it.`
          : "Using the OPENAI_API_KEY environment variable. Enter a key here to override it."
      }
    >
      <div className="flex gap-2">
        <Input
          id="openaiApiKey"
          name="openaiApiKey"
          type="password"
          autoComplete="off"
          placeholder={hasCustomKey ? "Leave blank to keep the current key" : "sk-…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={clear}
          className="flex-1"
        />
        <Button type="button" variant="secondary" loading={pending} onClick={testKey}>
          {pending ? "Testing…" : "Test key"}
        </Button>
      </div>

      {hasCustomKey && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="clearOpenaiApiKey"
            value="true"
            checked={clear}
            onChange={(e) => setClear(e.target.checked)}
          />
          Remove the custom key and use the environment variable instead
        </label>
      )}

      {result?.success && (
        <Alert variant="success">Key verified — connected to OpenAI successfully.</Alert>
      )}
      {result && !result.success && <Alert variant="destructive">{result.error}</Alert>}
    </FormField>
  );
}
