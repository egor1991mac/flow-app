import express from "express";
import { expressMiddleware } from "@apollo/server/express4";
import { initApolloServer } from "./utils/apollo/init-apollo-server.ts";
import { getDataSources } from "./data-sources/index.ts";

export const createAppServer = async () => {
  const app = express();
  const apollo = await initApolloServer();

  app.use(
    "/graphql",
    express.json({ limit: "1mb" }),
    expressMiddleware(apollo, { context: async () => ({ dataSources: { flowApi: getDataSources() } }) }),
  );

  return app;
};
