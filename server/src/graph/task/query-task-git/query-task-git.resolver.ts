import type { GQLContext } from "../../../types/core.ts";

export const queryTaskGitResolver = {
  Query: {
    taskGit: (_parent: unknown, { taskId }: { taskId: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.getTaskGit(taskId),
  },
};
