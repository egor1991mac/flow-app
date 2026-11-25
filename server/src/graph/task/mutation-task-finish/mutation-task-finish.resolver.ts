import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskFinishResolver = {
  Mutation: {
    finishTask: (
      _parent: unknown,
      { id, yes, dryRun }: { id: string; yes?: boolean | null; dryRun?: boolean | null },
      ctx: GQLContext
    ) => ctx.dataSources.flowApi.finishTask(id, yes === true, dryRun === true),
  },
};
