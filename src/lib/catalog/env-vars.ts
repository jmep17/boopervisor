import data from "./env-vars.data.json";

export type EnvVar = {
  name: string;
  /** The reference's own words. Code spans are backticked; render with `withCodeSpans`. */
  purpose: string;
  /** Read by presence: any non-empty value turns it on, only unsetting turns it off. */
  presenceOnly: boolean;
  docUrl: string;
};

export const ENV_VARS_SOURCE = data.source;
export const ENV_VARS_EXTRACTED_AT = data.extractedAt;
/** Every documented variable, sorted by name. */
export const ENV_VARS: EnvVar[] = data.variables;
const BY_NAME = new Map(ENV_VARS.map((v) => [v.name, v]));
export function getEnvVar(name: string): EnvVar | undefined {
  return BY_NAME.get(name);
}
export function isUnknownEnvVar(name: string): boolean {
  return !BY_NAME.has(name);
}
