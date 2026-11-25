import type { GQLContext } from "../../../types/core.ts";

export const queryJobResolver = {
  Query: {
    job: (_parent: unknown, { id }: { id: string }, ctx: GQLContext) => ctx.dataSources.flowApi.getJob(id),
  },
};
