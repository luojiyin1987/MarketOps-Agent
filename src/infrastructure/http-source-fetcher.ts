import type { SourceFetcher } from "../application/capture-source-snapshot.js";
import type { Source } from "../domain/index.js";

const DEFAULT_TIMEOUT_MS = 15_000;

function isTextualContentType(contentType: string): boolean {
  return (
    contentType === "" ||
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("xml")
  );
}

export class HttpSourceFetcher implements SourceFetcher {
  constructor(private readonly timeoutMs = DEFAULT_TIMEOUT_MS) {}

  async fetch(source: Source): Promise<string> {
    const response = await fetch(source.url, {
      redirect: "follow",
      headers: {
        "user-agent": "MarketOps-Agent/0.1",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${source.url}: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!isTextualContentType(contentType)) {
      throw new Error(`Unsupported content type for ${source.url}: ${contentType}`);
    }

    return response.text();
  }
}
