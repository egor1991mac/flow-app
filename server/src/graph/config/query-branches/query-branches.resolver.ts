import type { GQLContext } from "../../../types/core.ts";

export const queryBranchesResolver = {
  Query: {
    branchNames: (_parent: unknown, args: { parentId?: string | null }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.getBranchNames(args.parentId),
  },
};
