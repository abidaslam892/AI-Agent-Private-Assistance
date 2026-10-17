import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private AI Knowledge Assistant | Enterprise RAG",
  description: "Enterprise ChatGPT-style AI assistant running on private infrastructure with local Ollama and pgvector.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-chat-main text-white h-screen w-screen overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
