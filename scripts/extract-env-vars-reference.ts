/**
 * Extracts Claude Code's environment variable reference into the catalog.
 *
 * Companion to extract-settings-reference.ts and extract-hooks-reference.ts: run by hand,
 * output reviewed and committed. The `env` editor offers these names and shows each
 * variable's documented purpose.
 *
 *   bun run scripts/extract-env-vars-reference.ts
 */

const SOURCE = "https://code.claude.com/docs/en/env-vars.md";
const DOC_URL = "https://code.claude.com/docs/en/env-vars#variables";
const OUT = new URL("../src/lib/catalog/env-vars.data.json", import.meta.url)
  .pathname;

const md = await fetch(SOURCE).then((response) => {
  if (!response.ok) throw new Error(`${SOURCE} returned ${response.status}`);
  return response.text();
});

/** Strip markdown links down to their label, keep inline code, and collapse whitespace. */
const plain = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const lines = md.split("\n");
const start = lines.findIndex((line) => /^## Variables\s*$/.test(line));
if (start === -1) throw new Error("could not find the 'Variables' section");
const end = lines.findIndex(
  (line, index) => index > start && /^## /.test(line)
);
const section = lines.slice(start + 1, end === -1 ? undefined : end);

const presenceOnlyNames = new Set<string>();
const variables: {
  name: string;
  purpose: string;
  presenceOnly: boolean;
  docUrl: string;
}[] = [];
let firstTableRow = false;
for (const line of section) {
  const row = line.match(/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|(.*)\|\s*$/);
  if (row) {
    firstTableRow = true;
    const [, name, cell] = row;
    variables.push({
      name,
      purpose: plain(cell),
      presenceOnly: presenceOnlyNames.has(name),
      docUrl: DOC_URL,
    });
    continue;
  }
  if (!firstTableRow) {
    const presenceOnly = line.match(/^\s*\* `([A-Z][A-Z0-9_]*)`\s*$/);
    if (presenceOnly) presenceOnlyNames.add(presenceOnly[1]);
  }
}

// Presence-only names appear in the note before the table, so update any rows after parsing.
for (const variable of variables)
  variable.presenceOnly = presenceOnlyNames.has(variable.name);

variables.sort((a, b) => a.name.localeCompare(b.name));
await Bun.write(
  OUT,
  JSON.stringify(
    {
      source: SOURCE,
      extractedAt: new Date().toISOString().slice(0, 10),
      variables,
    },
    null,
    2
  ) + "\n"
);

const counts = new Map<string, number>();
for (const variable of variables)
  counts.set(variable.name, (counts.get(variable.name) ?? 0) + 1);
const duplicates = [...counts]
  .filter(([, count]) => count > 1)
  .map(([name]) => name);
const noPurpose = variables
  .filter((variable) => !variable.purpose)
  .map((variable) => variable.name);
console.log(`variables: ${variables.length}`);
console.log(
  `presence-only: ${variables.filter((variable) => variable.presenceOnly).length}`
);
console.log(`no purpose: ${noPurpose.length ? noPurpose.join(", ") : "none"}`);
console.log(
  `duplicates: ${duplicates.length ? duplicates.join(", ") : "none"}`
);
console.log(`wrote ${OUT}`);
