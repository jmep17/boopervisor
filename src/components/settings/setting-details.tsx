import type { SettingDefinition } from "@/lib/catalog";

/**
 * Splits on Markdown code spans (`` `like this` ``) and wraps the odd segments — the
 * text that was between backticks — in `<code>`. The catalog's extracted text uses code
 * spans and nothing fancier; anything else is shown raw.
 */
function withCodeSpans(text: string) {
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

/** The URL's fragment when it has one, else its path — what a reference link reads as. */
function shortLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hash ? parsed.hash.slice(1) : parsed.pathname.slice(1);
  } catch {
    return url;
  }
}

const hasPerSessionOverride = (definition: SettingDefinition) =>
  definition.perSessionOverrides !== "" &&
  definition.perSessionOverrides !== "—"; // design-tokens-allow: the reference's own placeholder

/** The reference's own words about a setting, which no settings file can tell the user. */
export function SettingDetails({
  definition,
}: {
  definition: SettingDefinition;
}) {
  return (
    <dl className="flex flex-col gap-1 text-sm">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <dt className="text-gray-900">Type</dt>
        <dd className="min-w-0 text-gray-1000">
          {withCodeSpans(definition.typeText)}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <dt className="text-gray-900">Default</dt>
        <dd className="min-w-0 text-gray-1000">
          {withCodeSpans(definition.defaultText)}
        </dd>
      </div>
      {hasPerSessionOverride(definition) ? (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <dt className="text-gray-900">For one session</dt>
          <dd className="min-w-0 text-gray-1000">
            The reference says: {withCodeSpans(definition.perSessionOverrides)}
          </dd>
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <dt className="text-gray-900">Reference</dt>
        <dd className="min-w-0 text-gray-1000">
          <a
            href={definition.docUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {shortLabel(definition.docUrl)}
          </a>
        </dd>
      </div>
    </dl>
  );
}
