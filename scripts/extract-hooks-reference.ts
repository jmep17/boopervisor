/**
 * Extracts the hook event list from Claude Code's published hooks documentation.
 *
 * Companion to extract-settings-reference.ts: run by hand, output reviewed and committed.
 * The hooks editor needs the closed set of event names, which the settings reference does
 * not carry.
 *
 *   bun run scripts/extract-hooks-reference.ts
 */

const SOURCE = "https://code.claude.com/docs/en/hooks.md";
const OUT = new URL("../src/lib/catalog/hooks.data.json", import.meta.url).pathname;

const md = await fetch(SOURCE).then((r) => {
  if (!r.ok) throw new Error(`${SOURCE} returned ${r.status}`);
  return r.text();
});

const plain = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();

const lines = md.split("\n");

// Event sections are the `###` headings under the `## Hook events` heading.
const start = lines.findIndex((l) => /^## Hook events\s*$/.test(l));
if (start === -1) throw new Error("could not find the 'Hook events' section");
const end = lines.findIndex((l, i) => i > start && /^## /.test(l));

const events: { event: string; summary: string; docUrl: string }[] = [];
let current: { event: string; summary: string } | null = null;

for (const line of lines.slice(start + 1, end === -1 ? undefined : end)) {
  const heading = line.match(/^### `?([A-Za-z]+)`?\s*$/);
  if (heading) {
    if (current) events.push({ ...current, docUrl: docUrl(current.event) });
    current = { event: heading[1], summary: "" };
    continue;
  }
  if (current && !current.summary && line.trim() && !line.startsWith("#")) {
    current.summary = plain(line);
  }
}
if (current) events.push({ ...current, docUrl: docUrl(current.event) });

function docUrl(event: string) {
  return `https://code.claude.com/docs/en/hooks#${event.toLowerCase()}`;
}

await Bun.write(
  OUT,
  JSON.stringify(
    { source: SOURCE, extractedAt: new Date().toISOString().slice(0, 10), events },
    null,
    2,
  ) + "\n",
);

console.log(`events: ${events.length}`);
const noSummary = events.filter((e) => !e.summary).map((e) => e.event);
console.log(`no summary: ${noSummary.length ? noSummary.join(", ") : "none"}`);
console.log(events.map((e) => e.event).join(", "));
console.log(`wrote ${OUT}`);
