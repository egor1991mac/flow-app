import type { Metadata } from "next";
import { ApolloProvider } from "@/lib/apollo/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "flow — задачи, этапы, память",
  description: "UI и API для управления задачами REALT: дерево задач, этапы, векторный поиск по памяти",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ApolloProvider>{children}</ApolloProvider>
      </body>
    </html>
  );
}
