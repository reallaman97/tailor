"use client";

import { useState, useTransition } from "react";
import { updateProfileTemplateAction } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { DownloadIcon } from "@/components/icons";
import { RESUME_STYLES, DEFAULT_STYLE_KEY } from "@/lib/export/styles";

export function TemplateSelector({
  profileId,
  current,
  appDefaultKey,
}: {
  profileId: string;
  current: string | null;
  appDefaultKey: string;
}) {
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveKey = value || appDefaultKey;
  const effective = RESUME_STYLES.find((s) => s.key === effectiveKey) ?? RESUME_STYLES.find((s) => s.key === DEFAULT_STYLE_KEY)!;

  const onChange = (next: string) => {
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await updateProfileTemplateAction(profileId, next);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume template</CardTitle>
        <CardDescription>The PDF style used when exporting or generating this candidate&apos;s resume.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <Alert variant="destructive">{error}</Alert>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Style</span>
            <Select
              value={value}
              disabled={pending}
              onChange={(e) => onChange(e.target.value)}
              className="w-64"
              aria-label="Resume template style"
            >
              <option value="">App default ({appDefaultKey})</option>
              {RESUME_STYLES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <a
            href={`/api/admin/profiles/${profileId}/resume-preview?style=${effectiveKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants("outline", "md")}
          >
            <DownloadIcon className="size-4" />
            Preview PDF
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{effective.name}:</span> {effective.description}
        </p>
      </CardContent>
    </Card>
  );
}
