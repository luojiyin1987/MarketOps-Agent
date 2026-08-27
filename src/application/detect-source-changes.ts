import { randomUUID } from "node:crypto";
import type {
  ChangeRepository,
  SnapshotRepository,
  SourceRepository,
} from "./repositories.js";
import { ChangeSchema, type Change } from "../domain/index.js";

export interface DetectSourceChangesDependencies {
  sourceRepository: SourceRepository;
  snapshotRepository: SnapshotRepository;
  changeRepository: ChangeRepository;
  createId?: () => string;
  now?: () => Date;
}

export interface DetectSourceChangesResult {
  created: Change[];
  existing: Change[];
  skippedUnchangedPairs: number;
}

function toLines(content: string): string[] {
  return content === "" ? [] : content.split("\n");
}

export function buildDeterministicDiff(previousContent: string, currentContent: string): string {
  if (previousContent === currentContent) return "";

  const previous = toLines(previousContent);
  const current = toLines(currentContent);

  let prefixLength = 0;
  while (
    prefixLength < previous.length &&
    prefixLength < current.length &&
    previous[prefixLength] === current[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previous.length - prefixLength &&
    suffixLength < current.length - prefixLength &&
    previous[previous.length - 1 - suffixLength] === current[current.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const previousEnd = previous.length - suffixLength;
  const currentEnd = current.length - suffixLength;
  const previousChanged = previous.slice(prefixLength, previousEnd);
  const currentChanged = current.slice(prefixLength, currentEnd);
  const startLine = prefixLength + 1;

  return [
    `@@ -${startLine},${previousChanged.length} +${startLine},${currentChanged.length} @@`,
    ...previousChanged.map((line) => `-${line}`),
    ...currentChanged.map((line) => `+${line}`),
  ].join("\n");
}

export function detectSourceChanges(
  sourceId: string,
  dependencies: DetectSourceChangesDependencies,
): DetectSourceChangesResult {
  const source = dependencies.sourceRepository.findById(sourceId);
  if (source === undefined) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const snapshots = dependencies.snapshotRepository.listBySource(source.id);
  const created: Change[] = [];
  const existing: Change[] = [];
  let skippedUnchangedPairs = 0;

  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    if (previous === undefined || current === undefined) continue;

    if (previous.contentHash === current.contentHash || previous.content === current.content) {
      skippedUnchangedPairs += 1;
      continue;
    }

    const existingChange = dependencies.changeRepository.findByCurrentSnapshotId(current.id);
    if (existingChange !== undefined) {
      existing.push(existingChange);
      continue;
    }

    const change = ChangeSchema.parse({
      id: dependencies.createId?.() ?? randomUUID(),
      sourceId: source.id,
      previousSnapshotId: previous.id,
      currentSnapshotId: current.id,
      diff: buildDeterministicDiff(previous.content, current.content),
      detectedAt: dependencies.now?.() ?? new Date(),
    });

    dependencies.changeRepository.create(change);
    created.push(change);
  }

  return { created, existing, skippedUnchangedPairs };
}
