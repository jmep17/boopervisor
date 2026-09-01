import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseJsonObject } from "./json-file";

/**
 * An MCP server configuration object. User-scope servers from ~/.claude.json
 * may have an `enabled` field; project-scope servers from .mcp.json do not.
 */
export interface McpServer {
  // The exact shape depends on the server type (command, url, stdio, etc.)
  // We keep this as a loose shape since Claude Code owns the structure
  [key: string]: unknown;
}

/**
 * MCP servers configured in ~/.claude.json for the user scope.
 */
export interface UserScopeMcpServers {
  servers: Record<string, McpServer>;
}

/**
 * MCP servers configured in .mcp.json for a project scope.
 */
export interface ProjectMcpJson {
  mcpServers?: Record<string, McpServer>;
}

/** Where a project's server is defined. Not a settings scope: a source names a file. */
export type McpSource = "user" | "project" | "local";

function projectEntry(
  content: Record<string, unknown>,
  projectPath: string
): Record<string, unknown> {
  const projects = content.projects;
  if (
    typeof projects !== "object" ||
    projects === null ||
    Array.isArray(projects)
  )
    return {};
  const key = projectPath.replace(/\/+$/, "");
  const entry = (projects as Record<string, unknown>)[key];
  return typeof entry === "object" && entry !== null && !Array.isArray(entry)
    ? (entry as Record<string, unknown>)
    : {};
}

/**
 * Read MCP servers from ~/.claude.json (user scope).
 * The servers are in the `mcpServers` key if it exists.
 */
export async function readUserScopeMcpServers(
  home: string = homedir()
): Promise<Record<string, McpServer>> {
  const path = join(home, ".claude.json");
  try {
    const text = await readFile(path, "utf8");
    const { content } = parseJsonObject(text);
    const mcpServers = content.mcpServers;
    if (
      typeof mcpServers === "object" &&
      mcpServers !== null &&
      !Array.isArray(mcpServers)
    ) {
      return mcpServers as Record<string, McpServer>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Read MCP servers from .mcp.json in a project directory.
 */
export async function readProjectScopeMcpServers(
  projectPath: string
): Promise<Record<string, McpServer>> {
  const path = join(projectPath, ".mcp.json");
  try {
    const text = await readFile(path, "utf8");
    const { content } = parseJsonObject(text);
    const mcpServers = content.mcpServers;
    if (
      typeof mcpServers === "object" &&
      mcpServers !== null &&
      !Array.isArray(mcpServers)
    ) {
      return mcpServers as Record<string, McpServer>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * A project's local-scope servers: `projects[<path>].mcpServers` in `~/.claude.json`, which
 * is where `claude mcp add` puts a server by default. The map is keyed by the absolute
 * path as Claude Code recorded it; a trailing slash on the selection is not part of that key.
 */
export async function readLocalScopeMcpServers(
  projectPath: string,
  home: string = homedir()
): Promise<Record<string, McpServer>> {
  const path = join(home, ".claude.json");
  try {
    const text = await readFile(path, "utf8");
    const { content } = parseJsonObject(text);
    const mcpServers = projectEntry(content, projectPath).mcpServers;
    if (
      typeof mcpServers === "object" &&
      mcpServers !== null &&
      !Array.isArray(mcpServers)
    ) {
      return mcpServers as Record<string, McpServer>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * What Claude Code itself recorded about a project's `.mcp.json` servers after its approval
 * dialog: `projects[<path>].enabledMcpjsonServers` and `disabledMcpjsonServers`. Undocumented;
 * observed on one machine. Read for display, never written.
 */
export async function readMcpJsonApprovals(
  projectPath: string,
  home: string = homedir()
): Promise<{ enabled: string[]; disabled: string[] }> {
  const path = join(home, ".claude.json");
  try {
    const text = await readFile(path, "utf8");
    const { content } = parseJsonObject(text);
    const entry = projectEntry(content, projectPath);
    const enabled = Array.isArray(entry.enabledMcpjsonServers)
      ? (entry.enabledMcpjsonServers as unknown[]).filter(
          (value): value is string => typeof value === "string"
        )
      : [];
    const disabled = Array.isArray(entry.disabledMcpjsonServers)
      ? (entry.disabledMcpjsonServers as unknown[]).filter(
          (value): value is string => typeof value === "string"
        )
      : [];
    return { enabled, disabled };
  } catch {
    return { enabled: [], disabled: [] };
  }
}

/** One row in the master-detail list: where a server came from and which file it lives in. */
export interface ProjectMcpServerRow {
  id: string;
  name: string;
  source: McpSource;
  file: string;
  configuration: McpServer;
}

/**
 * Builds the rows for a project's `/mcp` listing from its two sources. Pure, so the page
 * component stays a thin read-and-render shell and this can be tested without cookies or
 * the filesystem.
 */
export function listProjectMcpServers(
  project: Record<string, McpServer>,
  local: Record<string, McpServer>,
  projectRoot: string
): ProjectMcpServerRow[] {
  const projectRows = Object.entries(project).map(
    ([name, configuration]): ProjectMcpServerRow => ({
      id: `project:${name}`,
      name,
      source: "project",
      file: `${projectRoot}/.mcp.json`,
      configuration,
    })
  );
  const localRows = Object.entries(local).map(
    ([name, configuration]): ProjectMcpServerRow => ({
      id: `local:${name}`,
      name,
      source: "local",
      file: "~/.claude.json",
      configuration,
    })
  );
  return [...projectRows, ...localRows];
}
