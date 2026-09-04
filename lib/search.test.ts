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

  it("retrieves the three-principles verse from a Devanagari fragment", () => {
    const results = searchCorpus(localQueryPlan("हेतुलिङ्गौषधज्ञानं स्वस्थातुरपरायणम्"));
    expect(results[0]?.id).toBe("Ca.1.1.24");
  });

  it("expands the everyday English word sweat to Sanskrit passages", () => {
    const plan = localQueryPlan("sweat");
    const results = searchCorpus(plan);

    expect(plan.terms).toEqual(["sveda"]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.devanagari).toContain("स्वेद");
  });

  it.each([
    ["hunger", "क्षुध"],
    ["stool", "पुरीष"],
    ["thirst", "पिपास"],
    ["constipation", "बद्धपुरीष"],
  ])("expands the everyday body-function query %s", (query, expectedText) => {
    const results = searchCorpus(localQueryPlan(query));
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.devanagari.includes(expectedText))).toBe(true);
  });

  it("tolerates a minor Romanized Sanskrit misspelling", () => {
    const results = searchCorpus(localQueryPlan("arogyaa mulam"));
    expect(results[0]?.id).toBe("Ca.1.1.15");
  });

  it("keeps modifiers as concept groups and labels incomplete combinations", () => {
    const plan = localQueryPlan("light hunger with smelly sweat");
    const results = searchCorpus(plan);

    expect(plan.groups.map((group) => group.label)).toEqual(["light hunger", "smelly sweat"]);
    expect(results.some((result) => result.id === "Ca.1.24.15")).toBe(true);
    expect(results.every((result) => result.conceptCoverage < 1)).toBe(true);
    expect(results.find((result) => result.id === "Ca.1.24.15")?.devanagari)
      .toContain("तन्द्रानिद्रातियोगश्च तमसश्चातिदर्शनम्");
  });

  it("resolves an exact canonical citation", () => {
    const results = searchCorpus(localQueryPlan("Ca.1.1.15"));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("Ca.1.1.15");
  });

  it("resolves Devanagari-numbered citations", () => {
    const results = searchCorpus(localQueryPlan("सूत्रस्थान १/१५"));
    expect(results[0]?.id).toBe("Ca.1.1.15");
  });

  it("formats references in Devanagari", () => {
    expect(displayReference(1, 1, "15")).toBe("चरकसंहिता · सूत्रस्थान १/१५");
  });
});
