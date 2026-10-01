"use client";

import { useMemo, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  validateReviewedProfile,
  EMPTY_WORK_ENTRY,
  EMPTY_EDUCATION_ENTRY,
  EMPTY_CERTIFICATION_ENTRY,
  EMPTY_SKILL_GROUP,
  type ReviewedProfileInput,
  type ReviewSubmission,
  type ReviewSubmitResult,
  type FieldErrors,
} from "@/lib/base-resume/reviewed-profile";
import type { VerbatimCheck } from "@/lib/base-resume/text";
import { WORKING_STYLE_OPTIONS, WORKING_TYPE_OPTIONS } from "@/lib/profile/work-history-constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PlusIcon, TrashIcon } from "@/components/icons";

type Personal = ReviewedProfileInput["personal"];
type Work = ReviewedProfileInput["workHistory"][number];
type Education = ReviewedProfileInput["education"][number];
type Certification = ReviewedProfileInput["certifications"][number];
type SkillGroup = ReviewedProfileInput["skills"][number];

/** DOM id for a field path — also how the "jump to first error" finds it. */
const fid = (path: string) => `review-${path.replace(/\./g, "-")}`;

function countLines(text: string): number {
  return text.split("\n").filter((l) => l.trim()).length;
}

/**
 * Step 2: every profile section, prefilled from the parsed base resume and
 * fully editable. Validation runs live with the same rules the server
 * enforces, and errors show under each field; submitting is blocked until
 * everything is valid.
 */
