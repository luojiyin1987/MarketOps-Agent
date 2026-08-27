import type { Change, Competitor, Finding, Snapshot, Source } from "../domain/index.js";

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

export interface SnapshotRepository {
  create(snapshot: Snapshot): void;
  findLatestBySource(sourceId: string): Snapshot | undefined;
  listBySource(sourceId: string): Snapshot[];
}

export interface ChangeRepository {
  create(change: Change): void;
  findById(id: string): Change | undefined;
  findByCurrentSnapshotId(currentSnapshotId: string): Change | undefined;
  listBySource(sourceId: string): Change[];
}

export interface FindingRepository {
  create(finding: Finding): void;
  findByChangeId(changeId: string): Finding | undefined;
  listByCompetitor(competitorId: string): Finding[];
}
