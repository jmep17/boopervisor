import {
  MasterDetail,
  type MasterDetailItem,
} from "@/components/items/master-detail";
import { ItemStateControls } from "@/components/items/item-state-controls";
import { itemState, whyDisabled } from "@/lib/items";
import {
  listProjectMcpServers,
  readLocalScopeMcpServers,
  readMcpJsonApprovals,
  readProjectScopeMcpServers,
  readUserScopeMcpServers,
  type McpServer,
  type McpSource,
} from "@/lib/config/mcp-servers";
import {
  resolveEffectiveSettings,
  type SettingsLocation,
} from "@/lib/config/settings";
import { getSelectedScope } from "@/lib/scope/server";
import { SCOPE_LABELS } from "@/components/settings/scope-labels";
import { changeItemState } from "@/lib/items/actions";

interface McpServerRow {
  id: string;
  name: string;
  source: McpSource;
  file: string;
  configuration: McpServer;
  state: Awaited<ReturnType<typeof itemState>>;
  disabledBy: Awaited<ReturnType<typeof whyDisabled>>;
}

/**
 * The MCP servers the selected scope sees. The user scope sees `~/.claude.json`'s top-level
 * `mcpServers`; a project sees two sources: its `.mcp.json` (source "project") and its entry
 * under `~/.claude.json`'s `projects` map (source "local"), which is where `claude mcp add`
 * puts a server by default. Their configuration is shown as it is on disk and never written;
 * only their state changes.
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
  const resolution = await resolveEffectiveSettings(location);

  let rows: {
    id: string;
    name: string;
    source: McpSource;
    file: string;
    configuration: McpServer;
  }[];
  let approvals: { enabled: string[]; disabled: string[] } = {
    enabled: [],
    disabled: [],
  };

  if (projectRoot === undefined) {
    const configurations = await readUserScopeMcpServers();
    rows = Object.entries(configurations).map(([name, configuration]) => ({
      id: `user:${name}`,
      name,
      source: "user" as const,
      file: "~/.claude.json",
      configuration,
    }));
  } else {
    const [project, local, projectApprovals] = await Promise.all([
      readProjectScopeMcpServers(projectRoot),
      readLocalScopeMcpServers(projectRoot),
      readMcpJsonApprovals(projectRoot),
    ]);
    rows = listProjectMcpServers(project, local, projectRoot);
    approvals = projectApprovals;
  }

  const servers: McpServerRow[] = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      state: await itemState(
        "mcp",
        row.name,
        scope,
        resolution,
        projectRoot,
        row.source
      ),
      disabledBy: whyDisabled("mcp", row.name, scope, resolution, row.source),
    }))
  );

  const SOURCE_DETAIL: Record<McpSource, string> = {
    user: "User (~/.claude.json)",
    project: "Project (.mcp.json)",
    local: "Local (~/.claude.json)",
  };

  const items: MasterDetailItem[] = servers.map((server) => ({
    id: server.id,
    label: server.name,
    detail: projectRoot ? SOURCE_DETAIL[server.source] : undefined,
    state: server.state,
  }));
  const server = servers.find((candidate) => candidate.id === selectedId);

  const approvalNote = server
    ? server.source === "project"
      ? approvals.enabled.includes(server.name)
        ? "Approved in Claude Code's dialog"
        : approvals.disabled.includes(server.name)
          ? "Rejected in Claude Code's dialog"
          : "No record yet"
      : undefined
    : undefined;

  return (
    <MasterDetail
      items={items}
      selectedId={selectedId}
      showArchived={showArchived}
      empty={
        projectRoot
          ? "This project has no MCP servers in .mcp.json or in ~/.claude.json."
          : "~/.claude.json lists no MCP servers."
      }
    >
      {server ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-gray-1000">
              {server.name}
            </h2>
            <p className="font-mono text-sm text-gray-900">{server.file}</p>
          </div>

          <ItemStateControls
            state={server.state}
            action={changeItemState}
            fields={{ type: "mcp", name: server.name, source: server.source }}
            lockedReason={
              // A server denied higher up cannot be re-enabled from the scope being edited.
              // Per Step 1's spike, deniedMcpServers covers a local-scope server the same
              // way it covers a user-scope one, so local servers get these controls too.
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

          {approvalNote ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-gray-1000">
                Claude Code&apos;s own record
              </h3>
              <p className="text-sm text-gray-900">{approvalNote}</p>
              <p className="text-sm text-gray-900">
                Observed from ~/.claude.json on this machine; Claude Code does
                not document these keys. It does not change this server&apos;s
                state above.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-900">Select a server.</p>
      )}
    </MasterDetail>
  );
}
