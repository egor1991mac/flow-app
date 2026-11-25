import type { GQLContext } from "../../../types/core.ts";

export const queryTaskJournalResolver = {
  Query: {
    taskJournal: (_parent: unknown, { taskId }: { taskId: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.getTaskJournal(taskId),
  },
};
