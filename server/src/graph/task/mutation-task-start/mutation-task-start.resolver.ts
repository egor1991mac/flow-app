import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskStartResolver = {
  Mutation: {
    startTask: (
      _parent: unknown,
      { id, start }: { id: string; start?: boolean | null },
      ctx: GQLContext
    ) => ctx.dataSources.flowApi.startTask(id, start === true),
  },
};
