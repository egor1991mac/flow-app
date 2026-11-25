import type { Config } from "./types.ts";

export function resolveRepos(input: string, config: Config, withPairs = true): string[] {
  const set = new Set<string>();
  for (const repo of input.split(/[,;\s]+/).filter(Boolean)) {
    if (!(repo in config.repos)) {
      throw new Error(`unknown repository: ${repo} (known: ${Object.keys(config.repos).join(", ")})`);
    }
    set.add(repo);
    const pair = config.repos[repo]?.pair;
    if (withPairs && pair) set.add(pair);
  }
  return Object.keys(config.repos).filter((r) => set.has(r));
}
