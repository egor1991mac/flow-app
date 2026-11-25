import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskCreateMrResolver = {
  Mutation: {
    createTaskMr: (_parent: unknown, { id }: { id: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.createTaskMr(id),
  },
};
