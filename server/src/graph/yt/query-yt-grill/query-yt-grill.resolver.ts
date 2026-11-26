import type { GQLContext } from "../../../types/core.ts";

export const queryYtGrillResolver = {
  Query: {
    ytGrill: (_parent: unknown, { slug }: { slug: string }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.ytGrill(slug),
  },
};
