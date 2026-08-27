import { z } from "zod";

export const ResearchRunStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export const ResearchRunSchema = z.object({
  id: z.string().min(1),
  competitorId: z.string().min(1),
  status: ResearchRunStatusSchema,
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type ResearchRun = z.infer<typeof ResearchRunSchema>;
