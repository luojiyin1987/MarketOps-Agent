import { z } from "zod";

const ChangeAnalysisBaseSchema = z.object({
  changeId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  analyzedAt: z.date(),
});

export const ChangeAnalysisSchema = z.discriminatedUnion("relevant", [
  ChangeAnalysisBaseSchema.extend({
    relevant: z.literal(true),
  }),
  ChangeAnalysisBaseSchema.extend({
    relevant: z.literal(false),
    reason: z.string().min(1),
  }),
]);

export type ChangeAnalysis = z.infer<typeof ChangeAnalysisSchema>;
