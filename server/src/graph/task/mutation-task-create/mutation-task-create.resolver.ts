import type { GQLContext } from "../../../types/core.ts";
import type { CreateTaskInput } from "../../../data-sources/flow-api.ts";

export const mutationTaskCreateResolver = {
  Mutation: {
    createTask: (_parent: unknown, { input }: { input: CreateTaskInput }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.createTask(input),
  },
};
