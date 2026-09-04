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

const queryCache = new Map<string, QueryPlan>();
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now >= current.resetAt) {
    requestWindows.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 20;
}

async function interpretWithAi(query: string, fallback: QueryPlan): Promise<QueryPlan> {
  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) return fallback;

  const cacheKey = query.toLocaleLowerCase().trim();
  const cached = queryCache.get(cacheKey);
  if (cached) return cached;

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
    const plan = {
      original: query,
      terms: [...new Set([...parsed.sanskrit_terms, ...fallback.terms])],
      concepts: [...new Set([...parsed.concepts, ...fallback.concepts])],
      usedAi: true,
    };
    if (queryCache.size >= 256) queryCache.delete(queryCache.keys().next().value ?? "");
    queryCache.set(cacheKey, plan);
    return plan;
  } catch (error) {
    console.error("AI query interpretation failed; using local expansion", error);
    return fallback;
  }
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many searches. Please try again in a minute." }, { status: 429 });
  }
  const payload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Enter a question of at least two characters." }, { status: 400 });
  }

  const fallback = localQueryPlan(payload.data.query);
  const plan = await interpretWithAi(payload.data.query, fallback);
  const results = searchCorpus(plan, 8);

  return NextResponse.json({ query: payload.data.query, plan, results });
}
