import { z } from "zod";

export const ChangeSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  previousSnapshotId: z.string().min(1),
  currentSnapshotId: z.string().min(1),
  diff: z.string(),
  detectedAt: z.date(),
});

export type Change = z.infer<typeof ChangeSchema>;
