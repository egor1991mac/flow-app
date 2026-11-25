import type { GQLContext } from "../../../types/core.ts";

export const queryConfigResolver = {
  Query: {
    config: (_parent: unknown, _args: unknown, ctx: GQLContext) => ctx.dataSources.flowApi.getConfig(),
  },
};
