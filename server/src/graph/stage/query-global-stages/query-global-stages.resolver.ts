import type { GQLContext } from "../../../types/core.ts";

export const queryGlobalStagesResolver = {
  Query: {
    globalStages: (_parent: unknown, _args: unknown, ctx: GQLContext) => ctx.dataSources.flowApi.getGlobalStages(),
  },
};
