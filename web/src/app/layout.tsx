import { ApolloProvider } from "@/lib/apollo/client";

import type { Metadata } from "next";
import type { FC, ReactNode } from "react";

import "./globals.css";

interface RootLayoutProps {
  children: ReactNode;
}

export const metadata: Metadata = {
  title: "flow — задачи, этапы, память",
  description:
    "UI и API для управления задачами REALT: дерево задач, этапы, векторный поиск по памяти",
};

const RootLayout: FC<RootLayoutProps> = ({ children }) => (
  <html lang="ru">
    <body>
      <ApolloProvider>{children}</ApolloProvider>
    </body>
  </html>
);

export default RootLayout;
