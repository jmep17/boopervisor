import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readProjectScopeMcpServers,
  readUserScopeMcpServers,
} from "./mcp-servers";

describe("readUserScopeMcpServers", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-mcp-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("returns empty object when ~/.claude.json is absent", async () => {
    const result = await readUserScopeMcpServers(home);
    expect(result).toEqual({});
  });

  test("returns empty object when mcpServers key is absent", async () => {
    const path = join(home, ".claude.json");
    await writeFile(path, JSON.stringify({ projects: {}, otherKey: "value" }));
    const result = await readUserScopeMcpServers(home);
    expect(result).toEqual({});
  });

  test("reads mcpServers from ~/.claude.json", async () => {
    const path = join(home, ".claude.json");
    const content = {
      mcpServers: {
        "my-server": { command: "node", args: ["server.js"] },
        "other-server": { url: "http://localhost:3000" },
      },
      projects: {},
    };
    await writeFile(path, JSON.stringify(content));
    const result = await readUserScopeMcpServers(home);
    expect(result).toEqual({
      "my-server": { command: "node", args: ["server.js"] },
      "other-server": { url: "http://localhost:3000" },
    });
  });

  test("returns empty object when mcpServers is not an object", async () => {
    const path = join(home, ".claude.json");
    await writeFile(path, JSON.stringify({ mcpServers: "invalid" }));
    const result = await readUserScopeMcpServers(home);
    expect(result).toEqual({});
  });

  test("ignores other keys in ~/.claude.json", async () => {
    const path = join(home, ".claude.json");
    const content = {
      mcpServers: { "my-server": { command: "test" } },
      projects: { "/path": {} },
      sessionState: { someData: "here" },
      onboardingFlags: { seen: true },
    };
    await writeFile(path, JSON.stringify(content));
    const result = await readUserScopeMcpServers(home);
    expect(result).toEqual({ "my-server": { command: "test" } });
  });

  test("preserves server object structure exactly", async () => {
    const path = join(home, ".claude.json");
    const serverConfig = {
      command: "node",
      args: ["server.js"],
      env: { KEY: "value" },
      enabled: true,
    };
    const content = {
      mcpServers: {
        "my-server": serverConfig,
      },
    };
    await writeFile(path, JSON.stringify(content));
    const result = await readUserScopeMcpServers(home);
    expect(result["my-server"]).toEqual(serverConfig);
  });
});

describe("readProjectScopeMcpServers", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "boopervisor-project-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  test("returns empty object when .mcp.json is absent", async () => {
    const result = await readProjectScopeMcpServers(projectPath);
    expect(result).toEqual({});
  });

  test("returns empty object when mcpServers key is absent", async () => {
    const path = join(projectPath, ".mcp.json");
    await writeFile(path, JSON.stringify({ otherKey: "value" }));
    const result = await readProjectScopeMcpServers(projectPath);
    expect(result).toEqual({});
  });

  test("reads mcpServers from .mcp.json", async () => {
    const path = join(projectPath, ".mcp.json");
    const content = {
      mcpServers: {
        "project-server": { command: "python", args: ["server.py"] },
        another: { url: "http://localhost:4000" },
      },
    };
    await writeFile(path, JSON.stringify(content));
    const result = await readProjectScopeMcpServers(projectPath);
    expect(result).toEqual({
      "project-server": { command: "python", args: ["server.py"] },
      another: { url: "http://localhost:4000" },
    });
  });

  test("returns empty object when mcpServers is not an object", async () => {
    const path = join(projectPath, ".mcp.json");
    await writeFile(path, JSON.stringify({ mcpServers: [] }));
    const result = await readProjectScopeMcpServers(projectPath);
    expect(result).toEqual({});
  });
});
