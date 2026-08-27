import { z } from "zod";

export const SourceTypeSchema = z.enum(["website", "pricing", "blog", "github", "rss"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  id: z.string().min(1),
  competitorId: z.string().min(1),
  type: SourceTypeSchema,
  url: z.url(),
  createdAt: z.date(),
});

export type Source = z.infer<typeof SourceSchema>;