export function ProfileReviewForm({
  initial,
  check,
  sourceText,
  fileName,
  mode,
  onSubmit,
  onStartOver,
}: {
  initial: ReviewedProfileInput;
  check: VerbatimCheck;
  sourceText: string;
  fileName: string | null;
  mode: "create" | "replace";
  onSubmit: (submission: ReviewSubmission) => Promise<ReviewSubmitResult>;
  onStartOver: () => void;
}) {
  const [profile, setProfile] = useState(initial);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  const validation = useMemo(() => validateReviewedProfile(profile), [profile]);
  const errors: FieldErrors = { ...(validation.ok ? {} : validation.fieldErrors), ...serverErrors };
  const errorCount = Object.keys(errors).length;
  const err = (path: string) => errors[path];

  function update(mutate: (draft: ReviewedProfileInput) => void) {
    setServerErrors({});
    setFormError(null);
    setProfile((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
  }

  const setPersonal = (field: keyof Personal, value: string) => update((p) => void (p.personal[field] = value));
  const setWork = (i: number, field: keyof Work, value: string) => update((p) => void (p.workHistory[i][field] = value));
  const setEducation = (i: number, field: keyof Education, value: string) =>
    update((p) => void (p.education[i][field] = value));
  const setCertification = (i: number, field: keyof Certification, value: string) =>
    update((p) => void (p.certifications[i][field] = value));
  const setSkill = (i: number, field: keyof SkillGroup, value: string) => update((p) => void (p.skills[i][field] = value));

  function jumpToFirstError() {
    const first = document.querySelector<HTMLElement>("[data-invalid] input, [data-invalid] textarea, [data-invalid] select");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    first?.focus({ preventScroll: true });
  }

  function submit() {
    if (!validation.ok) {
      setFormError(`Fix the ${errorCount} highlighted field${errorCount === 1 ? "" : "s"} before continuing.`);
      requestAnimationFrame(jumpToFirstError);
      return;
    }
    startSubmit(async () => {
      let result: ReviewSubmitResult;
      setFormError(null);
      try {
        result = await onSubmit({ profile, sourceText, fileName });
      } catch (err) {
        // "Create profile" finishes with a redirect, which Next signals by throwing — let it through.
        unstable_rethrow(err);
        // Anything else (e.g. the database timing out) must be visible, never a silent no-op.
        // The save is all-or-nothing, but the failure may have come after it committed (while
        // refreshing the page), so don't claim either way — the reviewed data stays here to retry.
        setFormError(
          "The server didn't respond in time, so the save couldn't be confirmed. Reload the page to check whether it went through; if not, try again — your edits are still here."
        );
        return;
      }
      if (result?.fieldErrors) setServerErrors(result.fieldErrors);
      if (result?.error) {
        setFormError(result.error);
        requestAnimationFrame(jumpToFirstError);
      }
    });
  }

  const bulletTotal = profile.workHistory.reduce((n, w) => n + countLines(w.bullets), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* What was read */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {fileName ? <span className="font-medium text-foreground">{fileName}</span> : "Pasted resume"} ·{" "}
              {profile.workHistory.length} roles · {bulletTotal} bullets · {profile.skills.length} skill groups
            </span>
            <Button variant="ghost" size="sm" onClick={onStartOver} disabled={pending}>
              Use a different resume
            </Button>
          </div>
          {check.bulletsMatched === check.bulletsTotal ? (
            <Alert variant="success">
              All {check.bulletsTotal} bullets were copied from the resume word-for-word. Review each section, fix
              anything flagged, then {mode === "create" ? "create the profile" : "replace the profile content"}.
            </Alert>
          ) : (
            <Alert>
              {check.bulletsMatched} of {check.bulletsTotal} bullets match the resume word-for-word. These may have been
              reworded while reading — compare them with the original below:
              <ul className="mt-1 list-disc pl-5">
                {check.unmatched.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </Alert>
          )}
          <details className="rounded-md border border-border bg-muted/30 p-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Show the original resume text</summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{sourceText}</pre>
          </details>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal info</CardTitle>
          <CardDescription>Shown in the resume header. Email and phone were found in the resume text.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" path="personal.fullName" required value={profile.personal.fullName} error={err("personal.fullName")} onChange={(v) => setPersonal("fullName", v)} />
            <TextField label="Contact email" path="personal.contactEmail" type="email" required value={profile.personal.contactEmail} error={err("personal.contactEmail")} onChange={(v) => setPersonal("contactEmail", v)} />
            <TextField label="Phone" path="personal.phone" type="tel" required value={profile.personal.phone} error={err("personal.phone")} onChange={(v) => setPersonal("phone", v)} />
            <TextField label="LinkedIn URL" path="personal.linkedinUrl" type="url" placeholder="https://linkedin.com/in/…" value={profile.personal.linkedinUrl} error={err("personal.linkedinUrl")} onChange={(v) => setPersonal("linkedinUrl", v)} />
            <TextField label="City" path="personal.city" value={profile.personal.city} error={err("personal.city")} onChange={(v) => setPersonal("city", v)} />
            <TextField label="State" path="personal.state" value={profile.personal.state} error={err("personal.state")} onChange={(v) => setPersonal("state", v)} />
          </div>
          <FormField label="Professional summary" htmlFor={fid("personal.professionalSummary")} error={err("personal.professionalSummary")}>
            <Textarea
              id={fid("personal.professionalSummary")}
              rows={5}
              value={profile.personal.professionalSummary}
              onChange={(e) => setPersonal("professionalSummary", e.target.value)}
            />
          </FormField>

          {mode === "create" && (
            <details className="rounded-md border border-border p-3" open={Boolean(err("personal.dateOfBirth"))}>
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Reference-only details <span className="font-normal text-muted-foreground">(optional · never put on resumes)</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <TextField label="Date of birth" path="personal.dateOfBirth" type="date" value={profile.personal.dateOfBirth} error={err("personal.dateOfBirth")} onChange={(v) => setPersonal("dateOfBirth", v)} />
                <TextField label="Address line 1" path="personal.addressLine1" value={profile.personal.addressLine1} error={err("personal.addressLine1")} onChange={(v) => setPersonal("addressLine1", v)} />
                <TextField label="Address line 2" path="personal.addressLine2" value={profile.personal.addressLine2} error={err("personal.addressLine2")} onChange={(v) => setPersonal("addressLine2", v)} />
                <TextField label="Postal code" path="personal.postalCode" value={profile.personal.postalCode} error={err("personal.postalCode")} onChange={(v) => setPersonal("postalCode", v)} />
                <TextField label="Country" path="personal.country" value={profile.personal.country} error={err("personal.country")} onChange={(v) => setPersonal("country", v)} />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Work history */}
      <Card>
        <CardHeader>
          <CardTitle>Work history</CardTitle>
          <CardDescription>
            Every role and bullet from the resume. Tailored resumes are generated from exactly this — keep it complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {err("workHistory") && <p className="text-sm text-destructive">{err("workHistory")}</p>}
          {profile.workHistory.map((w, i) => (
            <EntryBox
              key={i}
              title={`Role ${i + 1}${w.company ? ` — ${w.company}` : ""}`}
              onRemove={() => update((p) => void p.workHistory.splice(i, 1))}
              removeLabel={`Remove role ${i + 1}`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Company" path={`workHistory.${i}.company`} required value={w.company} error={err(`workHistory.${i}.company`)} onChange={(v) => setWork(i, "company", v)} />
                <TextField label="Job title" path={`workHistory.${i}.jobTitle`} required value={w.jobTitle} error={err(`workHistory.${i}.jobTitle`)} onChange={(v) => setWork(i, "jobTitle", v)} />
                <TextField label="Location" path={`workHistory.${i}.location`} value={w.location} error={err(`workHistory.${i}.location`)} onChange={(v) => setWork(i, "location", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Working style" path={`workHistory.${i}.workingStyle`} value={w.workingStyle} options={WORKING_STYLE_OPTIONS} onChange={(v) => setWork(i, "workingStyle", v)} />
                  <SelectField label="Working type" path={`workHistory.${i}.workingType`} value={w.workingType} options={WORKING_TYPE_OPTIONS} onChange={(v) => setWork(i, "workingType", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Start date" path={`workHistory.${i}.startDate`} type="month" required value={w.startDate} error={err(`workHistory.${i}.startDate`)} onChange={(v) => setWork(i, "startDate", v)} />
                  <TextField label="End date" path={`workHistory.${i}.endDate`} type="month" hint="Leave empty if current" value={w.endDate} error={err(`workHistory.${i}.endDate`)} onChange={(v) => setWork(i, "endDate", v)} />
                </div>
              </div>
              <FormField
                label={`Bullets (${countLines(w.bullets)})`}
                htmlFor={fid(`workHistory.${i}.bullets`)}
                required
                hint="One bullet per line."
                error={err(`workHistory.${i}.bullets`)}
              >
                <Textarea
                  id={fid(`workHistory.${i}.bullets`)}
                  rows={Math.min(18, Math.max(4, countLines(w.bullets) + 1))}
                  value={w.bullets}
                  onChange={(e) => setWork(i, "bullets", e.target.value)}
                  aria-invalid={Boolean(err(`workHistory.${i}.bullets`))}
                />
              </FormField>
            </EntryBox>
          ))}
          <AddButton label="Add role" onClick={() => update((p) => void p.workHistory.push({ ...EMPTY_WORK_ENTRY }))} />
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <CardTitle>Education</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {profile.education.length === 0 && <p className="text-sm text-muted-foreground">No education found in the resume.</p>}
          {profile.education.map((e, i) => (
            <EntryBox key={i} title={`Education ${i + 1}`} onRemove={() => update((p) => void p.education.splice(i, 1))} removeLabel={`Remove education ${i + 1}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Institution" path={`education.${i}.institution`} required value={e.institution} error={err(`education.${i}.institution`)} onChange={(v) => setEducation(i, "institution", v)} />
                <TextField label="Degree" path={`education.${i}.degree`} required value={e.degree} error={err(`education.${i}.degree`)} onChange={(v) => setEducation(i, "degree", v)} />
                <TextField label="Field of study" path={`education.${i}.field`} value={e.field} error={err(`education.${i}.field`)} onChange={(v) => setEducation(i, "field", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Start date" path={`education.${i}.startDate`} type="month" value={e.startDate} error={err(`education.${i}.startDate`)} onChange={(v) => setEducation(i, "startDate", v)} />
                  <TextField label="End date" path={`education.${i}.endDate`} type="month" value={e.endDate} error={err(`education.${i}.endDate`)} onChange={(v) => setEducation(i, "endDate", v)} />
                </div>
              </div>
            </EntryBox>
          ))}
          <AddButton label="Add education" onClick={() => update((p) => void p.education.push({ ...EMPTY_EDUCATION_ENTRY }))} />
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <CardTitle>Certifications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {profile.certifications.length === 0 && (
            <p className="text-sm text-muted-foreground">No certifications found in the resume.</p>
          )}
          {profile.certifications.map((c, i) => (
            <EntryBox key={i} title={`Certification ${i + 1}`} onRemove={() => update((p) => void p.certifications.splice(i, 1))} removeLabel={`Remove certification ${i + 1}`}>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Name" path={`certifications.${i}.name`} required value={c.name} error={err(`certifications.${i}.name`)} onChange={(v) => setCertification(i, "name", v)} />
                <TextField label="Issuer" path={`certifications.${i}.issuer`} value={c.issuer} error={err(`certifications.${i}.issuer`)} onChange={(v) => setCertification(i, "issuer", v)} />
                <TextField label="Issue date" path={`certifications.${i}.issueDate`} type="month" value={c.issueDate} error={err(`certifications.${i}.issueDate`)} onChange={(v) => setCertification(i, "issueDate", v)} />
              </div>
            </EntryBox>
          ))}
          <AddButton label="Add certification" onClick={() => update((p) => void p.certifications.push({ ...EMPTY_CERTIFICATION_ENTRY }))} />
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>The resume&apos;s own categories, in order.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {profile.skills.map((g, i) => (
            <div key={i} className="grid items-start gap-3 sm:grid-cols-[14rem_1fr_auto]">
              <TextField label="Category" path={`skills.${i}.category`} required value={g.category} error={err(`skills.${i}.category`)} onChange={(v) => setSkill(i, "category", v)} />
              <FormField label="Skills" htmlFor={fid(`skills.${i}.skills`)} required hint="Comma-separated." error={err(`skills.${i}.skills`)}>
                <Textarea
                  id={fid(`skills.${i}.skills`)}
                  rows={2}
                  value={g.skills}
                  onChange={(e) => setSkill(i, "skills", e.target.value)}
                  aria-invalid={Boolean(err(`skills.${i}.skills`))}
                />
              </FormField>
              <Button
                variant="ghost"
                size="icon"
                className="mt-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove skill group ${i + 1}`}
                onClick={() => update((p) => void p.skills.splice(i, 1))}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))}
          <AddButton label="Add skill group" onClick={() => update((p) => void p.skills.push({ ...EMPTY_SKILL_GROUP }))} />
        </CardContent>
      </Card>

      {/* Confirm */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 rounded-lg border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        {mode === "replace" && (
          <p className="text-sm text-muted-foreground">
            Replaces this profile&apos;s personal info, summary, work history, education, certifications, and skills. Roles
            matched by company and start date keep their identity, so applications already generated keep their
            tailored content. Date of birth and address are not changed.
          </p>
        )}
        {formError && <Alert variant="destructive">{formError}</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} loading={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create profile" : "Replace profile content"}
          </Button>
          {errorCount > 0 ? (
            <button type="button" onClick={jumpToFirstError} className="text-sm text-destructive underline-offset-2 hover:underline">
              {errorCount} field{errorCount === 1 ? " needs" : "s need"} attention — show first
            </button>
          ) : (
            <span className="text-sm text-success">All fields look good.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  path,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  path: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  const id = fid(path);
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={error ? "border-destructive focus-visible:ring-destructive" : undefined}
      />
    </FormField>
  );
}

function SelectField({
  label,
  path,
  value,
  options,
  onChange,
}: {
  label: string;
  path: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = fid(path);
  return (
    <FormField label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not specified</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function EntryBox({
  title,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <TrashIcon className="size-4" />
          Remove
        </Button>
      </div>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="self-start" onClick={onClick}>
      <PlusIcon className="size-4" />
      {label}
    </Button>
  );
}
