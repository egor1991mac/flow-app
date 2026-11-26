import type { GQLContext } from "../../../types/core.ts";
import type { YtCreateInput } from "../../../data-sources/flow-api.ts";

export const mutationYtCreateIssueResolver = {
  Mutation: {
    ytCreateIssue: (_parent: unknown, { input }: { input: YtCreateInput }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.ytCreateIssue(input),
  },
};
