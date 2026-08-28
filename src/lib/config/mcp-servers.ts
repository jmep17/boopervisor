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
