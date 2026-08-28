import data from "./hooks.data.json";

export type HookEvent = {
  event: string;
  summary: string;
  docUrl: string;
};

export const HOOKS_SOURCE = data.source;
export const HOOKS_EXTRACTED_AT = data.extractedAt;

/** Every documented hook event, in the order the reference presents them. */
export const HOOK_EVENTS: HookEvent[] = data.events;

const BY_EVENT = new Map(HOOK_EVENTS.map((e) => [e.event, e]));

export function getHookEvent(event: string): HookEvent | undefined {
  return BY_EVENT.get(event);
}

/** True when a hook found on disk fires on an event the catalog does not know. */
export function isUnknownHookEvent(event: string): boolean {
  return !BY_EVENT.has(event);
}
