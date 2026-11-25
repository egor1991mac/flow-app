import { spawnSync } from "node:child_process";
import type { HostsPort } from "../ports.ts";

function sh(cmd: string): { status: number; stdout: string } {
  const r = spawnSync("bash", ["-c", cmd], { encoding: "utf8" });
  return { status: r.status ?? 1, stdout: r.stdout ?? "" };
}

export const hostsAdapter: HostsPort = {
  commandExists(cmd) {
    return sh(`command -v ${cmd}`).status === 0;
  },
  resolveHost(host) {
    return sh(`dscacheutil -q host -a name ${host} 2>/dev/null | grep -q '^ip_address: 127\\.0\\.0\\.1$'`).status === 0;
  },
  portBusy(port) {
    return sh(`lsof -nP -iTCP:${port} -sTCP:LISTEN`).status === 0;
  },
  certSan(cert) {
    return sh(`openssl x509 -noout -text -in "${cert}" 2>/dev/null | grep -A1 'Subject Alternative Name'`).stdout;
  },
};
