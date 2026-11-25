export interface GitPort {
  fetchBase(donor: string, base: string): boolean;
  worktreeAdd(donor: string, branch: string, path: string, start: string, createBranch: boolean): boolean;
  worktreeRemove(donor: string, path: string, force: boolean): boolean;
  branchDelete(donor: string, branch: string): boolean;
  unsetUpstream(path: string): void;
  statusPorcelain(path: string): string[];
  merge(path: string, branch: string, message: string): boolean;
  mergeAbort(path: string): void;
  logOneline(path: string): string;
  isAncestor(path: string, branch: string, target: string): boolean;
  revParseVerify(path: string, ref: string): boolean;
  forEachRef(path: string, pattern: string): string[];
  searchRefs(path: string, part: string): string[];
  diffNames(path: string, from: string, to: string): string[];
  addAll(path: string): void;
  resetFile(path: string, file: string): void;
  commit(path: string, message: string): boolean;
  checkout(path: string, ref: string): boolean;
  checkoutNew(path: string, branch: string, base: string): boolean;
  fetchFrom(path: string, source: string, ref: string): boolean;
  branchCreatedFrom(path: string, branch: string): string | null;
  readonly lastError?: string;
  remoteUrl(path: string): string | null;
}

export interface DockerPort {
  info(): boolean;
  composeVersion(): boolean;
  composeUp(project: string, file: string): boolean;
  composeDown(project: string, file: string, volumes: boolean): boolean;
  composePsRunning(project: string, file: string): boolean;
  composeRestart(project: string, file: string, service?: string): boolean;
  composeLogs(project: string, file: string, tail: number, service?: string): string;
  composeExec(project: string, file: string, service: string, cmd: string[]): boolean;
  volumeInspect(name: string): boolean;
  imageInspect(name: string): boolean;
  psProjects(): string[];
  readonly lastError?: string;
  readonly lastOutput?: string;
}

export interface YouTrackPort {
  issueView(id: string): unknown;
  issueParents(id: string): string[];
  issueSubtaskLinks?(id: string): { inward: string[]; outward: string[]; relates: string[] };
}

export interface HostsPort {
  commandExists(cmd: string): boolean;
  resolveHost(host: string): boolean;
  portBusy(port: number): boolean;
  certSan(cert: string): string;
}

export interface SpacePort {
  available(): boolean;
  registerFolder(path: string): boolean;
  registerWorktree(path: string, projectId: string): boolean;
  setWorktree(path: string, parent: string | null, display: string, comment: string): boolean;
  createTerminal(path: string, title: string, command: string): boolean;
  createTab(path: string, url: string): boolean;
  launchAgent(path: string, prompt: string): boolean;
  hideRepo(path: string): boolean;
  closeTerminals(path: string): void;
  closeTabs(path: string): void;
}

export interface AgentPort {
  launchChat(workdir: string, prompt: string): boolean;
  hasActiveAgent(workdir: string): boolean;
}
