import type { GQLContext } from "../../../types/core.ts";

interface ApproveStageInput {
  id: string;
  n: number;
  phrase: string;
}

export const mutationStageApproveResolver = {
  Mutation: {
    approveStage: (_parent: unknown, { input }: { input: ApproveStageInput }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.approveStage(input.id, input.n, input.phrase),
  },
};
