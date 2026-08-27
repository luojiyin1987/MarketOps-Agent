import type { Competitor, Source } from "../domain/index.js";

export interface CompetitorRepository {
  create(competitor: Competitor): void;
  findById(id: string): Competitor | undefined;
  list(): Competitor[];
}

export interface SourceRepository {
  create(source: Source): void;
  findById(id: string): Source | undefined;
  listByCompetitor(competitorId: string): Source[];
}
