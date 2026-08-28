import { homedir } from "node:os";
import { join } from "node:path";
import {
  mutateJsonFile,
  type ExpectedFile,
  type MutationResult,
} from "./mutate";
import type { JsonObject } from "./json-file";
import { archivedItemsPath } from "@/lib/items/item-state";
import type { Scope } from "@/lib/catalog";

/**
 * The only path by which Boopervisor may touch ~/.claude.json:
 * read-modify-write solely the `mcpServers` key, leaving all other keys untouched.
 * Disabling/enabling servers uses settings keys instead (deniedMcpServers, etc).
 * This seam preserves the file byte-identically outside its `mcpServers` key.
 */
export async function mutateUserMcpServers(
  apply: (
    servers: Record<string, Record<string, unknown>>
  ) => Record<string, Record<string, unknown>>,
  expected: ExpectedFile,
  homeDir?: string
): Promise<MutationResult> {
  const path = join(homeDir || homedir(), ".claude.json");

  return mutateJsonFile({
    path,
    expected,
    target: {
      kind: "item",
      item: "mcp",
      scope: "user",
      name: "mcpServers",
    },
    apply: (content: JsonObject) => {
      const mcpServers = content.mcpServers;
      if (
        typeof mcpServers !== "object" ||
        mcpServers === null ||
        Array.isArray(mcpServers)
      ) {
        return content;
      }
      // Copy top level so we don't mutate the input
      const newServers = apply(
        mcpServers as Record<string, Record<string, unknown>>
      );
      return { ...content, mcpServers: newServers };
    },
    homeDir,
  });
}

/**
 * Archive an MCP server in boopervisor.json.
 * Does not modify the server's configuration in ~/.claude.json;
 * disabling goes through settings mutations (deniedMcpServers, etc).
 */
export async function archiveMcpServer(
  serverName: string,
  scope: Scope,
  expected: ExpectedFile,
  homeDir?: string
): Promise<MutationResult> {
  const path = archivedItemsPath(homeDir);

  return mutateJsonFile({
    path,
    expected,
    target: {
      kind: "item",
      item: "mcp",
      scope,
      name: serverName,
    },
    apply: (content: JsonObject) => {
      // Copy the archivedItems object so we don't mutate the input
      const archivedItems = content.archivedItems
        ? { ...(content.archivedItems as Record<string, unknown>) }
        : {};
      const key = `mcp:${scope}:${serverName}`;
      archivedItems[key] = {
        type: "mcp",
        scope,
        name: serverName,
        archivedAt: new Date().toISOString(),
      };
      return { ...content, archivedItems };
    },
    homeDir,
  });
}

/**
 * Unarchive an MCP server in boopervisor.json.
 * Does not change the server's enabled/disabled state in settings.
 */
export async function unarchiveMcpServer(
  serverName: string,
  scope: Scope,
  expected: ExpectedFile,
  homeDir?: string
): Promise<MutationResult> {
  const path = archivedItemsPath(homeDir);

  return mutateJsonFile({
    path,
    expected,
    target: {
      kind: "item",
      item: "mcp",
      scope,
      name: serverName,
    },
    apply: (content: JsonObject) => {
      // Copy the archivedItems object so we don't mutate the input
      const archivedItems = content.archivedItems
        ? { ...(content.archivedItems as Record<string, unknown>) }
        : {};
      const key = `mcp:${scope}:${serverName}`;
      delete archivedItems[key];
      return { ...content, archivedItems };
    },
    homeDir,
  });
}
