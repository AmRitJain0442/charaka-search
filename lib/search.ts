import corpusJson from "@/data/corpus.json";
import { CONCEPTS } from "@/lib/concepts";
import { compact, normalizeRoman, STHANA_IAST } from "@/lib/sanskrit";
import type { CorpusFile, CorpusPassage, SearchResult } from "@/lib/types";

const corpus = corpusJson as CorpusFile;

export interface QueryPlan {
  original: string;
  terms: string[];
  concepts: string[];
  usedAi: boolean;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function localQueryPlan(query: string): QueryPlan {
  const lower = query.toLowerCase();
  const terms: string[] = [];
  const concepts: string[] = [];

  for (const entry of CONCEPTS) {
    const matches = entry.cues.some((cue) => cue && lower.includes(cue.toLowerCase()));
    if (matches) {
      terms.push(...entry.terms);
      concepts.push(entry.cues[0]);
    }
  }

  const roman = normalizeRoman(query);
  const looksSanskrit = /[āīūṛṝḷṅñṭḍṇśṣṃṁḥ]|[\u0900-\u097f]/i.test(query);
  if (looksSanskrit) terms.push(...roman.split(" ").filter((term) => term.length > 2));

  // Preserve substantial Roman tokens. This supports common spellings such as
  // "arogya", "vata", and remembered fragments without treating stopwords as Sanskrit.
  const stopwords = new Set(["about", "which", "where", "what", "when", "does", "says", "shloka", "verse", "charaka", "find", "show", "tell", "with", "that", "this", "from", "should", "according"]);
  if (looksSanskrit || concepts.length === 0) {
    for (const token of roman.split(" ")) {
      if (token.length >= 4 && !stopwords.has(token)) terms.push(token);
    }
  }

  return { original: query, terms: unique(terms), concepts: unique(concepts), usedAi: false };
}

interface RankedTerm {
  raw: string;
  normalized: string;
  packed: string;
  wordPattern: RegExp;
  grams: string[];
}

function prepareTerm(raw: string): RankedTerm | undefined {
  const normalized = normalizeRoman(raw);
  const packed = compact(raw);
  if (!normalized || packed.length < 2) return undefined;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const grams = packed.length >= 5
    ? [...new Set(Array.from({ length: packed.length - 2 }, (_, index) => packed.slice(index, index + 3)))]
    : [];
  return { raw, normalized, packed, wordPattern: new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`), grams };
}

function citationFilter(query: string): { sthana?: number; chapter?: number; verse?: string } {
  const roman = normalizeRoman(query);
  let sthana: number | undefined;
  for (let index = 1; index < STHANA_IAST.length; index += 1) {
    const name = normalizeRoman(STHANA_IAST[index]);
    if (roman.includes(name.replace("sthana", "")) || roman.includes(name)) sthana = index;
  }

  const canonical = query.match(/(?:Ca\.)?(\d+)\.(\d+)\.(\d+(?:\.\d+)?)/i);
  if (canonical) return { sthana: Number(canonical[1]), chapter: Number(canonical[2]), verse: canonical[3] };

  const slash = query.match(/(\d+)\s*[/:]\s*(\d+(?:\.\d+)?)/);
  if (slash) return { sthana, chapter: Number(slash[1]), verse: slash[2] };
  return { sthana };
}

function scorePassage(passage: CorpusPassage, terms: RankedTerm[], totalTerms: number): SearchResult | undefined {
  const haystackRoman = passage.search;
  const haystackCompact = haystackRoman.replace(/\s+/g, "");
  let score = 0;
  const matchedTerms: string[] = [];

  for (const term of terms) {
    if (term.wordPattern.test(haystackRoman)) {
      score += 18 + Math.min(term.normalized.length, 12);
      matchedTerms.push(term.raw);
      continue;
    }
    if (haystackCompact.includes(term.packed)) {
      score += 10 + Math.min(term.packed.length / 2, 8);
      matchedTerms.push(term.raw);
      continue;
    }
    if (term.grams.length) {
      const overlap = term.grams.filter((gram) => haystackCompact.includes(gram)).length / term.grams.length;
      if (overlap >= 0.8) {
        score += overlap * 4;
        matchedTerms.push(term.raw);
      }
    }
  }

  if (!matchedTerms.length) return undefined;
  const coverage = matchedTerms.length / Math.max(totalTerms, 1);
  score += coverage * 28 + Math.max(0, matchedTerms.length - 1) * 12;
  if (passage.kind === "verse") score += 2;

  return { ...passage, score: Number(score.toFixed(3)), matchedTerms: unique(matchedTerms) };
}

export function searchCorpus(plan: QueryPlan, limit = 8): SearchResult[] {
  const citation = citationFilter(plan.original);
  const exactCitation = citation.chapter !== undefined && citation.verse !== undefined;
  const candidates = corpus.passages.filter((passage) => {
    if (passage.kind !== "verse") return false;
    if (citation.sthana && passage.sthana !== citation.sthana) return false;
    if (exactCitation && passage.chapter !== citation.chapter) return false;
    if (exactCitation && !passage.verse.split("–").includes(citation.verse!)) return false;
    return true;
  });

  if (exactCitation && candidates.length) {
    return candidates.slice(0, limit).map((passage) => ({ ...passage, score: 100, matchedTerms: [passage.id] }));
  }

  const terms = plan.terms.map(prepareTerm).filter((term): term is RankedTerm => Boolean(term));
  return candidates
    .map((passage) => scorePassage(passage, terms, terms.length))
    .filter((result): result is SearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function corpusStats() {
  return corpus.stats;
}
