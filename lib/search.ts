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

function cueText(value: string): string {
  return ` ${value.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim()} `;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function localQueryPlan(query: string): QueryPlan {
  const searchableQuery = cueText(query);
  const terms: string[] = [];
  const concepts: string[] = [];
  const matches = CONCEPTS.flatMap((entry) => entry.cues
    .filter((cue) => cue && searchableQuery.includes(cueText(cue)))
    .map((cue) => ({ entry, cue: cueText(cue) })));
  const mostSpecificMatches = matches.filter((match) => !matches.some((other) => (
    other.cue.length > match.cue.length && other.cue.includes(match.cue)
  )));

  for (const { entry } of mostSpecificMatches) {
    if (entry) {
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
  grams: string[];
}

interface IndexedPassage {
  passage: CorpusPassage;
  tokens: string[];
  length: number;
}

const verseIndex: IndexedPassage[] = corpus.passages
  .filter((passage) => passage.kind === "verse")
  .map((passage) => {
    const tokens = passage.search.split(" ").filter(Boolean);
    return { passage, tokens, length: tokens.length };
  });

const averageVerseLength = verseIndex.reduce((sum, entry) => sum + entry.length, 0) / Math.max(verseIndex.length, 1);

function prepareTerm(raw: string): RankedTerm | undefined {
  const normalized = normalizeRoman(raw);
  const packed = compact(raw);
  if (!normalized || packed.length < 2) return undefined;
  const grams = packed.length >= 5
    ? [...new Set(Array.from({ length: packed.length - 2 }, (_, index) => packed.slice(index, index + 3)))]
    : [];
  return { raw, normalized, packed, grams };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (needle && (offset = haystack.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function termFrequency(entry: IndexedPassage, term: RankedTerm): number {
  const phraseCount = countOccurrences(entry.passage.search, term.normalized);
  if (term.normalized.includes(" ") && phraseCount) return phraseCount * 1.8;

  const exactCount = entry.tokens.filter((token) => token === term.normalized).length;
  if (exactCount) return exactCount * 1.5;

  // Do not let a positive concept match a simple Sanskrit privative form such
  // as bubhukṣā (appetite) inside abubhukṣā (loss of appetite).
  const eligibleTokens = entry.tokens.filter((token) => (
    !token.startsWith(`a${term.packed}`) && !token.startsWith(`an${term.packed}`)
  ));
  const compoundCount = eligibleTokens.reduce((count, token) => count + countOccurrences(token, term.packed), 0);
  if (compoundCount) return compoundCount * 0.9;

  if (term.grams.length) {
    const overlap = term.grams.filter((gram) => eligibleTokens.some((token) => token.includes(gram))).length / term.grams.length;
    if (overlap >= 0.8) return overlap * 0.35;
  }

  return 0;
}

function citationFilter(query: string): { sthana?: number; chapter?: number; verse?: string } {
  const roman = normalizeRoman(query);
  const latinDigits = query.replace(/[०-९]/g, (digit) => String("०१२३४५६७८९".indexOf(digit)));
  let sthana: number | undefined;
  for (let index = 1; index < STHANA_IAST.length; index += 1) {
    const name = normalizeRoman(STHANA_IAST[index]);
    if (roman.includes(name.replace("sthana", "")) || roman.includes(name)) sthana = index;
  }

  const canonical = latinDigits.match(/(?:Ca\.)?(\d+)\.(\d+)\.(\d+(?:\.\d+)?)/i);
  if (canonical) return { sthana: Number(canonical[1]), chapter: Number(canonical[2]), verse: canonical[3] };

  const slash = latinDigits.match(/(\d+)\s*[/:]\s*(\d+(?:\.\d+)?)/);
  if (slash) return { sthana, chapter: Number(slash[1]), verse: slash[2] };
  return { sthana };
}

function scorePassage(
  entry: IndexedPassage,
  terms: RankedTerm[],
  documentFrequencies: number[],
  candidateCount: number,
  queryPhrase: string,
): SearchResult | undefined {
  let score = 0;
  const matchedTerms: string[] = [];

  for (const [index, term] of terms.entries()) {
    const frequency = termFrequency(entry, term);
    if (!frequency) continue;

    // BM25 rewards rare terms while normalizing long passages. Sanskrit compounds
    // are handled by the weighted substring frequency above.
    const documentFrequency = documentFrequencies[index];
    const inverseDocumentFrequency = Math.log(1 + (candidateCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const k1 = 1.35;
    const b = 0.72;
    const lengthNormalization = k1 * (1 - b + b * (entry.length / averageVerseLength));
    score += inverseDocumentFrequency * ((frequency * (k1 + 1)) / (frequency + lengthNormalization));
    matchedTerms.push(term.raw);
  }

  if (!matchedTerms.length) return undefined;
  const coverage = matchedTerms.length / Math.max(terms.length, 1);
  score += coverage * 3 + Math.max(0, matchedTerms.length - 1) * 0.75;
  if (queryPhrase.length >= 5 && entry.passage.search.includes(queryPhrase)) score += 8;

  return { ...entry.passage, score: Number(score.toFixed(3)), matchedTerms: unique(matchedTerms) };
}

export function searchCorpus(plan: QueryPlan, limit = 8): SearchResult[] {
  const citation = citationFilter(plan.original);
  const exactCitation = citation.chapter !== undefined && citation.verse !== undefined;
  const candidates = verseIndex.filter((entry) => {
    if (citation.sthana && entry.passage.sthana !== citation.sthana) return false;
    if (exactCitation && entry.passage.chapter !== citation.chapter) return false;
    if (exactCitation && !entry.passage.verse.split("–").includes(citation.verse!)) return false;
    return true;
  });

  if (exactCitation && candidates.length) {
    return candidates.slice(0, limit).map(({ passage }) => ({ ...passage, score: 100, matchedTerms: [passage.id] }));
  }

  const terms = plan.terms.map(prepareTerm).filter((term): term is RankedTerm => Boolean(term));
  if (!terms.length) return [];

  const documentFrequencies = terms.map((term) => candidates.reduce(
    (count, entry) => count + (termFrequency(entry, term) > 0 ? 1 : 0),
    0,
  ));
  const queryPhrase = normalizeRoman(plan.original);

  return candidates
    .map((entry) => scorePassage(entry, terms, documentFrequencies, candidates.length, queryPhrase))
    .filter((result): result is SearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function corpusStats() {
  return corpus.stats;
}
