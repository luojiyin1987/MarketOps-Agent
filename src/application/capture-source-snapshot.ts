import { createHash, randomUUID } from "node:crypto";
import { SnapshotSchema, type Snapshot, type Source } from "../domain/index.js";
import type { SnapshotRepository, SourceRepository } from "./repositories.js";

export interface SourceFetcher {
  fetch(source: Source): Promise<string>;
}

export type CaptureSourceSnapshotResult =
  | { status: "created"; snapshot: Snapshot }
  | { status: "unchanged"; snapshot: Snapshot };

type CaptureSourceSnapshotDependencies = {
  sourceRepository: SourceRepository;
  snapshotRepository: SnapshotRepository;
  fetcher: SourceFetcher;
  now?: () => Date;
  createId?: () => string;
};

export function normalizeSourceContent(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashSourceContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function captureSourceSnapshot(
  sourceId: string,
  dependencies: CaptureSourceSnapshotDependencies,
): Promise<CaptureSourceSnapshotResult> {
  const source = dependencies.sourceRepository.findById(sourceId);
  if (source === undefined) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const rawContent = await dependencies.fetcher.fetch(source);
  const content = normalizeSourceContent(rawContent);
  const contentHash = hashSourceContent(content);
  const latest = dependencies.snapshotRepository.findLatestBySource(source.id);

  if (latest?.contentHash === contentHash) {
    return { status: "unchanged", snapshot: latest };
  }

  const snapshot = SnapshotSchema.parse({
    id: (dependencies.createId ?? randomUUID)(),
    sourceId: source.id,
    content,
    contentHash,
    fetchedAt: (dependencies.now ?? (() => new Date()))(),
  });

  dependencies.snapshotRepository.create(snapshot);
  return { status: "created", snapshot };
}
