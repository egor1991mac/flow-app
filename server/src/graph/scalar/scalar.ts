import { GraphQLScalarType, valueFromASTUntyped } from "graphql";

export const jsonScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Произвольное JSON-значение из реестра",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast, variables) => valueFromASTUntyped(ast, variables),
});

export const scalarResolver = { JSON: jsonScalar };
