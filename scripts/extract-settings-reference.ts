/**
 * Extracts the settings catalog from Claude Code's published settings reference.
 *
 * This is the research pass described in ADR 0003, not a build step. It runs by hand,
 * writes src/lib/catalog/settings.data.json, and that file is reviewed and committed.
 * Nothing at runtime depends on this script or on network access.
 *
 *   bun run scripts/extract-settings-reference.ts
 */

const SOURCE = "https://code.claude.com/docs/en/settings-reference.md";
const OUT = new URL("../src/lib/catalog/settings.data.json", import.meta.url).pathname;

type RawEntry = {
  key: string;
  anchor: string;
  topic: string;
  summary: string;
  indexScope: string;
  scopeText?: string;
  typeText?: string;
  defaultText?: string;
  typeBullets: string[];
  perSessionOverrides?: string;
};

const md = await fetch(SOURCE).then((r) => {
  if (!r.ok) throw new Error(`${SOURCE} returned ${r.status}`);
  return r.text();
});

/** Strip markdown links down to their label, and inline code fences. */
const plain = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// 1. The "All settings" index table: key, description, topic, scope.
// ---------------------------------------------------------------------------

const index = new Map<string, { anchor: string; topic: string; summary: string; scope: string }>();

for (const line of md.split("\n")) {
  const row = line.match(/^\|\s*\[`([^`]+)`\]\(#([^)]+)\)\s*\|(.*)\|(.*)\|(.*)\|\s*$/);
  if (!row) continue;
  const [, key, anchor, summary, topic, scope] = row;
  index.set(key, {
    anchor,
    summary: plain(summary),
    topic: plain(topic),
    scope: plain(scope),
  });
}

// ---------------------------------------------------------------------------
// 2. Per-key sections: Scope / Type / Default bullets and their sub-bullets.
// ---------------------------------------------------------------------------

const lines = md.split("\n");
const entries: RawEntry[] = [];

let topic = "";
let current: RawEntry | null = null;
let bullet: "type" | null = null;

const flush = () => {
  if (current) entries.push(current);
  current = null;
  bullet = null;
};

for (const line of lines) {
  const h2 = line.match(/^## (.+)$/);
  if (h2) {
    flush();
    topic = h2[1].trim();
    continue;
  }

  const h3 = line.match(/^### `([^`]+)`/);
  if (h3) {
    flush();
    const key = h3[1];
    const meta = index.get(key);
    current = {
      key,
      anchor: meta?.anchor ?? key.toLowerCase().replace(/\./g, "-"),
      topic: meta?.topic ?? topic,
      summary: meta?.summary ?? "",
      indexScope: meta?.scope ?? "",
      typeBullets: [],
    };
    continue;
  }

  // A #### sub-heading ends the bullet list we might be inside.
  if (/^#### /.test(line)) {
    bullet = null;
    continue;
  }
  if (!current) continue;

  const top = line.match(/^\* \*\*([^*]+)\*\*:?\s*(.*)$/);
  if (top) {
    const [, label, rest] = top;
    const value = plain(rest);
    bullet = null;
    switch (label.trim()) {
      case "Scope":
        current.scopeText = value;
        break;
      case "Type":
        current.typeText = value;
        bullet = "type";
        break;
      case "Default":
        current.defaultText = value;
        break;
      case "Per-session overrides":
        current.perSessionOverrides = value;
        break;
    }
    continue;
  }

  // Nested sub-bullets under Type carry the enumerated values.
  const sub = line.match(/^\s{2,}\* (.+)$/);
  if (sub && bullet === "type") {
    current.typeBullets.push(plain(sub[1]));
    continue;
  }
  if (line.trim() === "") continue;
  if (!/^\s/.test(line)) bullet = null;
}
flush();

// ---------------------------------------------------------------------------
// 3. Derive the machine-readable bits: scopes, value type, enumerated values.
// ---------------------------------------------------------------------------

/** The index table's scope phrases, mapped onto the files a key may appear in. */
const SCOPES: Record<string, string[]> = {
  "Any file": ["user", "project", "local", "managed"],
  "User, local, or managed": ["user", "local", "managed"],
  "User or managed": ["user", "managed"],
  "User only": ["user"],
  Managed: ["managed"],
  "Global config": ["globalConfig"],
};

const scopesFor = (entry: RawEntry): string[] => {
  const phrase = (entry.scopeText ?? entry.indexScope).replace(/`/g, "").trim();
  for (const [name, scopes] of Object.entries(SCOPES)) {
    if (phrase === name || phrase.startsWith(name)) return scopes;
  }
  return [];
};

/** Quoted string literals in the Type line and its sub-bullets are the allowed values. */
const enumValuesFor = (entry: RawEntry): string[] => {
  const values: string[] = [];
  const collect = (text: string) => {
    for (const m of text.matchAll(/`"([^"]+)"`/g)) values.push(m[1]);
  };
  if (entry.typeText) collect(entry.typeText);
  for (const b of entry.typeBullets) collect(b);
  return [...new Set(values)];
};

const valueTypeFor = (entry: RawEntry): string => {
  const t = (entry.typeText ?? "").toLowerCase();
  if (/^boolean/.test(t)) return "boolean";
  if (/^(number|integer)/.test(t)) return "number";
  if (/^array/.test(t) || /^list/.test(t)) return "array";
  if (/^object/.test(t) || /^map/.test(t) || /^record/.test(t)) return "object";
  if (/^string/.test(t)) return "string";
  return "unknown";
};

const catalog = entries.map((entry) => {
  const enumValues = enumValuesFor(entry);
  const valueType = valueTypeFor(entry);
  return {
    key: entry.key,
    topic: entry.topic,
    summary: entry.summary,
    scopes: scopesFor(entry),
    valueType,
    // Only a scalar string key with quoted literals is a genuine dropdown; a boolean's
    // sub-bullets and an array's element examples are not enumerated values.
    enumValues: valueType === "string" && enumValues.length > 1 ? enumValues : [],
    typeText: entry.typeText ?? "",
    defaultText: entry.defaultText ?? "",
    perSessionOverrides: entry.perSessionOverrides ?? "",
    docUrl: `https://code.claude.com/docs/en/settings-reference#${entry.anchor}`,
  };
});

catalog.sort((a, b) => a.key.localeCompare(b.key));

await Bun.write(
  OUT,
  JSON.stringify(
    { source: SOURCE, extractedAt: new Date().toISOString().slice(0, 10), settings: catalog },
    null,
    2,
  ) + "\n",
);

// ---------------------------------------------------------------------------
// 4. Report what needs a human eye.
// ---------------------------------------------------------------------------

const indexOnly = [...index.keys()].filter((k) => !catalog.some((c) => c.key === k));
const sectionOnly = catalog.filter((c) => !index.has(c.key)).map((c) => c.key);
const noScope = catalog.filter((c) => c.scopes.length === 0).map((c) => c.key);
const unknownType = catalog.filter((c) => c.valueType === "unknown").map((c) => c.key);

console.log(`index rows:      ${index.size}`);
console.log(`key sections:    ${catalog.length}`);
console.log(`with enum:       ${catalog.filter((c) => c.enumValues.length).length}`);
console.log(`in index only:   ${indexOnly.length ? indexOnly.join(", ") : "none"}`);
console.log(`in section only: ${sectionOnly.length ? sectionOnly.join(", ") : "none"}`);
console.log(`no scope:        ${noScope.length ? noScope.join(", ") : "none"}`);
console.log(`unknown type:    ${unknownType.length ? unknownType.join(", ") : "none"}`);
console.log(`wrote ${OUT}`);
