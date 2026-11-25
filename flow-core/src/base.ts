import type { Config } from "./types.ts";

export function normalizeRef(ref: string): string {
  let r = ref.replace(/\/$/, "");
  const treeDash = r.indexOf("/-/tree/");
  const tree = r.indexOf("/tree/");
  if (treeDash !== -1) r = r.slice(treeDash + "/-/tree/".length);
  else if (tree !== -1) r = r.slice(tree + "/tree/".length);
  return r.replace(/^origin\//, "");
}

export function explicitRef(ref: string, originRefs: string[], headRefs: string[]): string | null {
  if (originRefs.includes(`origin/${ref}`)) return `origin/${ref}`;
  if (headRefs.includes(ref)) return ref;
  return null;
}

export function parentRefTry(parent: string, originRefs: string[], headRefs: string[]): string[] {
  let refs = originRefs.filter((r) => r.includes(parent));
  if (refs.length === 0) refs = headRefs.filter((r) => r.includes(parent));
  return refs;
}

export type StartContext = {
  repo: string;
  baseRef: string | null;
  forceBase: boolean;
  featureBranch: string | null;
  external: boolean;
  parent: string | null;
  originRefs: string[];
  headRefs: string[];
  config: Config;
};

export type StartDecision =
  | { action: "explicit"; ref: string | null }
  | { action: "base"; ref: string }
  | { action: "feature"; ref: string }
  | { action: "parent"; ref: string }
  | { action: "error"; message: string };

export function resolveStartPoint(ctx: StartContext): StartDecision {
  const configBase = ctx.config.repos[ctx.repo]?.baseBranch ?? "";
  if (ctx.baseRef) return { action: "explicit", ref: explicitRef(ctx.baseRef, ctx.originRefs, ctx.headRefs) };
  if (ctx.forceBase) return { action: "base", ref: configBase };
  if (ctx.featureBranch) return { action: "feature", ref: ctx.featureBranch };
  if (ctx.external && ctx.parent) {
    const refs = parentRefTry(ctx.parent, ctx.originRefs, ctx.headRefs);
    if (refs.length === 0) return { action: "error", message: `no branch for ${ctx.parent} in ${ctx.repo}` };
    if (refs.length > 1) return { action: "error", message: `ambiguous branch for ${ctx.parent} in ${ctx.repo}: ${refs.join(" ")}` };
    return { action: "parent", ref: refs[0]! };
  }
  return { action: "base", ref: configBase };
}

export function externalBaseUnresolved(repos: string[], parent: string, refsByRepo: Record<string, { origin: string[]; heads: string[] }>): boolean {
  return repos.some((repo) => {
    const r = refsByRepo[repo] ?? { origin: [], heads: [] };
    return parentRefTry(parent, r.origin, r.heads).length !== 1;
  });
}

export type AskBaseAnswer = { fromBase: boolean; manualRef?: string };

export function askBaseDecision(answer: AskBaseAnswer): { forceBase: boolean; baseRef: string | null } {
  if (answer.fromBase) return { forceBase: true, baseRef: null };
  const ref = (answer.manualRef ?? "").trim();
  if (!ref) return { forceBase: false, baseRef: null };
  return { forceBase: false, baseRef: normalizeRef(ref) };
}

export function adoptDecision(opts: { external: boolean; noFeature: boolean; baseRef: string | null; adoptFlag: boolean; userSaysYes: boolean }): boolean {
  if (!opts.external || opts.noFeature || !opts.baseRef) return false;
  return opts.adoptFlag || opts.userSaysYes;
}
