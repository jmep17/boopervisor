import { homedir } from "node:os";
import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";

/**
 * Metadata extracted from a SKILL.md file's YAML frontmatter.
 */
export interface SkillMetadata {
  name: string;
  description?: string;
}

/**
 * A skill with its name and metadata from SKILL.md.
 */
export interface Skill {
  name: string;
  path: string;
  metadata: SkillMetadata;
}

/**
 * The YAML frontmatter of a `SKILL.md`, between the `---` lines at the top.
 *
 * Only the shapes skills actually use are read: `key: value`, and the folded and literal
 * block scalars (`key: >` and `key: |`) that a long description is written with. Anything
 * else is left alone — Boopervisor shows this file, it does not own its format.
 */
function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return {};

  const result: Record<string, string> = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") break;

    const colon = line.indexOf(":");
    if (colon <= 0 || /^\s/.test(line)) continue;

    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!key) continue;

    if (value === ">" || value === "|" || value === ">-" || value === "|-") {
      const [block, next] = readBlockScalar(
        lines,
        index + 1,
        value.startsWith(">")
      );
      result[key] = block;
      index = next - 1;
    } else if (value) {
      result[key] = unquote(value);
    }
  }
  return result;
}

/** The indented lines under a block scalar. Folded joins them with spaces; literal keeps the breaks. */
function readBlockScalar(
  lines: readonly string[],
  start: number,
  folded: boolean
): [string, number] {
  const block: string[] = [];
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") break;
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    block.push(line.trim());
  }
  const text = folded ? block.join(" ").replace(/\s+/g, " ") : block.join("\n");
  return [text.trim(), index];
}

function unquote(value: string): string {
  const quoted = /^"(.*)"$|^'(.*)'$/.exec(value);
  return quoted ? (quoted[1] ?? quoted[2]) : value;
}

/**
 * Read a single skill's metadata from its SKILL.md file.
 */
async function readSkillMetadata(
  skillPath: string,
  directoryName: string
): Promise<SkillMetadata | null> {
  try {
    const skillMdPath = join(skillPath, "SKILL.md");
    const text = await readFile(skillMdPath, "utf-8");
    const frontmatter = parseFrontmatter(text);

    // Every frontmatter field is optional: a skill's directory is what names it.
    return {
      name: frontmatter.name || directoryName,
      description: frontmatter.description,
    };
  } catch {
    // SKILL.md doesn't exist or can't be read
    return null;
  }
}

/**
 * Read all skills from the user scope: ~/.claude/skills directory.
 * Returns an object mapping skill name to Skill.
 */
export async function readUserScopeSkills(
  home: string = homedir()
): Promise<Record<string, Skill>> {
  const skillsDir = join(home, ".claude", "skills");
  const skills: Record<string, Skill> = {};

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Symlinks and directories only
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

      const skillPath = join(skillsDir, entry.name);
      const metadata = await readSkillMetadata(skillPath, entry.name);

      if (metadata) {
        skills[metadata.name] = {
          name: metadata.name,
          path: skillPath,
          metadata,
        };
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills;
}

/**
 * Read all skills from a project scope: .claude/skills directory within a project.
 * Returns an object mapping skill name to Skill.
 */
export async function readProjectScopeSkills(
  projectPath: string
): Promise<Record<string, Skill>> {
  const skillsDir = join(projectPath, ".claude", "skills");
  const skills: Record<string, Skill> = {};

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Directories only (no symlinks expected in project scope)
      if (!entry.isDirectory()) continue;

      const skillPath = join(skillsDir, entry.name);
      const metadata = await readSkillMetadata(skillPath, entry.name);

      if (metadata) {
        skills[metadata.name] = {
          name: metadata.name,
          path: skillPath,
          metadata,
        };
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills;
}
