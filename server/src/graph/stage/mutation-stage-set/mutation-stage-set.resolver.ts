import type { GQLContext } from "../../../types/core.ts";

interface StageInput {
  id: string;
  n: number;
  status: string;
  report?: string | null;
}

export const mutationStageSetResolver = {
  Mutation: {
    setStage: (_parent: unknown, { input }: { input: StageInput }, ctx: GQLContext) =>
      ctx.dataSources.flowApi.setStage(input.id, input.n, input.status, input.report),
  },
};
