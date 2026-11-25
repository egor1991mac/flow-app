import type { GQLContext } from "../../../types/core.ts";

export const queryTaskBranchesResolver = {
  Query: {
    taskBranches: (_parent: unknown, { taskId }: { taskId: string }, ctx: GQLContext) => ctx.dataSources.flowApi.getTaskBranches(taskId) ?? [],
  },
};
