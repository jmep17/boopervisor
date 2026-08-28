import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isArchived, itemKey, readItemState } from "./item-state";

describe("itemState", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-items-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  describe("readItemState", () => {
    test("returns empty store when file is absent", async () => {
      const state = await readItemState(home);
      expect(state.archivedItems).toEqual({});
    });

    test("returns empty store when file is empty", async () => {
      const path = join(home, ".claude", "boopervisor.json");
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(path, "");
      const state = await readItemState(home);
      expect(state.archivedItems).toEqual({});
    });

    test("reads archived items from file", async () => {
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
      await writeFile(path, JSON.stringify(content, null, 2));
      const state = await readItemState(home);
      expect(state.archivedItems).toHaveProperty("mcp:user:my-server");
    });
  });

  describe("isArchived", () => {
    test("returns false when no archived items exist", async () => {
      const result = await isArchived(
        "mcp",
        "user",
        "my-server",
        undefined,
        home
      );
      expect(result).toBe(false);
    });

    test("returns true when item is archived", async () => {
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
      const result = await isArchived(
        "mcp",
        "user",
        "my-server",
        undefined,
        home
      );
      expect(result).toBe(true);
    });

    test("returns false when similar but different item is archived", async () => {
      const path = join(home, ".claude", "boopervisor.json");
      const content = {
        archivedItems: {
          "mcp:user:other-server": {
            type: "mcp",
            scope: "user",
            name: "other-server",
            archivedAt: "2026-01-01T00:00:00Z",
          },
        },
      };
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(path, JSON.stringify(content));
      const result = await isArchived(
        "mcp",
        "user",
        "my-server",
        undefined,
        home
      );
      expect(result).toBe(false);
    });

    test("handles project-scoped items correctly", async () => {
      const path = join(home, ".claude", "boopervisor.json");
      const content = {
        archivedItems: {
          "skill:project:/path:my-skill": {
            type: "skill",
            scope: "project",
            project: "/path",
            name: "my-skill",
            archivedAt: "2026-01-01T00:00:00Z",
          },
        },
      };
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(path, JSON.stringify(content));
      const result = await isArchived(
        "skill",
        "project",
        "my-skill",
        "/path",
        home
      );
      expect(result).toBe(true);
    });
  });

  describe("itemKey", () => {
    test("keys an item by its type, scope, project and name", () => {
      expect(itemKey("skill", "project", "caveman", "/work/app")).toBe(
        "skill:project:/work/app:caveman"
      );
      expect(itemKey("mcp", "user", "playwright")).toBe("mcp:user:playwright");
    });
  });
});
