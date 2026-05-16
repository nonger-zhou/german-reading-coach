/** Grammar Analysis v2：整文分析与 enrich 共用的 grammar_type 枚举 */

export const GRAMMAR_TYPE_VALUES = [
  "hauptsatz_v2",
  "nebensatz",
  "relativsatz",
  "infinitiv_um_zu",
  "infinitiv_zu",
  "praepositionalphrase",
  "temporalangabe",
  "modalverb",
  "satzklammer",
  "verb_praeposition",
  "passiv",
  "perfekt",
  "praeteritum",
  "konjunktiv_i",
  "konjunktiv_ii",
  "adjektivdeklination",
  "nominalisierung",
  "partizipialkonstruktion",
  "other",
] as const;

export type GrammarType = (typeof GRAMMAR_TYPE_VALUES)[number];

const GRAMMAR_TYPE_SET = new Set<string>(GRAMMAR_TYPE_VALUES);

export function parseGrammarType(raw: unknown): GrammarType {
  if (typeof raw !== "string") return "other";
  const k = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return GRAMMAR_TYPE_SET.has(k) ? (k as GrammarType) : "other";
}

export const FINITE_VERB_POSITION_VALUES = [
  "second",
  "final",
  "first",
  "none",
  "unknown",
] as const;

export type FiniteVerbPosition = (typeof FINITE_VERB_POSITION_VALUES)[number];

export function parseFiniteVerbPosition(raw: unknown): FiniteVerbPosition {
  if (typeof raw !== "string") return "unknown";
  const k = raw.trim().toLowerCase();
  return (FINITE_VERB_POSITION_VALUES as readonly string[]).includes(k)
    ? (k as FiniteVerbPosition)
    : "unknown";
}

export function parseIsSubordinateClause(raw: unknown): boolean {
  return raw === true;
}
