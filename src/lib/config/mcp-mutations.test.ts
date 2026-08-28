import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureFileSnapshot } from "./json-file";
import {
  archiveMcpServer,
  mutateUserMcpServers,
  unarchiveMcpServer,
} from "./mcp-mutations";

describe("mutateUserMcpServers", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-mcp-mut-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("applies changes to mcpServers without mutating input", async () => {
    const path = join(home, ".claude.json");
    const content = {
      mcpServers: {
        "my-server": { command: "node", args: ["server.js"] },
      },
      projects: {},
      sessionState: { value: "preserve" },
    };
    await writeFile(path, JSON.stringify(content, null, 2) + "\n");

    const snapshot = await captureFileSnapshot(path);
    const result = await mutateUserMcpServers(
      (servers) => {
        // Return new servers object without mutating input
        return {
          ...servers,
          "new-server": { command: "python" },
        };
      },
      snapshot,
      home
    );

    expect(result.ok).toBe(true);
    const newContent = JSON.parse(await readFile(path, "utf8"));
    expect(newContent.mcpServers["new-server"]).toEqual({ command: "python" });
    // Verify other keys are preserved exactly
    expect(newContent.projects).toEqual({});
    expect(newContent.sessionState).toEqual({ value: "preserve" });
  });

  test("preserves file indentation", async () => {
    const path = join(home, ".claude.json");
    const original =
      '{\n    "mcpServers": {\n        "my-server": { "command": "node" }\n    },\n    "projects": {}\n}\n';
    await writeFile(path, original);

    const snapshot = await captureFileSnapshot(path);
    await mutateUserMcpServers((servers) => servers, snapshot, home);

    const result = await readFile(path, "utf8");
    // Should have 4-space indentation (preserved from original)
    expect(result).toContain('    "mcpServers"');
  });

  test("preserves trailing newline", async () => {
    const path = join(home, ".claude.json");
    const content = { mcpServers: { server: {} }, projects: {} };
    await writeFile(path, JSON.stringify(content) + "\n");

    const snapshot = await captureFileSnapshot(path);
    await mutateUserMcpServers((servers) => servers, snapshot, home);

    const result = await readFile(path, "utf8");
    expect(result.endsWith("\n")).toBe(true);
  });

  test("refuses stale writes", async () => {
    const path = join(home, ".claude.json");
    const content = { mcpServers: { server: {} }, projects: {} };
    await writeFile(path, JSON.stringify(content));

    const snapshot = await captureFileSnapshot(path);

    // Change the file after snapshot
    await writeFile(path, JSON.stringify({ mcpServers: { other: {} } }));

    const result = await mutateUserMcpServers(
      (servers) => servers,
      snapshot,
      home
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toBe("stale");
    }
  });
});

describe("archiveMcpServer", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-archive-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("records an archived server", async () => {
    const path = join(home, ".claude", "boopervisor.json");
    const content = { archivedItems: {} };
    await mkdir(join(home, ".claude"), { recursive: true });
    await writeFile(path, JSON.stringify(content));

    const snapshot = await captureFileSnapshot(path);
    const result = await archiveMcpServer("my-server", "user", snapshot, home);

    expect(result.ok).toBe(true);
    const newContent = JSON.parse(await readFile(path, "utf8"));
    expect(newContent.archivedItems["mcp:user:my-server"]).toBeTruthy();
    expect(newContent.archivedItems["mcp:user:my-server"].type).toBe("mcp");
    expect(newContent.archivedItems["mcp:user:my-server"].name).toBe(
      "my-server"
    );
    expect(newContent.archivedItems["mcp:user:my-server"].scope).toBe("user");
  });

  test("adds timestamp to archived item", async () => {
    const path = join(home, ".claude", "boopervisor.json");
    await mkdir(join(home, ".claude"), { recursive: true });
    await writeFile(path, JSON.stringify({ archivedItems: {} }));

    const snapshot = await captureFileSnapshot(path);
    const before = new Date().toISOString();
    await archiveMcpServer("server", "user", snapshot, home);
    const after = new Date().toISOString();

    const newContent = JSON.parse(await readFile(path, "utf8"));
    const archivedAt = newContent.archivedItems["mcp:user:server"].archivedAt;
    expect(archivedAt).toBeTruthy();
    expect(archivedAt >= before && archivedAt <= after).toBe(true);
  });
});

describe("unarchiveMcpServer", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-unarchive-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("removes an archived server", async () => {
    const path = join(home, ".claude", "boopervisor.json");
    const content = {
      archivedItems: {
        "mcp:user:my-server": {
          type: "mcp",
          scope: "user",
          name: "my-server",
          archivedAt: "2026-01-01T00:00:00Z",
        },
      },
    };
    await mkdir(join(home, ".claude"), { recursive: true });
    await writeFile(path, JSON.stringify(content));

    const snapshot = await captureFileSnapshot(path);
    const result = await unarchiveMcpServer(
      "my-server",
      "user",
      snapshot,
      home
    );

    expect(result.ok).toBe(true);
    const newContent = JSON.parse(await readFile(path, "utf8"));
    expect(newContent.archivedItems["mcp:user:my-server"]).toBeUndefined();
  });
});
