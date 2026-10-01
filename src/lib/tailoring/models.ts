// DeepSeek models offered for resume generation. Kept free of server imports so
// client components (settings form, tailoring debug page) can render the list.
export const RESUME_MODELS = [
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    hint: "Strongest reasoning — typically ~1–2 min per resume.",
  },
  {
    id: "deepseek-flash",
    label: "DeepSeek V4.1 Flash",
    hint: "Faster and cheaper — typically ~40–60s per resume.",
  },
] as const;

export type ResumeModelId = (typeof RESUME_MODELS)[number]["id"];

export const DEFAULT_RESUME_MODEL: ResumeModelId = "deepseek-v4-pro";

export function isResumeModel(value: string): value is ResumeModelId {
  return RESUME_MODELS.some((m) => m.id === value);
}

/** A stored model name, falling back to the default when it isn't a DeepSeek model we support. */
export function normalizeResumeModel(value: string | null | undefined): ResumeModelId {
  return value && isResumeModel(value) ? value : DEFAULT_RESUME_MODEL;
}
