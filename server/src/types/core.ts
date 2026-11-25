import type { FlowApi } from "../data-sources/index.ts";

export interface GQLContext {
  dataSources: {
    flowApi: FlowApi;
  };
}
