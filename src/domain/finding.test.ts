import { describe, expect, it } from "vitest";

import { FindingSchema } from "./finding.js";

describe("FindingSchema", () => {
  it("accepts a typed finding with bounded confidence", () => {
    const finding = FindingSchema.parse({
      id: "finding-1",
      competitorId: "competitor-1",
      changeId: "change-1",
      type: "pricing_change",
      severity: "high",
      summary: "The Pro plan price decreased.",
      impact: "The change may increase pricing pressure.",
      confidence: 0.92,
      createdAt: new Date("2026-08-27T00:00:00Z"),
    });

    expect(finding.confidence).toBe(0.92);
  });

  it("rejects confidence values outside 0..1", () => {
    const result = FindingSchema.safeParse({
      id: "finding-1",
      competitorId: "competitor-1",
      changeId: "change-1",
      type: "pricing_change",
      severity: "high",
      summary: "The Pro plan price decreased.",
      impact: "The change may increase pricing pressure.",
      confidence: 1.2,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });
});
