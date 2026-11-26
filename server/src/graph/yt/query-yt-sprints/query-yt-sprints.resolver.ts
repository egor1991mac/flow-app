import type { GQLContext } from "../../../types/core.ts";

export const queryYtSprintsResolver = {
  Query: {
    ytSprints: (_parent: unknown, _args: unknown, ctx: GQLContext) =>
      ctx.dataSources.flowApi.ytSprints(),
  },
};
