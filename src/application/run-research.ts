import { randomUUID } from "node:crypto";
import { ResearchRunSchema, type ResearchRun } from "../domain/index.js";
import { analyzeChange, type FindingAnalyzer } from "./analyze-change.js";
import { captureSourceSnapshot, type SourceFetcher } from "./capture-source-snapshot.js";
import { detectSourceChanges } from "./detect-source-changes.js";
import type {
  ChangeAnalysisRepository,
  ChangeRepository,
  CompetitorRepository,
  FindingRepository,
  ResearchRunRepository,
  SnapshotRepository,
  SourceRepository,
} from "./repositories.js";

export interface ResearchRunFailure {
  sourceId: string;
  message: string;
}

export interface RunResearchResult {
  run: ResearchRun;
  snapshotsCreated: number;
  snapshotsUnchanged: number;
  changesCreated: number;
  findingsCreated: number;
  findingsExisting: number;
  irrelevant: number;
  failures: ResearchRunFailure[];
}

interface RunResearchDependencies {
  competitorRepository: CompetitorRepository;
  sourceRepository: SourceRepository;
  snapshotRepository: SnapshotRepository;
  changeRepository: ChangeRepository;
  findingRepository: FindingRepository;
  changeAnalysisRepository: ChangeAnalysisRepository;
  researchRunRepository: ResearchRunRepository;
  fetcher: SourceFetcher;
  analyzer: FindingAnalyzer;
  createRunId?: () => string;
  now?: () => Date;
}

export async function runResearch(
  competitorId: string,
  dependencies: RunResearchDependencies,
): Promise<RunResearchResult> {
  const competitor = dependencies.competitorRepository.findById(competitorId);
  if (competitor === undefined) {
    throw new Error(`Unknown competitor: ${competitorId}`);
  }

  const now = dependencies.now ?? (() => new Date());
  const createdAt = now();
  let run = ResearchRunSchema.parse({
    id: dependencies.createRunId?.() ?? randomUUID(),
    competitorId: competitor.id,
    status: "pending",
    startedAt: null,
    completedAt: null,
    createdAt,
  });
  dependencies.researchRunRepository.create(run);

  run = ResearchRunSchema.parse({ ...run, status: "running", startedAt: now() });
  dependencies.researchRunRepository.update(run);

  let snapshotsCreated = 0;
  let snapshotsUnchanged = 0;
  let changesCreated = 0;
  let findingsCreated = 0;
  let findingsExisting = 0;
  let irrelevant = 0;
  const failures: ResearchRunFailure[] = [];
  const sources = dependencies.sourceRepository.listByCompetitor(competitor.id);

  for (const source of sources) {
    try {
      const capture = await captureSourceSnapshot(source.id, {
        sourceRepository: dependencies.sourceRepository,
        snapshotRepository: dependencies.snapshotRepository,
        fetcher: dependencies.fetcher,
      });
      if (capture.status === "created") snapshotsCreated += 1;
      else snapshotsUnchanged += 1;

      const detected = detectSourceChanges(source.id, {
        sourceRepository: dependencies.sourceRepository,
        snapshotRepository: dependencies.snapshotRepository,
        changeRepository: dependencies.changeRepository,
      });
      changesCreated += detected.created.length;

      const changes = [...detected.created, ...detected.existing];
      for (const change of changes) {
        const analyzed = await analyzeChange(change.id, {
          changeRepository: dependencies.changeRepository,
          sourceRepository: dependencies.sourceRepository,
          competitorRepository: dependencies.competitorRepository,
          findingRepository: dependencies.findingRepository,
          changeAnalysisRepository: dependencies.changeAnalysisRepository,
          analyzer: dependencies.analyzer,
        });

        if (analyzed.status === "created") findingsCreated += 1;
        else if (analyzed.status === "existing") findingsExisting += 1;
        else irrelevant += 1;
      }
    } catch (error) {
      failures.push({
        sourceId: source.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const status =
    failures.length === 0
      ? "succeeded"
      : sources.length > 0 && failures.length === sources.length
        ? "failed"
        : "partial";

  run = ResearchRunSchema.parse({ ...run, status, completedAt: now() });
  dependencies.researchRunRepository.update(run);

  return {
    run,
    snapshotsCreated,
    snapshotsUnchanged,
    changesCreated,
    findingsCreated,
    findingsExisting,
    irrelevant,
    failures,
  };
}
