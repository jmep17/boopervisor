import {
  getSetting,
  settingsByTopic,
  type OptionSource,
  type Scope,
} from "@/lib/catalog";
import { resolveOptionSource } from "@/lib/config/option-sources";
import { editingScopeFor, type ProjectFile } from "@/lib/config/editing-scope";
import { encodeExpectedFile } from "@/lib/config/mutate";
import { snapshotScope } from "@/lib/config/mutate-setting";
import {
  resolveEffectiveSettings,
  resolveKey,
  scopesFor,
  type SettingsLocation,
} from "@/lib/config/settings";
import { getSelectedScope } from "@/lib/scope/server";
import {
  FilterableSettings,
  type FilterableRow,
  type FilterableTopic,
} from "./filterable-settings";
import { SCOPE_LABELS } from "./scope-labels";
import { SettingRow } from "./setting-row";

const FILE_STATES: Record<string, string> = {
  ok: "read",
  missing: "not present",
  empty: "empty",
  "invalid-json": "not valid JSON, left untouched",
};

/**
 * Every catalogued key with its effective value and per-scope breakdown, grouped by the
 * catalog's topics, followed by whatever the files hold that the catalog does not describe.
 */
export async function SettingsList({
  file,
  initialQuery,
}: {
  file: ProjectFile;
  initialQuery: string;
}) {
  const selected = await getSelectedScope();
  const location: SettingsLocation = {
    projectRoot: selected.kind === "project" ? selected.path : undefined,
  };
  // A project has two files; the page's `file` parameter chooses which one is edited. The
  // user scope has only its own file.
  const editing: Scope = editingScopeFor(selected, file);

  const { fileStatuses, parsed } = await resolveEffectiveSettings(location);
  const scopes = scopesFor(location);
  const expected = encodeExpectedFile(await snapshotScope(editing, location));

  const options = await resolveOptions();

  const catalogued = new Set<string>();
  const topics = settingsByTopic().map((topic) => ({
    topic: topic.topic,
    settings: topic.settings.map((definition) => {
      catalogued.add(definition.key);
      return {
        definition,
        effective: resolveKey(definition.key, scopes, parsed),
      };
    }),
  }));

  const uncatalogued = [
    ...new Set(scopes.flatMap((scope) => Object.keys(parsed[scope] ?? {}))),
  ]
    .filter((key) => !getSetting(key))
    .sort()
    .map((key) => resolveKey(key, scopes, parsed));

  const filterableTopics: FilterableTopic[] = topics.map((topic) => ({
    topic: topic.topic,
    rows: topic.settings.map(({ definition, effective }): FilterableRow => ({
      key: definition.key,
      summary: definition.summary,
      node: (
        <SettingRow
          key={definition.key}
          definition={definition}
          effective={effective}
          editing={editing}
          expected={expected}
          options={options}
          readOnly={"managed" in effective.perScope}
        />
      ),
    })),
  }));

  const filterableUncatalogued: FilterableRow[] = uncatalogued.map(
    (effective): FilterableRow => ({
      key: effective.key,
      node: (
        <SettingRow
          key={effective.key}
          effective={effective}
          editing={editing}
          expected={expected}
          options={options}
          readOnly={"managed" in effective.perScope}
        />
      ),
    })
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-1000">Settings files</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {fileStatuses.map((status) => (
            <li
              key={status.path}
              className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="min-w-0 text-gray-900">
                {SCOPE_LABELS[status.scope]}
                <span className="ml-2 break-all font-mono text-gray-900">
                  {status.path}
                </span>
              </span>
              <span className="shrink-0 text-gray-900">
                {FILE_STATES[status.state]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <FilterableSettings
        topics={filterableTopics}
        uncatalogued={filterableUncatalogued}
        initialQuery={initialQuery}
        file={selected.kind === "project" ? file : undefined}
      />
    </div>
  );
}

/**
 * The machine-local option lists, read once per render rather than once per control. A
 * source that yields nothing leaves its controls on the catalog's suggestions.
 */
async function resolveOptions(): Promise<
  Partial<Record<OptionSource, string[]>>
> {
  const sources: OptionSource[] = ["models", "outputStyles", "themes"];
  const resolved = await Promise.all(
    sources.map((source) => resolveOptionSource(source))
  );
  return Object.fromEntries(
    sources.map((source, index) => [source, resolved[index]])
  );
}
