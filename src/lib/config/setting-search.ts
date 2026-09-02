/** What a query is matched against. Summary and topic are absent for an uncatalogued key. */
export interface SearchableSetting {
  key: string;
  summary?: string;
  topic?: string;
}

/** Lower-cased, whitespace-split terms; an empty query has no terms and matches everything. */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== "");
}

/**
 * True when every term appears somewhere in the key, summary or topic. Case does not
 * matter; a term may span a dot in the key (`defaultmode` finds `permissions.defaultMode`).
 */
export function matchesQuery(
  setting: SearchableSetting,
  terms: string[]
): boolean {
  if (terms.length === 0) return true;
  const haystack = [setting.key, setting.summary ?? "", setting.topic ?? ""]
    .join("\n")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
