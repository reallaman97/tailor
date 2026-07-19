"use client";

import { useActionState } from "react";
import { savePersonalInfoAction } from "./actions";
import type { DecryptedPersonalInfo } from "@/lib/profile/personal-info";

export function PersonalInfoForm({ info }: { info: DecryptedPersonalInfo | null }) {
  const [state, formAction, pending] = useActionState(savePersonalInfoAction, undefined);

  return (
    <section className="flex flex-col gap-3 rounded border p-4">
      <h2 className="text-lg font-semibold">Personal info</h2>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            name="fullName"
            placeholder="Full name"
            required
            defaultValue={info?.fullName}
            className="rounded border px-3 py-2"
          />
          <input
            name="contactEmail"
            type="email"
            placeholder="Contact email"
            required
            defaultValue={info?.contactEmail}
            className="rounded border px-3 py-2"
          />
          <input
            name="phone"
            placeholder="Phone"
            required
            defaultValue={info?.phone}
            className="rounded border px-3 py-2"
          />
          <input
            name="linkedinUrl"
            placeholder="LinkedIn URL"
            defaultValue={info?.linkedinUrl ?? ""}
            className="rounded border px-3 py-2"
          />
          <input
            name="city"
            placeholder="City"
            defaultValue={info?.city ?? ""}
            className="rounded border px-3 py-2"
          />
          <input
            name="state"
            placeholder="State"
            defaultValue={info?.state ?? ""}
            className="rounded border px-3 py-2"
          />
        </div>

        <textarea
          name="professionalSummary"
          placeholder="Professional summary"
          defaultValue={info?.professionalSummary ?? ""}
          rows={4}
          className="rounded border px-3 py-2"
        />

        <fieldset className="flex flex-col gap-3 rounded border border-dashed p-3">
          <legend className="px-1 text-sm font-medium text-gray-600">
            Reference only — never included on generated resumes
          </legend>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={info?.dateOfBirth ?? ""}
            className="rounded border px-3 py-2"
          />
          <input
            name="addressLine1"
            placeholder="Address line 1"
            defaultValue={info?.addressLine1 ?? ""}
            className="rounded border px-3 py-2"
          />
          <input
            name="addressLine2"
            placeholder="Address line 2"
            defaultValue={info?.addressLine2 ?? ""}
            className="rounded border px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="postalCode"
              placeholder="Postal code"
              defaultValue={info?.postalCode ?? ""}
              className="rounded border px-3 py-2"
            />
            <input
              name="country"
              placeholder="Country"
              defaultValue={info?.country ?? ""}
              className="rounded border px-3 py-2"
            />
          </div>
        </fieldset>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-700">Saved.</p>}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save personal info"}
        </button>
      </form>
    </section>
  );
}
