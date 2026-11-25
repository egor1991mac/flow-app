import type { GQLContext } from "../../../types/core.ts";

export const queryBranchesResolver = {
  Query: {
    branchNames: (_parent: unknown, _args: unknown, ctx: GQLContext) => ctx.dataSources.flowApi.getBranchNames(),
  },
};
