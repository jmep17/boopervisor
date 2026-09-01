import {
  MasterDetail,
  type MasterDetailItem,
} from "@/components/items/master-detail";
import { ItemStateControls } from "@/components/items/item-state-controls";
import { itemState, whyDisabled } from "@/lib/items";
import {
  readProjectScopeMcpServers,
  readUserScopeMcpServers,
} from "@/lib/config/mcp-servers";
import {
  resolveEffectiveSettings,
  type SettingsLocation,
} from "@/lib/config/settings";
import { getSelectedScope } from "@/lib/scope/server";
import { SCOPE_LABELS } from "@/components/settings/scope-labels";
import { changeItemState } from "@/lib/items/actions";

/**
 * The MCP servers the selected scope sees: `~/.claude.json`'s `mcpServers` for the user
 * scope, a project's `.mcp.json` for a project. Their configuration is shown as it is on
 * disk and never written; only their state changes.
 */
export async function McpServerList({
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

  const configurations =
    projectRoot === undefined
      ? await readUserScopeMcpServers()
      : await readProjectScopeMcpServers(projectRoot);
  const resolution = await resolveEffectiveSettings(location);

  const servers = await Promise.all(
    Object.entries(configurations).map(async ([name, configuration]) => ({
      name,
      configuration,
      state: await itemState("mcp", name, scope, resolution, projectRoot),
      disabledBy: whyDisabled("mcp", name, scope, resolution),
    }))
  );

  const items: MasterDetailItem[] = servers.map((server) => ({
    id: server.name,
    label: server.name,
    state: server.state,
  }));
  const server = servers.find((candidate) => candidate.name === selectedId);

  return (
    <MasterDetail
      items={items}
      selectedId={selectedId}
      showArchived={showArchived}
      empty={
        projectRoot
          ? "This project's .mcp.json lists no servers."
          : "~/.claude.json lists no MCP servers."
      }
    >
      {server ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-gray-1000">
              {server.name}
            </h2>
            <p className="font-mono text-xs text-gray-900">
              {projectRoot ? `${projectRoot}/.mcp.json` : "~/.claude.json"}
            </p>
          </div>

          <ItemStateControls
            state={server.state}
            action={changeItemState}
            fields={{ type: "mcp", name: server.name }}
            lockedReason={
              // A server denied higher up cannot be re-enabled from the scope being edited.
              server.disabledBy && server.disabledBy !== scope
                ? `${SCOPE_LABELS[server.disabledBy]} settings disable this server, and win over ${SCOPE_LABELS[scope].toLowerCase()} settings.`
                : undefined
            }
          />

          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-gray-1000">
              Configuration
            </h3>
            <pre className="overflow-x-auto rounded-base border border-gray-alpha-400 bg-background-200 p-3 font-mono text-sm text-gray-1000">
              {JSON.stringify(server.configuration, null, 2)}
            </pre>
            <p className="text-sm text-gray-900">
              Boopervisor manages this server&apos;s state, not its
              configuration. Edit the file to change what it runs.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-900">Select a server.</p>
      )}
    </MasterDetail>
  );
}
