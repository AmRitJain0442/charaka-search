import fs from "node:fs";
import path from "node:path";
import Sanscript from "@indic-transliteration/sanscript";
import { XMLParser } from "fast-xml-parser";
import type { CorpusFile, CorpusPassage } from "../lib/types";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "data", "source", "carakasamhita.xml");
const OUTPUT_PATH = path.join(ROOT, "data", "corpus.json");
const SOURCE_REVISION = "1b819c4763a20e0270aba3d0e7f3cae55b37cee6";

type XmlNode = Record<string, unknown>;

function list<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function tidy(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/\s+([/।॥])/g, " $1")
    .replace(/\+|&/g, "")
    .trim();
}

function directText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const record = node as XmlNode;
  const parts: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (key === "label" || key === "note" || key === "xml:id" || key === "n") continue;
    if (key === "#text") parts.push(String(value));
    else if (["hi", "q", "seg", "foreign", "supplied", "choice", "sic", "corr"].includes(key)) {
      for (const child of list(value)) parts.push(directText(child));
    }
  }
  return tidy(parts.join(" "));
}

function sourceId(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const raw = (node as XmlNode)["xml:id"];
  return typeof raw === "string" ? raw.trim() : undefined;
}

function sourceParts(id: string): { sthana: number; chapter: number; verse: string } | undefined {
  const match = id.trim().match(/^Ca\.(\d+)\.(\d+)\.(.+?)\s*$/);
  if (!match) return undefined;
  return {
    sthana: Number(match[1]),
    chapter: Number(match[2]),
    verse: match[3].replace(/(?:ab|cd|ef|[a-f])$/i, "").trim(),
  };
}

function devanagari(iast: string): string {
  const prepared = iast
    .replace(/\s*\/\/\s*/g, " ॥ ")
    .replace(/\s*\/\s*/g, " । ")
    .replace(/\s+'a/g, " ’a")
    .replace(/\+/g, "");
  return tidy(Sanscript.t(prepared, "iast", "devanagari"))
    .replace(/’अ/g, "ऽ")
    .replace(/\|\|/g, "॥")
    .replace(/\|/g, "।");
}

function normalizedSearch(iast: string, deva: string): string {
  const ascii = iast
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  void deva;
  return ascii.replace(/\s+/g, " ").trim();
}

function makePassage(nodes: unknown[], kind: "verse" | "prose"): CorpusPassage | undefined {
  const usable = nodes
    .map((node) => ({ id: sourceId(node), text: directText(node) }))
    .filter((item): item is { id: string; text: string } => Boolean(item.id && item.text));
  if (!usable.length) return undefined;

  const parsed = usable.map((item) => sourceParts(item.id)).filter(Boolean);
  const first = parsed[0];
  if (!first) return undefined;

  const verseValues = [...new Set(parsed.map((item) => item!.verse))];
  const verse = verseValues.length === 1 ? verseValues[0] : `${verseValues[0]}–${verseValues.at(-1)}`;
  const id = `Ca.${first.sthana}.${first.chapter}.${verse}`;
  const iast = tidy(usable.map((item) => item.text).join(" "));
  const deva = devanagari(iast);

  return {
    id,
    sourceIds: usable.map((item) => item.id),
    sthana: first.sthana,
    chapter: first.chapter,
    verse,
    kind,
    iast,
    devanagari: deva,
    search: normalizedSearch(iast, deva),
  };
}

function collect(node: unknown, passages: CorpusPassage[]): void {
  if (!node || typeof node !== "object") return;
  const record = node as XmlNode;

  for (const group of list(record.lg)) {
    if (!group || typeof group !== "object") continue;
    const lines = list((group as XmlNode).l);
    const passage = makePassage(lines, "verse");
    if (passage) passages.push(passage);
  }

  for (const paragraph of list(record.p)) {
    const passage = makePassage([paragraph], "prose");
    if (passage) passages.push(passage);
  }

  for (const child of list(record.div)) collect(child, passages);
}

if (!fs.existsSync(SOURCE_PATH)) {
  throw new Error(`Missing ${SOURCE_PATH}. Download the pinned SARIT source before building.`);
}

const xml = fs.readFileSync(SOURCE_PATH, "utf8");
const parsed = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  trimValues: true,
}).parse(xml) as XmlNode;

const passages: CorpusPassage[] = [];
const body = (((parsed.TEI as XmlNode).text as XmlNode).body as XmlNode);
collect(body, passages);

passages.sort((a, b) => {
  if (a.sthana !== b.sthana) return a.sthana - b.sthana;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return Number.parseFloat(a.verse) - Number.parseFloat(b.verse);
});

const corpus: CorpusFile = {
  source: {
    title: "Carakasaṃhitā — A SARIT edition",
    edition: "Yādavaśarman Trivikramātmaja Ācārya, 1941",
    url: `https://github.com/sarit/SARIT-corpus/blob/${SOURCE_REVISION}/carakasamhita.xml`,
    revision: SOURCE_REVISION,
    license: "CC BY-SA 3.0",
  },
  stats: {
    passages: passages.length,
    verses: passages.filter((item) => item.kind === "verse").length,
    prose: passages.filter((item) => item.kind === "prose").length,
  },
  passages,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(corpus)}\n`, "utf8");
console.log(`Built ${passages.length} passages (${corpus.stats.verses} verse, ${corpus.stats.prose} prose).`);
