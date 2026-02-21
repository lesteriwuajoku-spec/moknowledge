import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16 text-center">
      <h1 className="text-3xl font-bold text-teal-800">MoKnowledge</h1>
      <p className="max-w-lg text-stone-600">
        Build and manage company knowledge bases for MoFlo Cloud. Scrape a
        company website and turn it into a structured knowledge base for
        AI-powered content generation.
      </p>
      <div className="flex gap-4">
        <Link href="/knowledge" className="btn-primary">
          Scrape & Build
        </Link>
        <Link href="/knowledge/view" className="btn-secondary">
          View & Manage
        </Link>
      </div>
    </div>
  );
}
