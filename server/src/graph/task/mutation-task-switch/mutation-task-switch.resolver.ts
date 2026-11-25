import type { GQLContext } from "../../../types/core.ts";
import type { SwitchTaskInput } from "../../../data-sources/flow-api.ts";

export const mutationTaskSwitchResolver = {
  Mutation: {
    switchTask: (_parent: unknown, { input }: { input: SwitchTaskInput }, ctx: GQLContext) => ctx.dataSources.flowApi.switchTask(input),
  },
};
