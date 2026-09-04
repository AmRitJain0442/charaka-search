import { describe, expect, it } from "vitest";
import { localQueryPlan, searchCorpus } from "@/lib/search";
import { displayReference } from "@/lib/sanskrit";

describe("Charaka retrieval", () => {
  it("retrieves the health and four goals verse from everyday English", () => {
    const results = searchCorpus(localQueryPlan("health is the foundation of the four goals of life"));
    expect(results[0]?.id).toBe("Ca.1.1.15");
    expect(results[0]?.devanagari).toContain("धर्मार्थकाममोक्षाणामारोग्यं मूलमुत्तमम्");
  });

  it("retrieves a remembered Devanagari fragment", () => {
    const results = searchCorpus(localQueryPlan("आरोग्यं मूलम्"));
    expect(results.some((result) => result.id === "Ca.1.1.15")).toBe(true);
  });

  it("resolves an exact canonical citation", () => {
    const results = searchCorpus(localQueryPlan("Ca.1.1.15"));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("Ca.1.1.15");
  });

  it("formats references in Devanagari", () => {
    expect(displayReference(1, 1, "15")).toBe("चरकसंहिता · सूत्रस्थान १/१५");
  });
});
