import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskMergeResolver = {
  Mutation: {
    mergeTask: (_parent: unknown, { id, yes }: { id: string; yes?: boolean | null }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.mergeTask(id, yes === true),
  },
};
