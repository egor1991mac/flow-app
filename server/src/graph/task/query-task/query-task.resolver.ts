import type { GQLContext } from "../../../types/core.ts";

export const queryTaskResolver = {
  Query: {
    task: (_parent: unknown, { id }: { id: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.getTask(id),
  },
};
