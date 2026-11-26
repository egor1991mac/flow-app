import type { GQLContext } from "../../../types/core.ts";

export const queryYtUsersResolver = {
  Query: {
    ytUsers: (
      _parent: unknown,
      { query, limit }: { query?: string | null; limit?: number | null },
      ctx: GQLContext
    ) => ctx.dataSources.flowApi.ytUsers(query ?? "", limit ?? 100),
  },
};
