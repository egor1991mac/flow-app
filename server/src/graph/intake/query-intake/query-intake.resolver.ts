import type { GQLContext } from "../../../types/core.ts";

export const queryIntakeResolver = {
  Query: {
    intake: (_parent: unknown, { input }: { input: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.intake(input),
  },
};
