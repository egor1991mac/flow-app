import type { GQLContext } from "../../../types/core.ts";

export const queryTaskStagesResolver = {
  Query: {
    taskStages: (_parent: unknown, { taskId }: { taskId: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.getTaskStages(taskId),
  },
};
