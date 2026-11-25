import path from "node:path";
import { runCli } from "../src/cli.ts";
import { gitAdapter } from "../src/adapters/git.ts";
import { dockerAdapter } from "../src/adapters/docker.ts";
import { youtrackAdapter } from "../src/adapters/youtrack.ts";
import { hostsAdapter } from "../src/adapters/hosts.ts";
import { orcaSpace, noopSpace, orcaAvailable } from "../src/adapters/space-orca.ts";
import { opencodeAgent } from "../src/adapters/agent-opencode.ts";

const home = process.env.ORCA_FLOW_HOME ?? path.join(process.env.HOME, "orca/workspaces/all-projects");
const metaDir = path.join(home, ".orca-flow");
const argv = process.argv.slice(2);

try {
  runCli(argv, {
    metaDir,
    git: gitAdapter,
    docker: dockerAdapter,
    youtrack: youtrackAdapter,
    hosts: hostsAdapter,
    space: orcaAvailable() ? orcaSpace : noopSpace,
    agent: opencodeAgent,
    out: (s) => process.stdout.write(s + "\n"),
    err: (s) => process.stderr.write(s + "\n"),
    startStack: argv.includes("--start"),
    assumeYes: argv.includes("--yes"),
  });
} catch {
  process.exitCode = 1;
}
