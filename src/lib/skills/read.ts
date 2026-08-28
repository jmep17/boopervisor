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
 * Parse YAML frontmatter from SKILL.md content.
 * Frontmatter is between --- delimiters at the start of the file.
 */
function parseFrontmatter(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split("\n");

  // Skip the opening ---
  if (lines[0] !== "---") return result;

  let i = 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line === "---") break;

    // Parse key: value pairs
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key && value) {
        result[key] = value;
      }
    }
    i++;
  }

  return result;
}

/**
 * Read a single skill's metadata from its SKILL.md file.
 */
async function readSkillMetadata(
  skillPath: string
): Promise<SkillMetadata | null> {
  try {
    const skillMdPath = join(skillPath, "SKILL.md");
    const text = await readFile(skillMdPath, "utf-8");
    const frontmatter = parseFrontmatter(text);

    if (!frontmatter.name) {
      return null;
    }

    return {
      name: frontmatter.name,
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
      const metadata = await readSkillMetadata(skillPath);

      if (metadata && metadata.name) {
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
      const metadata = await readSkillMetadata(skillPath);

      if (metadata && metadata.name) {
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
