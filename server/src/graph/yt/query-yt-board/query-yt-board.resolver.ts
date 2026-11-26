import type { GQLContext } from "../../../types/core.ts";

export const queryYtBoardResolver = {
  Query: {
    ytBoard: (
      _parent: unknown,
      { query, limit }: { query: string; limit?: number | null },
      ctx: GQLContext
    ) => ctx.dataSources.flowApi.ytBoard(query, limit ?? 300),
  },
};
