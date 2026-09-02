/**
 * Splits on Markdown code spans and wraps the odd segments in `<code>`.
 * Catalog descriptions use code spans and nothing fancier.
 */
export function withCodeSpans(text: string) {
  return text.split("`").map((segment, i) =>
    i % 2 === 1 ? (
      <code key={i} className="font-mono">
        {segment}
      </code>
    ) : (
      segment
    )
  );
}
