import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listProjectMcpServers,
  readLocalScopeMcpServers,
  readMcpJsonApprovals,
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

describe("readLocalScopeMcpServers", () => {
  let home: string;
  let projectPath: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-mcp-home-"));
    projectPath = "/Users/example/my-project";
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("returns empty object when ~/.claude.json is absent", async () => {
    const result = await readLocalScopeMcpServers(projectPath, home);
    expect(result).toEqual({});
  });

  test("returns empty object when the project is not in the map", async () => {
    const path = join(home, ".claude.json");
    await writeFile(path, JSON.stringify({ projects: {} }));
    const result = await readLocalScopeMcpServers(projectPath, home);
    expect(result).toEqual({});
  });

  test("returns empty object when mcpServers is absent from the project entry", async () => {
    const path = join(home, ".claude.json");
    await writeFile(
      path,
      JSON.stringify({ projects: { [projectPath]: { allowedTools: [] } } })
    );
    const result = await readLocalScopeMcpServers(projectPath, home);
    expect(result).toEqual({});
  });

  test("reads projects[path].mcpServers", async () => {
    const path = join(home, ".claude.json");
    const content = {
      projects: {
        [projectPath]: {
          mcpServers: {
            "local-server": { command: "npx", args: ["thing"] },
          },
        },
      },
    };
    await writeFile(path, JSON.stringify(content));
    const result = await readLocalScopeMcpServers(projectPath, home);
    expect(result).toEqual({
      "local-server": { command: "npx", args: ["thing"] },
    });
  });

  test("a selection path with a trailing slash still finds the entry", async () => {
    const path = join(home, ".claude.json");
    const content = {
      projects: {
        [projectPath]: {
          mcpServers: { "local-server": { command: "npx" } },
        },
      },
    };
    await writeFile(path, JSON.stringify(content));
    const result = await readLocalScopeMcpServers(`${projectPath}/`, home);
    expect(result).toEqual({ "local-server": { command: "npx" } });
  });
});

describe("readMcpJsonApprovals", () => {
  let home: string;
  const projectPath = "/Users/example/my-project";

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-mcp-approvals-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("returns empty lists when ~/.claude.json is absent", async () => {
    const result = await readMcpJsonApprovals(projectPath, home);
    expect(result).toEqual({ enabled: [], disabled: [] });
  });

  test("returns empty lists when the project has no record", async () => {
    const path = join(home, ".claude.json");
    await writeFile(path, JSON.stringify({ projects: { [projectPath]: {} } }));
    const result = await readMcpJsonApprovals(projectPath, home);
    expect(result).toEqual({ enabled: [], disabled: [] });
  });

  test("reads both enabled and disabled lists", async () => {
    const path = join(home, ".claude.json");
    const content = {
      projects: {
        [projectPath]: {
          enabledMcpjsonServers: ["stripe"],
          disabledMcpjsonServers: ["shady"],
        },
      },
    };
    await writeFile(path, JSON.stringify(content));
    const result = await readMcpJsonApprovals(projectPath, home);
    expect(result).toEqual({ enabled: ["stripe"], disabled: ["shady"] });
  });
});

describe("listProjectMcpServers", () => {
  test("prefixes ids by source and sets the right file for each", () => {
    const rows = listProjectMcpServers(
      { "project-server": { command: "a" } },
      { "local-server": { command: "b" } },
      "/Users/example/my-project"
    );
    expect(rows).toEqual([
      {
        id: "project:project-server",
        name: "project-server",
        source: "project",
        file: "/Users/example/my-project/.mcp.json",
        configuration: { command: "a" },
      },
      {
        id: "local:local-server",
        name: "local-server",
        source: "local",
        file: "~/.claude.json",
        configuration: { command: "b" },
      },
    ]);
  });

  test("a name present in both sources yields two rows", () => {
    const rows = listProjectMcpServers(
      { shared: { command: "a" } },
      { shared: { command: "b" } },
      "/proj"
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "project:shared",
      "local:shared",
    ]);
  });
});
