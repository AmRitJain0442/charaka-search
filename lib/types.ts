export type PassageKind = "verse" | "prose";

export interface CorpusPassage {
  id: string;
  sourceIds: string[];
  sthana: number;
  chapter: number;
  verse: string;
  kind: PassageKind;
  iast: string;
  devanagari: string;
  search: string;
}

export interface CorpusFile {
  source: {
    title: string;
    edition: string;
    url: string;
    revision: string;
    license: string;
  };
  stats: {
    passages: number;
    verses: number;
    prose: number;
  };
  passages: CorpusPassage[];
}

export interface SearchResult extends CorpusPassage {
  score: number;
  matchedTerms: string[];
  matchedConcepts: string[];
  conceptCoverage: number;
}
