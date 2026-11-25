import type { GQLContext } from "../../../types/core.ts";

export const queryTasksResolver = {
  Query: {
    tasks: (_parent: unknown, _args: unknown, ctx: GQLContext) =>
      ctx.dataSources.flowApi.getTasks(),
  },
};
