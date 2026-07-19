import { z } from "zod";

export const tailoredContentSchema = z.object({
  summary: z.string(),
  workHistory: z.array(
    z.object({
      entryId: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  orderedSkills: z.array(z.string()),
});

export type TailoredContent = z.infer<typeof tailoredContentSchema>;
