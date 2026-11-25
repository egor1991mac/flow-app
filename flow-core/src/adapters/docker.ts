import { spawnSync } from "node:child_process";
import type { DockerPort } from "../ports.ts";

export function composeArgs(project: string, file: string, rest: string[]): string[] {
  return ["compose", "-p", project, "-f", file, ...rest];
}

function run(args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export let lastComposeError = "";
export let lastComposeOutput = "";

export const dockerAdapter: DockerPort = {
  info() {
    return run(["info"]).status === 0;
  },
  composeVersion() {
    return run(["compose", "version"]).status === 0;
  },
  composeUp(project, file) {
    const args = ["compose", "--progress", "plain", "-p", project, "-f", file, "up", "-d"];
    if (process.env.FLOW_STREAM === "1") {
      const r = spawnSync("docker", args, { stdio: ["ignore", "inherit", "inherit"] });
      lastComposeOutput = "";
      return r.status === 0;
    }
    const r = run(args);
    lastComposeOutput = `${r.stdout}${r.stderr}`.trim();
    if (r.status !== 0) lastComposeError = r.stderr.trim() || r.stdout.trim();
    return r.status === 0;
  },
  composeDown(project, file, volumes) {
    const rest = ["down", "--remove-orphans"];
    if (volumes) rest.push("--volumes");
    return run(composeArgs(project, file, rest)).status === 0;
  },
  composePsRunning(project, file) {
    return run(composeArgs(project, file, ["ps", "-q", "--status", "running"])).stdout.trim().length > 0;
  },
  composeRestart(project, file, service) {
    return run(composeArgs(project, file, service ? ["restart", service] : ["restart"])).status === 0;
  },
  composeLogs(project, file, tail, service) {
    const rest = ["logs", "--no-log-prefix", "--tail", String(tail)];
    if (service) rest.push(service);
    return run(composeArgs(project, file, rest)).stdout;
  },
  composeExec(project, file, service, cmd) {
    return run(composeArgs(project, file, ["exec", "-T", service, ...cmd])).status === 0;
  },
  volumeInspect(name) {
    return run(["volume", "inspect", name]).status === 0;
  },
  imageInspect(name) {
    return run(["image", "inspect", name]).status === 0;
  },
  psProjects() {
    const r = spawnSync("docker", ["ps", "--format", '{{.Label "com.docker.compose.project"}}'], { encoding: "utf8" });
    return [...new Set((r.stdout ?? "").split("\n").filter(Boolean))];
  },
  get lastError() {
    return lastComposeError;
  },
  get lastOutput() {
    return lastComposeOutput;
  },
};
