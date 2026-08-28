import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectScopeSkills, readUserScopeSkills } from "./read";

describe("readUserScopeSkills", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "boopervisor-skills-"));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  test("returns empty object when ~/.claude/skills is absent", async () => {
    const result = await readUserScopeSkills(home);
    expect(result).toEqual({});
  });

  test("reads a skill with SKILL.md", async () => {
    const skillsDir = join(home, ".claude", "skills");
    await mkdir(skillsDir, { recursive: true });

    const skillDir = join(skillsDir, "my-skill");
    await mkdir(skillDir);

    const skillMd = `---
name: my-skill
description: A test skill
---

# My Skill
`;
    await writeFile(join(skillDir, "SKILL.md"), skillMd);

    const result = await readUserScopeSkills(home);
    expect(result["my-skill"]).toBeDefined();
    expect(result["my-skill"]?.name).toBe("my-skill");
    expect(result["my-skill"]?.metadata.description).toBe("A test skill");
  });

  test("skips directories without SKILL.md", async () => {
    const skillsDir = join(home, ".claude", "skills");
    await mkdir(skillsDir, { recursive: true });

    const skillDir = join(skillsDir, "incomplete-skill");
    await mkdir(skillDir);
    // No SKILL.md file

    const result = await readUserScopeSkills(home);
    expect(result).toEqual({});
  });

  test("skips SKILL.md without name field", async () => {
    const skillsDir = join(home, ".claude", "skills");
    await mkdir(skillsDir, { recursive: true });

    const skillDir = join(skillsDir, "no-name-skill");
    await mkdir(skillDir);

    const skillMd = `---
description: A skill without a name
---

# Nameless
`;
    await writeFile(join(skillDir, "SKILL.md"), skillMd);

    const result = await readUserScopeSkills(home);
    expect(result).toEqual({});
  });

  test("reads multiple skills", async () => {
    const skillsDir = join(home, ".claude", "skills");
    await mkdir(skillsDir, { recursive: true });

    const skill1Dir = join(skillsDir, "skill1");
    await mkdir(skill1Dir);
    await writeFile(
      join(skill1Dir, "SKILL.md"),
      `---
name: skill1
description: First skill
---`
    );

    const skill2Dir = join(skillsDir, "skill2");
    await mkdir(skill2Dir);
    await writeFile(
      join(skill2Dir, "SKILL.md"),
      `---
name: skill2
description: Second skill
---`
    );

    const result = await readUserScopeSkills(home);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["skill1"]).toBeDefined();
    expect(result["skill2"]).toBeDefined();
  });

  test("reads a skill from a directory with multiline description", async () => {
    const skillsDir = join(home, ".claude", "skills");
    await mkdir(skillsDir, { recursive: true });

    const skillDir = join(skillsDir, "multiline-skill");
    await mkdir(skillDir);

    // Test multiline YAML description (using >)
    const skillMd = `---
name: multiline-skill
description: >
  This is a multiline
  description that spans
  multiple lines
---

Content here
`;
    await writeFile(join(skillDir, "SKILL.md"), skillMd);

    const result = await readUserScopeSkills(home);
    expect(result["multiline-skill"]).toBeDefined();
    expect(result["multiline-skill"]?.metadata.description).toBeTruthy();
  });
});

describe("readProjectScopeSkills", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "boopervisor-project-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  test("returns empty object when .claude/skills is absent", async () => {
    const result = await readProjectScopeSkills(projectPath);
    expect(result).toEqual({});
  });

  test("reads a skill from project scope", async () => {
    const skillsDir = join(projectPath, ".claude", "skills");
    await mkdir(skillsDir, { recursive: true });

    const skillDir = join(skillsDir, "project-skill");
    await mkdir(skillDir);

    const skillMd = `---
name: project-skill
description: A project-scoped skill
---`;
    await writeFile(join(skillDir, "SKILL.md"), skillMd);

    const result = await readProjectScopeSkills(projectPath);
    expect(result["project-skill"]).toBeDefined();
    expect(result["project-skill"]?.metadata.description).toBe(
      "A project-scoped skill"
    );
  });
});
