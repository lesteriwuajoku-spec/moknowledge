import type { Metadata } from "next";
import "./globals.css";
import { KnowledgeProvider } from "@/context/KnowledgeContext";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MoKnowledge | Knowledge Builder",
  description: "Build and manage company knowledge bases for MoFlo Cloud",
};

type LayoutProps = {
  children: React.ReactNode;
  params?: Promise<Record<string, string | string[]>>;
};

export default async function RootLayout({ children, params }: Readonly<LayoutProps>) {
  // Next.js 15: unwrap params so it is not enumerated (avoids sync-dynamic-apis errors)
  if (params) await params;
  return (
    <html lang="en">
      <body>
        <KnowledgeProvider>
          <header className="border-b border-stone-200 bg-white shadow-sm">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="text-xl font-semibold text-teal-800">
                MoKnowledge
              </Link>
              <nav className="flex gap-6">
                <Link
                  href="/knowledge"
                  className="text-stone-600 hover:text-teal-700 font-medium"
                >
                  Scrape & Build
                </Link>
                <Link
                  href="/knowledge/view"
                  className="text-stone-600 hover:text-teal-700 font-medium"
                >
                  View & Manage
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </KnowledgeProvider>
      </body>
    </html>
  );
}
