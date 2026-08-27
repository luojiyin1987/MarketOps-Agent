import { z } from "zod";

export const CompetitorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  website: z.url(),
  createdAt: z.date(),
});

export type Competitor = z.infer<typeof CompetitorSchema>;
