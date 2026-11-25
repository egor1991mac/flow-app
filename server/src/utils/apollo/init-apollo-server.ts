import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApolloServer } from "@apollo/server";
import { resolvers } from "../../graph/resolvers.ts";
import type { GQLContext } from "../../types/core.ts";

const GRAPH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../graph");

const readTypeDefs = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return readTypeDefs(full);
    return entry.name.endsWith(".gql") ? [fs.readFileSync(full, "utf8")] : [];
  });

export const initApolloServer = async (): Promise<ApolloServer<GQLContext>> => {
  const server = new ApolloServer<GQLContext>({ typeDefs: readTypeDefs(GRAPH_DIR), resolvers });
  await server.start();
  return server;
};
