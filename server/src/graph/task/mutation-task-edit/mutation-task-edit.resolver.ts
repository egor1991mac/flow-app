import type { GQLContext } from "../../../types/core.ts";
import type { EditTaskInput } from "../../../data-sources/flow-api.ts";

export const mutationTaskEditResolver = {
  Mutation: {
    editTask: (_parent: unknown, { input }: { input: EditTaskInput }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.editTask(input),
  },
};
