"use client";

import { useCallback, useState } from "react";
import { useKnowledge } from "@/context/KnowledgeContext";
import type { KnowledgeBase } from "@/types/knowledge";
import { KnowledgeEditor } from "@/components/KnowledgeEditor";

export default function KnowledgePage() {
  const { addKnowledgeBase } = useKnowledge();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeBase | null>(null);
  const [saved, setSaved] = useState(false);

  const handleScrape = useCallback(async () => {
    const input = url.trim();
    if (!input) {
      setError("Please enter a website URL.");
      return;
    }
    setError(null);
    setLoading(true);
    setKnowledge(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scrape failed");
        return;
      }
      if (data.success && data.knowledge) {
        setKnowledge(data.knowledge);
      } else {
        setError("No data returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleSave = useCallback(() => {
    if (!knowledge) return;
    addKnowledgeBase(knowledge);
    setSaved(true);
  }, [knowledge, addKnowledgeBase]);

  const handleUpdate = useCallback((updated: KnowledgeBase) => {
    setKnowledge(updated);
    setSaved(false);
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-teal-800">Scrape & Build</h1>

      <div className="card p-6">
        <label htmlFor="url" className="mb-2 block font-medium text-stone-700">
          Company website URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            className="input-field flex-1"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={loading}
            className="btn-primary whitespace-nowrap"
          >
            {loading ? "Scraping…" : "Scrape website"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      {loading && (
        <div className="card flex items-center justify-center gap-3 p-8 text-stone-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <span>Fetching and parsing website…</span>
        </div>
      )}

      {knowledge && !loading && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-stone-600">
              Source: <a href={knowledge.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{knowledge.sourceUrl}</a>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saved}
                className="btn-primary disabled:opacity-70"
              >
                {saved ? "Saved" : "Save knowledge base"}
              </button>
            </div>
          </div>
          <KnowledgeEditor knowledge={knowledge} onChange={handleUpdate} />
        </>
      )}
    </div>
  );
}
