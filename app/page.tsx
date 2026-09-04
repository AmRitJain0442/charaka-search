"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Check, Copy, CornerDownLeft, Search, Sparkles } from "lucide-react";
import { displayReference, toDevanagariDigits } from "@/lib/sanskrit";
import type { SearchResult } from "@/lib/types";

interface SearchResponse {
  query: string;
  plan: { usedAi: boolean };
  results: SearchResult[];
  error?: string;
}

const examples = [
  "health is the foundation of the four goals of life",
  "What are the three principles of Ayurveda?",
  "हेतुलिङ्गौषधज्ञानं स्वस्थातुरपरायणम्",
  "Ca.1.1.15",
];

function ResultCard({ result, index }: { result: SearchResult; index: number }) {
  const [copied, setCopied] = useState(false);

  async function copyPassage() {
    await navigator.clipboard.writeText(`${result.devanagari}\n— ${displayReference(result.sthana, result.chapter, result.verse)}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className={`result-card ${index === 0 ? "result-card--primary" : ""}`}>
      <div className="result-index" aria-hidden="true">{toDevanagariDigits(index + 1)}</div>
      <div className="result-content">
        <div className="result-meta">
          <span>{result.kind === "verse" ? "श्लोक" : "गद्य"}</span>
          <span className="meta-rule" />
          <span>{displayReference(result.sthana, result.chapter, result.verse)}</span>
        </div>
        <p className="devanagari-passage">{result.devanagari}</p>
        <div className="result-footer">
          <span className="canonical-id">{result.id}</span>
          <button className="copy-button" type="button" onClick={copyPassage} aria-label="Copy Sanskrit passage">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "प्रतिलिपितम्" : "प्रतिलिपिः"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usedAi, setUsedAi] = useState(false);
  const [searchRun, setSearchRun] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);

  useEffect(() => {
    if (searchRun === 0) return;

    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchRun]);

  async function search(queryOverride?: string) {
    const nextQuery = (queryOverride ?? query).trim();
    if (nextQuery.length < 2) return;
    setQuery(nextQuery);
    setSubmittedQuery(nextQuery);
    setLoading(true);
    setError("");
    setSearchRun((run) => run + 1);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: nextQuery }),
      });
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(payload.error ?? "Search failed.");
      setResults(payload.results);
      setUsedAi(payload.plan.usedAi);
    } catch (cause) {
      setResults([]);
      setError(cause instanceof Error ? cause.message : "The search could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void search();
  }

  return (
    <main className={submittedQuery || loading ? "search-active" : undefined}>
      <div className="paper-noise" aria-hidden="true" />
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Charaka home">
          <span className="wordmark-seal">च</span>
          <span>
            <strong>चरक</strong>
            <small>SAṂHITĀ SEARCH</small>
          </span>
        </a>
        <a className="source-link" href="https://github.com/sarit/SARIT-corpus" target="_blank" rel="noreferrer">
          SARIT EDITION <ArrowUpRight size={14} />
        </a>
      </header>

      <section className="hero" id="top">
        <aside className="hero-aside">
          <span className="vertical-label">आयुर्वेदः अमृतानाम्</span>
          <div className="catalogue-note">
            <BookOpen size={18} strokeWidth={1.5} />
            <p><strong>९,३२४</strong> canonical passages<br />across all eight sthānas.</p>
          </div>
        </aside>

        <div className="hero-main">
          <div className="eyebrow"><span /> ASK NATURALLY · READ THE ORIGINAL</div>
          <h1>Find the remembered<br /><em>śloka.</em></h1>
          <p className="hero-copy">
            Describe an idea in English, Hindi, Sanskrit, or the fragment you remember.
            The answer returns from the original text—in Devanāgarī.
          </p>

          <form className="search-form" onSubmit={submit}>
            <label htmlFor="query">What do you remember?</label>
            <div className="search-field">
              <Search size={22} strokeWidth={1.6} aria-hidden="true" />
              <textarea
                ref={inputRef}
                id="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void search();
                  }
                }}
                placeholder="e.g. Which verse says health is the root of life's four aims?"
                rows={2}
                maxLength={400}
              />
              <button type="submit" disabled={loading || query.trim().length < 2}>
                {loading ? <span className="loading-mark" /> : <CornerDownLeft size={18} />}
                <span>{loading ? "Seeking" : "Seek"}</span>
              </button>
            </div>
            <div className="search-hints">
              <span>Try a thought</span>
              <div>
                {examples.map((example, index) => (
                  <button key={example} type="button" onClick={() => void search(example)}>
                    {index + 1 < 4 ? `0${index + 1}` : "REF"}
                  </button>
                ))}
              </div>
              <span className="keyboard-hint"><kbd>/</kbd> to focus</span>
            </div>
          </form>

          <div className="example-ledger">
            {examples.slice(0, 3).map((example, index) => (
              <button type="button" key={example} onClick={() => void search(example)}>
                <span>0{index + 1}</span>
                <p>{example}</p>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="hero-mark" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span>चरक</span>
        </div>
      </section>

      {(submittedQuery || loading) && (
        <section ref={resultsRef} className="results-section" aria-live="polite">
          <form className="results-search" onSubmit={submit}>
            <div className="results-search-label">
              <span className="live-dot" />
              <span>पुनः अन्वेषणम्</span>
            </div>
            <Search size={18} strokeWidth={1.7} aria-hidden="true" />
            <input
              aria-label="Search again"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask another question…"
              maxLength={400}
            />
            <button type="submit" disabled={loading || query.trim().length < 2}>
              {loading ? <span className="loading-mark" /> : <CornerDownLeft size={17} />}
              <span>{loading ? "Seeking" : "Search again"}</span>
            </button>
          </form>

          <div className="results-heading">
            <div>
              <span className="section-number">॥ परिणामाः ॥</span>
              <h2>{loading ? "Searching the text…" : results.length ? "Passages found" : "No passage found"}</h2>
            </div>
            {!loading && results.length > 0 && (
              <div className="retrieval-note">
                {usedAi && <Sparkles size={14} />}
                {usedAi ? "AI-expanded · hybrid BM25 ranking" : "Sanskrit-aware · hybrid BM25 ranking"}
              </div>
            )}
          </div>

          <p className="query-echo">“{submittedQuery}”</p>

          {error && <div className="error-message">{error}</div>}
          {loading ? (
            <div className="result-skeletons"><div /><div /><div /></div>
          ) : (
            <div className="results-list">
              {results.map((result, index) => <ResultCard key={`${result.id}-${index}`} result={result} index={index} />)}
              {!results.length && !error && (
                <div className="empty-result">
                  Try a Sanskrit term, a more specific description, or a citation such as <code>Ca.1.1.15</code>.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <footer>
        <div><span>च</span> Rooted in the canonical text.</div>
        <p>SARIT TEI edition · CC BY-SA 3.0</p>
      </footer>
    </main>
  );
}
