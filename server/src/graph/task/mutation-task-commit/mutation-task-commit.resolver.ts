import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskCommitResolver = {
  Mutation: {
    commitTask: (
      _parent: unknown,
      { id, subject }: { id: string; subject?: string | null },
      ctx: GQLContext
    ) => ctx.dataSources.flowApi.commitTask(id, subject),
  },
};
