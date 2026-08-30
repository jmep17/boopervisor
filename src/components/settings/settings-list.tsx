import { Badge } from "@/components/ui/badge";
import {
  getSetting,
  settingsByTopic,
  type OptionSource,
  type Scope,
} from "@/lib/catalog";
import { resolveOptionSource } from "@/lib/config/option-sources";
import { encodeExpectedFile } from "@/lib/config/mutate";
import { snapshotScope } from "@/lib/config/mutate-setting";
import {
  resolveEffectiveSettings,
  resolveKey,
  scopesFor,
  type SettingsLocation,
} from "@/lib/config/settings";
import { getSelectedScope } from "@/lib/scope/server";
import { SCOPE_LABELS } from "./scope-labels";
import { SettingRow } from "./setting-row";

const FILE_STATES: Record<string, string> = {
  ok: "read",
  missing: "not present",
  empty: "empty",
  "invalid-json": "not valid JSON — left untouched",
};

/**
 * Every catalogued key with its effective value and per-scope breakdown, grouped by the
 * catalog's topics, followed by whatever the files hold that the catalog does not describe.
 */
export async function SettingsList() {
  const selected = await getSelectedScope();
  const location: SettingsLocation = {
    projectRoot: selected.kind === "project" ? selected.path : undefined,
  };
  // A project's own settings are the ones worth editing; the user scope is the fallback.
  const editing: Scope = selected.kind === "project" ? "project" : "user";

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

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-1000">Settings files</h2>
        <ul className="flex flex-col gap-1 text-xs">
          {fileStatuses.map((status) => (
            <li
              key={status.path}
              className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="min-w-0 text-gray-900">
                {SCOPE_LABELS[status.scope]}
                <span className="ml-2 break-all font-mono text-gray-800">
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

      {topics.map((topic) => (
        <section key={topic.topic} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-1000">{topic.topic}</h2>
          <div className="flex flex-col gap-2">
            {topic.settings.map(({ definition, effective }) => (
              <SettingRow
                key={definition.key}
                definition={definition}
                effective={effective}
                editing={editing}
                expected={expected}
                options={options}
                readOnly={"managed" in effective.perScope}
              />
            ))}
          </div>
        </section>
      ))}

      {uncatalogued.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-gray-1000">
            Uncatalogued
            <Badge tone="warning">{uncatalogued.length}</Badge>
          </h2>
          <p className="max-w-prose text-xs text-gray-900">
            Keys these files hold that the catalog does not describe.
            Boopervisor preserves them exactly as it found them.
          </p>
          <div className="flex flex-col gap-2">
            {uncatalogued.map((effective) => (
              <SettingRow
                key={effective.key}
                effective={effective}
                editing={editing}
                expected={expected}
                options={options}
                readOnly={"managed" in effective.perScope}
              />
            ))}
          </div>
        </section>
      ) : null}
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
