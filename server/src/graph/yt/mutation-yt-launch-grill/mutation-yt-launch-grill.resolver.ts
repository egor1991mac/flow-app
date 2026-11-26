import type { GQLContext } from "../../../types/core.ts";

export const mutationYtLaunchGrillResolver = {
  Mutation: {
    launchGrill: (
      _parent: unknown,
      { slug, prompt }: { slug: string; prompt: string },
      ctx: GQLContext
    ) => ctx.dataSources.flowApi.launchGrill(slug, prompt),
  },
};
