import type { GQLContext } from "../../../types/core.ts";

export const queryHealthResolver = {
  Query: {
    health: (_parent: unknown, _args: unknown, ctx: GQLContext) => ({
      ok: true,
      home: ctx.dataSources.flowApi.home,
    }),
  },
};
