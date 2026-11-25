import type { Config, Registry } from "./types.ts";

const API_REPOS = new Set(["bff", "bff-admin", "bff-mls"]);

export function repoVar(repo: string): string {
  return repo.toUpperCase().replace(/-/g, "_");
}

export function repoDomain(repo: string, config: Config): string {
  return API_REPOS.has(repo) ? config.domains.api! : config.domains[repo]!;
}

export function repoEndpoint(repo: string, port: number, config: Config): string {
  const domain = repoDomain(repo, config);
  return API_REPOS.has(repo) ? `${domain}:${port}/graphql` : `${domain}:${port}`;
}

export type Allocation = { slot: number; ports: Record<string, number>; endpoints: Record<string, string> };

export function allocatePorts(
  id: string,
  repos: string[],
  config: Config,
  registry: Registry,
  busyPorts: Set<number>,
): Allocation {
  const used = new Set<number>();
  for (const [key, t] of Object.entries(registry.tasks)) {
    if (key === id) continue;
    if ((t.status === "active" || t.status === "merged") && t.slot !== null) used.add(t.slot);
  }
  for (let slot = 0; slot < config.maxSlots; slot++) {
    if (used.has(slot)) continue;
    const ports: Record<string, number> = {};
    let busy = false;
    for (const repo of repos) {
      const port = (config.ports[repo] ?? 0) + slot * config.offsetStep;
      if (busyPorts.has(port)) {
        busy = true;
        break;
      }
      ports[repo] = port;
    }
    if (busy) continue;
    const endpoints: Record<string, string> = {};
    for (const repo of repos) endpoints[repo] = repoEndpoint(repo, ports[repo]!, config);
    return { slot, ports, endpoints };
  }
  throw new Error("all slots are busy: free some task environments first");
}

export function writeEnv(id: string, ws: string, project: string, repos: string[], config: Config, slot: number): string {
  const lines: string[] = [];
  lines.push(`COMPOSE_PROJECT_NAME=${project}`);
  lines.push(`REALT_TOOLKIT_DIR=${config.toolkitDir}`);
  for (const repo of repos) lines.push(`${repoVar(repo)}_ROOT=${ws}/${repo}`);
  for (const repo of Object.keys(config.repos)) {
    const port = (config.ports[repo] ?? 0) + slot * config.offsetStep;
    lines.push(`${repoVar(repo)}_HOST_PORT=${port}`);
  }
  return lines.join("\n") + "\n";
}

export function renderCompose(template: string, repos: string[]): string {
  const want = new Set(repos);
  const out: string[] = [];
  let skip = false;
  for (const line of template.split("\n")) {
    if (line.startsWith("# @repos ")) {
      const listed = line.split(" ").slice(2);
      skip = !listed.some((r) => want.has(r));
      continue;
    }
    if (line.startsWith("# @repos-end")) {
      skip = false;
      continue;
    }
    if (!skip) out.push(line);
  }
  return out.join("\n");
}

export function readinessOk(repo: string, httpCode: number, graphqlOk: boolean): boolean {
  if (API_REPOS.has(repo)) return graphqlOk;
  return [200, 301, 302, 404].includes(httpCode);
}
