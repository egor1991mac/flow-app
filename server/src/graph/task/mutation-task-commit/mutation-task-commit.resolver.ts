import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskCommitResolver = {
  Mutation: {
    commitTask: (
      _parent: unknown,
      { id, subject, type, repo }: { id: string; subject?: string | null; type?: string | null; repo?: string | null },
      ctx: GQLContext
    ) => ctx.dataSources.flowApi.commitTask(id, subject, type, repo),
  },
};
