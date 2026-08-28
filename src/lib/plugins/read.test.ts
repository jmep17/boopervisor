import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readInstalledPlugins } from "./read";

describe("readInstalledPlugins", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-plugins-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("returns empty object when installed_plugins.json is absent", async () => {
    const result = await readInstalledPlugins(home);
    expect(result).toEqual({});
  });

  test("returns empty object when installed_plugins.json has no plugins", async () => {
    const pluginsDir = join(home, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });

    const registryPath = join(pluginsDir, "installed_plugins.json");
    await writeFile(registryPath, JSON.stringify({ version: 2, plugins: {} }));

    const result = await readInstalledPlugins(home);
    expect(result).toEqual({});
  });

  test("reads a plugin with plugin.json", async () => {
    const pluginsDir = join(home, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });

    // Create plugin installation directory
    const installPath = join(
      pluginsDir,
      "cache",
      "my-marketplace",
      "my-plugin",
      "1.0.0"
    );
    await mkdir(installPath, { recursive: true });

    // Create plugin.json
    const pluginJson = {
      name: "my-plugin",
      version: "1.0.0",
      description: "A test plugin",
    };
    await writeFile(
      join(installPath, "plugin.json"),
      JSON.stringify(pluginJson)
    );

    // Create installed_plugins.json registry
    const registry = {
      version: 2,
      plugins: {
        "my-plugin@my-marketplace": [
          {
            scope: "user",
            installPath,
            version: "1.0.0",
          },
        ],
      },
    };
    const registryPath = join(pluginsDir, "installed_plugins.json");
    await writeFile(registryPath, JSON.stringify(registry));

    const result = await readInstalledPlugins(home);
    expect(result["my-plugin@my-marketplace"]).toBeDefined();
    expect(result["my-plugin@my-marketplace"]?.name).toBe("my-plugin");
    expect(result["my-plugin@my-marketplace"]?.marketplace).toBe(
      "my-marketplace"
    );
    expect(result["my-plugin@my-marketplace"]?.metadata?.version).toBe("1.0.0");
  });

  test("reads multiple plugins", async () => {
    const pluginsDir = join(home, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });

    // Create first plugin
    const installPath1 = join(
      pluginsDir,
      "cache",
      "marketplace-a",
      "plugin-a",
      "1.0.0"
    );
    await mkdir(installPath1, { recursive: true });
    await writeFile(
      join(installPath1, "plugin.json"),
      JSON.stringify({
        name: "plugin-a",
        version: "1.0.0",
      })
    );

    // Create second plugin
    const installPath2 = join(
      pluginsDir,
      "cache",
      "marketplace-b",
      "plugin-b",
      "2.0.0"
    );
    await mkdir(installPath2, { recursive: true });
    await writeFile(
      join(installPath2, "plugin.json"),
      JSON.stringify({
        name: "plugin-b",
        version: "2.0.0",
      })
    );

    // Create registry
    const registry = {
      version: 2,
      plugins: {
        "plugin-a@marketplace-a": [
          { scope: "user", installPath: installPath1, version: "1.0.0" },
        ],
        "plugin-b@marketplace-b": [
          { scope: "user", installPath: installPath2, version: "2.0.0" },
        ],
      },
    };
    const registryPath = join(pluginsDir, "installed_plugins.json");
    await writeFile(registryPath, JSON.stringify(registry));

    const result = await readInstalledPlugins(home);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["plugin-a@marketplace-a"]).toBeDefined();
    expect(result["plugin-b@marketplace-b"]).toBeDefined();
  });

  test("ignores plugins without plugin.json", async () => {
    const pluginsDir = join(home, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });

    // Create installation directory but no plugin.json
    const installPath = join(
      pluginsDir,
      "cache",
      "marketplace",
      "plugin",
      "1.0.0"
    );
    await mkdir(installPath, { recursive: true });

    // Create registry
    const registry = {
      version: 2,
      plugins: {
        "plugin@marketplace": [
          { scope: "user", installPath, version: "1.0.0" },
        ],
      },
    };
    const registryPath = join(pluginsDir, "installed_plugins.json");
    await writeFile(registryPath, JSON.stringify(registry));

    const result = await readInstalledPlugins(home);
    // An unreadable plugin.json does not make an installed plugin disappear from the listing.
    expect(result["plugin@marketplace"]?.metadata).toBeNull();
  });

  test("lists a plugin installed at project scope, noting where it came from", async () => {
    const pluginsDir = join(home, ".claude", "plugins");
    await mkdir(pluginsDir, { recursive: true });

    // Create plugin installation
    const installPath = join(
      pluginsDir,
      "cache",
      "marketplace",
      "plugin",
      "1.0.0"
    );
    await mkdir(installPath, { recursive: true });
    await writeFile(
      join(installPath, "plugin.json"),
      JSON.stringify({
        name: "plugin",
        version: "1.0.0",
      })
    );

    // Create registry with only project-scoped installation
    const registry = {
      version: 2,
      plugins: {
        "plugin@marketplace": [
          {
            scope: "project",
            installPath,
            version: "1.0.0",
          },
        ],
      },
    };
    const registryPath = join(pluginsDir, "installed_plugins.json");
    await writeFile(registryPath, JSON.stringify(registry));

    const result = await readInstalledPlugins(home);
    // Plugins are enabled per scope by a setting, so the listing shows them all.
    expect(result["plugin@marketplace"]?.installedScope).toBe("project");
  });
});

describe("where a plugin keeps its manifest", () => {
  test("reads .claude-plugin/plugin.json and reports the path it read", async () => {
    const home = await mkdtemp(join(tmpdir(), "boopervisor-manifest-"));
    const installPath = join(
      home,
      ".claude",
      "plugins",
      "cache",
      "m",
      "p",
      "1.0.0"
    );
    await mkdir(join(installPath, ".claude-plugin"), { recursive: true });
    await writeFile(
      join(installPath, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "p", version: "1.0.0" })
    );
    await writeFile(
      join(home, ".claude", "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: { "p@m": [{ scope: "user", installPath, version: "1.0.0" }] },
      })
    );

    const plugin = (await readInstalledPlugins(home))["p@m"];
    expect(plugin?.metadata?.name).toBe("p");
    expect(plugin?.manifestPath).toBe(
      join(installPath, ".claude-plugin", "plugin.json")
    );
  });
});
