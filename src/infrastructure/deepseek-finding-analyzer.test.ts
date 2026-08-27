import { describe, expect, it } from "vitest";
import type { Change, Competitor, Source } from "../domain/index.js";
import { DeepSeekFindingAnalyzer } from "./deepseek-finding-analyzer.js";

const competitor: Competitor = {
  id: "competitor-1",
  name: "Example AI",
  website: "https://example.com",
  createdAt: new Date("2026-08-27T12:00:00.000Z"),
};

const source: Source = {
  id: "source-1",
  competitorId: competitor.id,
  type: "pricing",
  url: "https://example.com/pricing",
  createdAt: new Date("2026-08-27T12:01:00.000Z"),
};

const change: Change = {
  id: "change-1",
  sourceId: source.id,
  previousSnapshotId: "snapshot-1",
  currentSnapshotId: "snapshot-2",
  diff: "@@ -1,1 +1,1 @@\n-price: 59\n+price: 49",
  detectedAt: new Date("2026-08-27T12:04:00.000Z"),
};

function deepSeekResponse(content: string | null, finishReason = "stop"): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: { content },
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("DeepSeekFindingAnalyzer", () => {
  it("requests JSON output and validates a relevant finding", async () => {
    let requestBody: Record<string, unknown> | undefined;
    let authorization: string | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      authorization = new Headers(init?.headers).get("authorization");
      return deepSeekResponse(
        JSON.stringify({
          relevant: true,
          type: "pricing_change",
          severity: "high",
          summary: "The Pro plan price decreased from $59 to $49.",
          impact: "This may increase pricing pressure.",
          confidence: 0.95,
        }),
      );
    };
    const analyzer = new DeepSeekFindingAnalyzer({ apiKey: "test-key", fetchImpl });

    const result = await analyzer.analyze({ competitor, source, change });

    expect(result).toMatchObject({
      relevant: true,
      type: "pricing_change",
      severity: "high",
      confidence: 0.95,
    });
    expect(authorization).toBe("Bearer test-key");
    expect(requestBody).toMatchObject({
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 800,
    });
    expect(JSON.stringify(requestBody)).toContain("untrusted evidence");
  });

  it("rejects empty JSON content", async () => {
    const analyzer = new DeepSeekFindingAnalyzer({
      apiKey: "test-key",
      fetchImpl: async () => deepSeekResponse(""),
    });

    await expect(analyzer.analyze({ competitor, source, change })).rejects.toThrow(
      "DeepSeek API returned empty JSON content",
    );
  });

  it("rejects JSON that violates the finding schema", async () => {
    const analyzer = new DeepSeekFindingAnalyzer({
      apiKey: "test-key",
      fetchImpl: async () =>
        deepSeekResponse(
          JSON.stringify({
            relevant: true,
            type: "pricing_change",
            severity: "urgent",
            summary: "Changed",
            impact: "Impact",
            confidence: 2,
          }),
        ),
    });

    await expect(analyzer.analyze({ competitor, source, change })).rejects.toThrow(
      "DeepSeek returned JSON that does not match the finding schema",
    );
  });

  it("rejects truncated output and HTTP failures", async () => {
    const truncated = new DeepSeekFindingAnalyzer({
      apiKey: "test-key",
      fetchImpl: async () => deepSeekResponse("{}", "length"),
    });
    await expect(truncated.analyze({ competitor, source, change })).rejects.toThrow(
      "DeepSeek JSON output was truncated",
    );

    const failed = new DeepSeekFindingAnalyzer({
      apiKey: "test-key",
      fetchImpl: async () => new Response("rate limited", { status: 429 }),
    });
    await expect(failed.analyze({ competitor, source, change })).rejects.toThrow(
      "DeepSeek API request failed with status 429",
    );
  });
});
