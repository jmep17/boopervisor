import {
  MasterDetail,
  type MasterDetailItem,
} from "@/components/items/master-detail";
import { ItemStateControls } from "@/components/items/item-state-controls";
import { itemState, whyDisabled } from "@/lib/items";
import { readInstalledPlugins } from "@/lib/plugins/read";
import { captureFileSnapshot, encodeExpectedFile } from "@/lib/config/mutate";
import {
  resolveEffectiveSettings,
  settingFilePath,
  type SettingsLocation,
} from "@/lib/config/settings";
import { archivedItemsPath } from "@/lib/items/item-state";
import { getSelectedScope } from "@/lib/scope/server";
import { SCOPE_LABELS } from "@/components/settings/scope-labels";
import { changeItemState } from "@/lib/items/actions";

/**
 * Every installed plugin and the marketplace it came from. A plugin is installed once and
 * then enabled or disabled per scope, so the listing is the same whichever scope is
 * selected — only where a state change is written differs. `plugin.json` is shown as it is
 * on disk and never written.
 */
export async function PluginList({
  selectedId,
  showArchived,
}: {
  selectedId?: string;
  showArchived: boolean;
}) {
  const selected = await getSelectedScope();
  const projectRoot = selected.kind === "project" ? selected.path : undefined;
  const location: SettingsLocation = { projectRoot };
  const scope = selected.kind === "project" ? "project" : "user";

  // Plugins are installed once; the selected scope decides only where a state change lands.
  const configurations = await readInstalledPlugins();

  const resolution = await resolveEffectiveSettings(location);

  const expectedSettings = encodeExpectedFile(
    await captureFileSnapshot(settingFilePath(scope, location))
  );
  const expectedArchive = encodeExpectedFile(
    await captureFileSnapshot(archivedItemsPath())
  );

  const plugins = await Promise.all(
    Object.entries(configurations).map(async ([id, plugin]) => ({
      id,
      plugin,
      state: await itemState("plugin", id, scope, resolution, projectRoot),
      disabledBy: whyDisabled("plugin", id, scope, resolution),
    }))
  );

  const items: MasterDetailItem[] = plugins.map((plugin) => ({
    id: plugin.id,
    label: plugin.plugin.name,
    detail: plugin.plugin.marketplace,
    state: plugin.state,
  }));

  const plugin = plugins.find((candidate) => candidate.id === selectedId);

  return (
    <MasterDetail
      items={items}
      selectedId={selectedId}
      showArchived={showArchived}
      empty="No plugins are installed."
    >
      {plugin ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-gray-1000">
              {plugin.plugin.name}
            </h2>
            <p className="text-sm text-gray-900">{plugin.plugin.marketplace}</p>
            <p className="font-mono text-xs text-gray-900">
              {plugin.plugin.manifestPath ??
                `${plugin.plugin.path}/plugin.json`}
            </p>
          </div>

          <ItemStateControls
            state={plugin.state}
            action={changeItemState}
            fields={{
              type: "plugin",
              name: plugin.id,
              expectedSettings,
              expectedArchive,
            }}
            lockedReason={
              plugin.disabledBy && plugin.disabledBy !== scope
                ? `${SCOPE_LABELS[plugin.disabledBy]} settings disable this plugin, and win over ${SCOPE_LABELS[scope].toLowerCase()} settings.`
                : undefined
            }
          />

          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-gray-1000">Metadata</h3>
            <pre className="overflow-x-auto rounded-base border border-gray-alpha-400 bg-background-200 p-3 font-mono text-sm text-gray-1000">
              {plugin.plugin.metadata
                ? JSON.stringify(plugin.plugin.metadata, null, 2)
                : "plugin.json could not be read."}
            </pre>
            <p className="text-sm text-gray-900">
              Boopervisor manages this plugin&apos;s state, not its
              configuration. Edit the plugin.json file or uninstall and
              reinstall the plugin to change its configuration.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-900">Select a plugin.</p>
      )}
    </MasterDetail>
  );
}
