import Sanscript from "@indic-transliteration/sanscript";

export const STHANA_NAMES = [
  "",
  "सूत्रस्थान",
  "निदानस्थान",
  "विमानस्थान",
  "शारीरस्थान",
  "इन्द्रियस्थान",
  "चिकित्सास्थान",
  "कल्पस्थान",
  "सिद्धिस्थान",
] as const;

export const STHANA_IAST = [
  "",
  "sūtrasthāna",
  "nidānasthāna",
  "vimānasthāna",
  "śārīrasthāna",
  "indriyasthāna",
  "cikitsāsthāna",
  "kalpasthāna",
  "siddhisthāna",
] as const;

export function toIast(value: string): string {
  if (!/[\u0900-\u097f]/.test(value)) return value;
  return Sanscript.t(value, "devanagari", "iast");
}

export function toDevanagariDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => "०१२३४५६७८९"[Number(digit)]);
}

export function displayReference(sthana: number, chapter: number, verse: string): string {
  return `चरकसंहिता · ${STHANA_NAMES[sthana]} ${toDevanagariDigits(chapter)}/${toDevanagariDigits(verse)}`;
}

export function normalizeRoman(value: string): string {
  return toIast(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ś|ṣ/g, "s")
    .replace(/ṅ|ñ|ṇ|ṃ|ṁ/g, "n")
    .replace(/ṭ/g, "t")
    .replace(/ḍ/g, "d")
    .replace(/ḥ/g, "h")
    .replace(/ṛ/g, "r")
    .replace(/ḷ/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function compact(value: string): string {
  return normalizeRoman(value).replace(/\s+/g, "");
}
