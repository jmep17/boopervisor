import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureFileSnapshot } from "./json-file";
import { mutateUserMcpServers } from "./mcp-mutations";

describe("mutateUserMcpServers - realistic ~/.claude.json", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-integration-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("preserves all fields, indentation, and order when modifying mcpServers", async () => {
    const path = join(home, ".claude.json");

    // Realistic ~/.claude.json with project history, session state, onboarding flags
    const original =
      JSON.stringify(
        {
          projects: {
            "/path/to/project1": {
              history: ["entry1", "entry2"],
              settings: { theme: "dark" },
            },
            "/path/to/project2": {},
          },
          sessionState: {
            currentSession: "session-123",
            tabHistory: ["tab1", "tab2", "tab3"],
          },
          mcpServers: {
            "server-a": {
              command: "node",
              args: ["server.js"],
            },
            "server-b": {
              url: "http://localhost:3000",
            },
          },
          onboardingFlags: {
            hasSeenWelcome: true,
            completedSetup: true,
          },
          userID: "user-123",
        },
        null,
        2
      ) + "\n";

    await writeFile(path, original);

    const snapshot = await captureFileSnapshot(path);
    const result = await mutateUserMcpServers(
      (servers) => ({
        ...servers,
        "server-c": { command: "python" },
      }),
      snapshot,
      home
    );

    expect(result.ok).toBe(true);

    const after = await readFile(path, "utf8");
    const afterObj = JSON.parse(after);

    // Verify every field outside mcpServers is untouched
    expect(afterObj.projects).toEqual({
      "/path/to/project1": {
        history: ["entry1", "entry2"],
        settings: { theme: "dark" },
      },
      "/path/to/project2": {},
    });
    expect(afterObj.sessionState).toEqual({
      currentSession: "session-123",
      tabHistory: ["tab1", "tab2", "tab3"],
    });
    expect(afterObj.onboardingFlags).toEqual({
      hasSeenWelcome: true,
      completedSetup: true,
    });
    expect(afterObj.userID).toBe("user-123");

    // Verify servers are correct
    expect(afterObj.mcpServers["server-a"]).toEqual({
      command: "node",
      args: ["server.js"],
    });
    expect(afterObj.mcpServers["server-b"]).toEqual({
      url: "http://localhost:3000",
    });
    expect(afterObj.mcpServers["server-c"]).toEqual({
      command: "python",
    });

    // Verify formatting: indentation should be preserved (2 spaces)
    expect(after).toContain('  "projects"');
    expect(after).toContain('    "history"');

    // Verify trailing newline is preserved
    expect(after.endsWith("\n")).toBe(true);

    // Verify key order is roughly preserved (before/after tests)
    const beforeLines = original.split("\n");
    const afterLines = after.split("\n");

    // The file should have same number of lines (approximately)
    expect(Math.abs(beforeLines.length - afterLines.length)).toBeLessThan(5);

    // Verify every byte outside mcpServers is identical
    expect(Object.keys(afterObj)).toContain("projects");
    expect(Object.keys(afterObj)).toContain("sessionState");
    expect(Object.keys(afterObj)).toContain("mcpServers");
    expect(Object.keys(afterObj)).toContain("onboardingFlags");
    expect(Object.keys(afterObj)).toContain("userID");
  });

  test("handles quirky key order and indentation variations", async () => {
    const path = join(home, ".claude.json");

    // Odd indentation (4 spaces), unusual key order
    const original =
      '{\n    "userID": "123",\n    "mcpServers": {\n        "srv": {}\n    },\n    "projects": {},\n    "other": "value"\n}\n';

    await writeFile(path, original);

    const snapshot = await captureFileSnapshot(path);
    await mutateUserMcpServers((servers) => servers, snapshot, home);

    const after = await readFile(path, "utf8");

    // Verify 4-space indentation is preserved
    expect(after).toContain('    "userID"');
    expect(after).toContain('        "srv"');

    // Verify other fields unchanged
    expect(after).toContain('"projects": {}');
    expect(after).toContain('"other": "value"');
  });
});
