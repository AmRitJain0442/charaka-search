import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { localQueryPlan, searchCorpus, type QueryPlan } from "@/lib/search";

export const runtime = "nodejs";
export const maxDuration = 20;

const requestSchema = z.object({ query: z.string().trim().min(2).max(400) });
const aiPlanSchema = z.object({
  sanskrit_terms: z.array(z.string()).min(1).max(12),
  concepts: z.array(z.string()).max(8).default([]),
});

async function interpretWithAi(query: string, fallback: QueryPlan): Promise<QueryPlan> {
  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) return fallback;

  try {
    const { text } = await generateText({
      model: "google/gemini-2.5-flash-lite",
      maxOutputTokens: 240,
      temperature: 0,
      prompt: `You are a Sanskrit information-retrieval query interpreter for the Carakasaṃhitā.
Convert the user's everyday English, Hindi, or Romanized request into Sanskrit lexical anchors that are likely to literally occur in the requested passage.
Return ONLY compact JSON with this shape: {"sanskrit_terms":["IAST term"],"concepts":["short English concept"]}.
Use canonical IAST. Include distinctive words, synonyms, and all items in a remembered list. Do not answer the question and do not invent a verse.
User query: ${JSON.stringify(query)}`,
    });
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = aiPlanSchema.parse(JSON.parse(json));
    return {
      original: query,
      terms: [...new Set([...parsed.sanskrit_terms, ...fallback.terms])],
      concepts: [...new Set([...parsed.concepts, ...fallback.concepts])],
      usedAi: true,
    };
  } catch (error) {
    console.error("AI query interpretation failed; using local expansion", error);
    return fallback;
  }
}

export async function POST(request: Request) {
  const payload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Enter a question of at least two characters." }, { status: 400 });
  }

  const fallback = localQueryPlan(payload.data.query);
  const plan = await interpretWithAi(payload.data.query, fallback);
  const results = searchCorpus(plan, 8);

  return NextResponse.json({ query: payload.data.query, plan, results });
}
