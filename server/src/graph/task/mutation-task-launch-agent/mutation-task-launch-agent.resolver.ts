import type { GQLContext } from "../../../types/core.ts";

export const mutationTaskLaunchAgentResolver = {
  Mutation: {
    launchAgent: (_parent: unknown, { id }: { id: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.launchAgent(id),
  },
};
