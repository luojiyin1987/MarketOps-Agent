import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  FindingSchema,
  FindingTypeSchema,
  SeveritySchema,
  type Change,
  type Competitor,
  type Finding,
  type Source,
} from "../domain/index.js";
import type {
  ChangeRepository,
  CompetitorRepository,
  FindingRepository,
  SourceRepository,
} from "./repositories.js";

export const FindingAnalysisSchema = z.discriminatedUnion("relevant", [
  z.object({
    relevant: z.literal(true),
    type: FindingTypeSchema,
    severity: SeveritySchema,
    summary: z.string().min(1),
    impact: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    relevant: z.literal(false),
    reason: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
]);

export type FindingAnalysis = z.infer<typeof FindingAnalysisSchema>;

export interface FindingAnalysisInput {
  competitor: Competitor;
  source: Source;
  change: Change;
}

export interface FindingAnalyzer {
  analyze(input: FindingAnalysisInput): Promise<FindingAnalysis>;
}

interface AnalyzeChangeDependencies {
  changeRepository: ChangeRepository;
  sourceRepository: SourceRepository;
  competitorRepository: CompetitorRepository;
  findingRepository: FindingRepository;
  analyzer: FindingAnalyzer;
  createId?: () => string;
  now?: () => Date;
}

export type AnalyzeChangeResult =
  | { status: "created"; finding: Finding }
  | { status: "existing"; finding: Finding }
  | { status: "irrelevant"; analysis: Extract<FindingAnalysis, { relevant: false }> };

export async function analyzeChange(
  changeId: string,
  dependencies: AnalyzeChangeDependencies,
): Promise<AnalyzeChangeResult> {
  const existing = dependencies.findingRepository.findByChangeId(changeId);
  if (existing !== undefined) {
    return { status: "existing", finding: existing };
  }

  const change = dependencies.changeRepository.findById(changeId);
  if (change === undefined) {
    throw new Error(`Unknown change: ${changeId}`);
  }

  const source = dependencies.sourceRepository.findById(change.sourceId);
  if (source === undefined) {
    throw new Error(`Missing source for change: ${change.id}`);
  }

  const competitor = dependencies.competitorRepository.findById(source.competitorId);
  if (competitor === undefined) {
    throw new Error(`Missing competitor for source: ${source.id}`);
  }

  const analysis = FindingAnalysisSchema.parse(
    await dependencies.analyzer.analyze({ competitor, source, change }),
  );

  if (!analysis.relevant) {
    return { status: "irrelevant", analysis };
  }

  const finding = FindingSchema.parse({
    id: dependencies.createId?.() ?? randomUUID(),
    competitorId: competitor.id,
    changeId: change.id,
    type: analysis.type,
    severity: analysis.severity,
    summary: analysis.summary,
    impact: analysis.impact,
    confidence: analysis.confidence,
    createdAt: dependencies.now?.() ?? new Date(),
  });

  dependencies.findingRepository.create(finding);
  return { status: "created", finding };
}
