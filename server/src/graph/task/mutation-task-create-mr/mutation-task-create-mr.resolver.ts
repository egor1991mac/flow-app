import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskCreateMrResolver = {
  Mutation: {
    createTaskMr: (_parent: unknown, { id, repo }: { id: string; repo?: string | null }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.createTaskMr(id, repo),
  },
};
