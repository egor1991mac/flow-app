"use client";

import { ApolloClient, ApolloProvider as Provider, HttpLink, InMemoryCache } from "@apollo/client";
import { useState } from "react";

import type { FC, ReactNode } from "react";

interface ApolloProviderProps {
  children: ReactNode;
}

export const ApolloProvider: FC<ApolloProviderProps> = ({ children }) => {
  const [client] = useState(
    () =>
      new ApolloClient({
        link: new HttpLink({ uri: "/graphql" }),
        cache: new InMemoryCache(),
      })
  );
  return <Provider client={client}>{children}</Provider>;
};
