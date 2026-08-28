import type { JsonObject } from "./json-file";

/**
 * A catalog key like `permissions.allow` names a key nested inside `permissions`, not a
 * top-level key with a dot in its name. Reading and writing both address settings through
 * these functions so the two agree on where a key lives.
 */
export function pathOf(key: string): string[] {
  return key.split(".");
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The value at a key's path, or undefined where any step of the path is not there. */
export function getAtPath(content: JsonObject, key: string): unknown {
  let current: unknown = content;
  for (const step of pathOf(key)) {
    if (!isObject(current)) return undefined;
    current = current[step];
  }
  return current;
}

/** Whether the key is present, which is not the same as holding a value. */
export function hasAtPath(content: JsonObject, key: string): boolean {
  const path = pathOf(key);
  let current: unknown = content;
  for (const step of path.slice(0, -1)) {
    if (!isObject(current)) return false;
    current = current[step];
  }
  return isObject(current) && path[path.length - 1] in current;
}

/**
 * A copy with the key set, creating the objects along the way. Nothing is mutated, so the
 * caller's content — and every key it holds that Boopervisor knows nothing about — survives.
 */
export function setAtPath(
  content: JsonObject,
  key: string,
  value: unknown
): JsonObject {
  const [step, ...rest] = pathOf(key);
  if (rest.length === 0) return { ...content, [step]: value };

  const existing = content[step];
  return {
    ...content,
    [step]: setAtPath(
      isObject(existing) ? existing : {},
      rest.join("."),
      value
    ),
  };
}

/**
 * A copy with the key removed. A container the removal leaves empty goes too: an empty
 * `permissions` object says something a missing one does not.
 */
export function deleteAtPath(content: JsonObject, key: string): JsonObject {
  const [step, ...rest] = pathOf(key);
  if (!(step in content)) return content;

  const next = { ...content };
  if (rest.length === 0) {
    delete next[step];
    return next;
  }

  const existing = next[step];
  if (!isObject(existing)) return content;

  const pruned = deleteAtPath(existing, rest.join("."));
  if (Object.keys(pruned).length === 0) delete next[step];
  else next[step] = pruned;
  return next;
}

/**
 * Every settable path a file holds, as the catalog addresses them: a top-level key the
 * catalog describes stays whole, and one it only describes the insides of is walked into.
 * This is how a key on disk that the catalog does not describe is found at any depth.
 */
export function settingPaths(
  content: JsonObject,
  describes: (key: string) => boolean,
  prefix = ""
): string[] {
  return Object.entries(content).flatMap(([step, value]) => {
    const key = prefix ? `${prefix}.${step}` : step;
    if (describes(key) || !isObject(value)) return [key];
    const nested = settingPaths(value, describes, key);
    // An object the catalog says nothing about is one uncatalogued key, not many.
    return nested.length > 0 ? nested : [key];
  });
}
