import type { GQLContext } from "../../../types/core.ts";

export const querySearchResolver = {
  Query: {
    search: (_parent: unknown, { q }: { q: string }, ctx: GQLContext) => ctx.dataSources.flowApi.search(q),
  },
};
