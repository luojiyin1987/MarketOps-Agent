import { z } from "zod";

export const SnapshotSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  content: z.string(),
  contentHash: z.string().min(1),
  fetchedAt: z.date(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
