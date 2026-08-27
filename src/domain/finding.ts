import { z } from "zod";

export const FindingTypeSchema = z.enum([
  "pricing_change",
  "product_launch",
  "positioning_change",
  "content_change",
  "other",
]);

export const SeveritySchema = z.enum(["low", "medium", "high"]);

export const FindingSchema = z.object({
  id: z.string().min(1),
  competitorId: z.string().min(1),
  changeId: z.string().min(1),
  type: FindingTypeSchema,
  severity: SeveritySchema,
  summary: z.string().min(1),
  impact: z.string().min(1),
  confidence: z.number().min(0).max(1),
  createdAt: z.date(),
});

export type Finding = z.infer<typeof FindingSchema>;
