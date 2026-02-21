"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useKnowledge } from "@/context/KnowledgeContext";
import type { KnowledgeBase } from "@/types/knowledge";

type ViewMode = "card" | "table" | "detail";

export default function ViewPage() {
  const { knowledgeBases, deleteKnowledgeBase, getKnowledgeBase } = useKnowledge();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return knowledgeBases;
    const q = search.toLowerCase();
    return knowledgeBases.filter(
      (kb) =>
        kb.sourceUrl.toLowerCase().includes(q) ||
        kb.companyFoundation.overview?.toLowerCase().includes(q) ||
        kb.companyFoundation.website?.toLowerCase().includes(q) ||
        kb.companyFoundation.alternativeNames?.some((n) => n.toLowerCase().includes(q))
    );
  }, [knowledgeBases, search]);

  const selected = selectedId ? getKnowledgeBase(selectedId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-teal-800">View & Manage</h1>
        <Link href="/knowledge" className="btn-primary">
          New scrape
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search by URL, overview, name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field flex-1"
          />
          <div className="flex rounded-lg border border-stone-300 overflow-hidden">
            {(["card", "table", "detail"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-2 text-sm font-medium capitalize ${
                  viewMode === mode
                    ? "bg-teal-600 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-stone-500">
          {knowledgeBases.length === 0
            ? "No knowledge bases yet. Scrape a website from the Scrape & Build page."
            : "No results match your search."}
        </div>
      ) : viewMode === "card" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((kb) => (
            <KnowledgeCard
              key={kb.id}
              kb={kb}
              isSelected={selectedId === kb.id}
              onSelect={() => setSelectedId(selectedId === kb.id ? null : kb.id)}
              onDelete={() => {
                if (confirm("Delete this knowledge base?")) deleteKnowledgeBase(kb.id);
                setSelectedId(null);
              }}
            />
          ))}
        </div>
      ) : viewMode === "table" ? (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 font-medium">Source URL</th>
                <th className="px-4 py-3 font-medium">Scraped</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kb) => (
                <tr key={kb.id} className="border-t border-stone-200 hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <a
                      href={kb.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:underline"
                    >
                      {kb.sourceUrl}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {new Date(kb.scrapedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(kb.id)}
                      className="text-teal-600 hover:underline mr-2"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this knowledge base?")) deleteKnowledgeBase(kb.id);
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((kb) => (
            <DetailedKnowledgeBlock
              key={kb.id}
              kb={kb}
              onDelete={() => {
                if (confirm("Delete this knowledge base?")) deleteKnowledgeBase(kb.id);
              }}
            />
          ))}
        </div>
      )}

      {selected && (
        <DetailModal
          kb={selected}
          onClose={() => setSelectedId(null)}
          onDelete={() => {
            deleteKnowledgeBase(selected.id);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function KnowledgeCard({
  kb,
  isSelected,
  onSelect,
  onDelete,
}: {
  kb: KnowledgeBase;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const title =
    kb.companyFoundation.alternativeNames?.[0] ||
    kb.companyFoundation.website ||
    kb.sourceUrl;
  const desc = kb.companyFoundation.overview?.slice(0, 120);
  return (
    <div
      className={`card cursor-pointer p-4 transition-shadow hover:shadow-md ${
        isSelected ? "ring-2 ring-teal-500" : ""
      }`}
      onClick={onSelect}
    >
      <h3 className="font-medium text-stone-800 truncate">{title}</h3>
      {desc && <p className="mt-1 text-sm text-stone-600 line-clamp-2">{desc}</p>}
      <p className="mt-2 text-xs text-stone-400">
        {new Date(kb.scrapedAt).toLocaleDateString()}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="text-sm text-teal-600 hover:underline"
        >
          {isSelected ? "Hide" : "Details"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-sm text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function DetailedKnowledgeBlock({
  kb,
  onDelete,
}: {
  kb: KnowledgeBase;
  onDelete: () => void;
}) {
  const title =
    kb.companyFoundation.alternativeNames?.[0] ||
    kb.companyFoundation.website ||
    kb.sourceUrl;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div>
          <h3 className="font-medium text-stone-800">{title}</h3>
          <a
            href={kb.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-teal-600 hover:underline"
          >
            {kb.sourceUrl}
          </a>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-sm text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
      <div className="max-h-48 overflow-auto space-y-4 p-4 text-sm text-stone-600">
        {kb.companyFoundation.overview && (
          <p className="line-clamp-4">{kb.companyFoundation.overview}</p>
        )}
        {kb.keyPeople && kb.keyPeople.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-stone-700">Key people</p>
            <ul className="space-y-1 text-stone-600">
              {kb.keyPeople.slice(0, 5).map((p, i) => (
                <li key={i}>
                  {p.name}
                  {p.title || p.role ? ` — ${[p.title, p.role].filter(Boolean).join(", ")}` : ""}
                  {(p.email || p.phone) && ` · ${[p.email, p.phone].filter(Boolean).join(" · ")}`}
                </li>
              ))}
              {kb.keyPeople.length > 5 && <li className="text-stone-500">+{kb.keyPeople.length - 5} more</li>}
            </ul>
          </div>
        )}
        <p className="mt-2 text-xs text-stone-400">
          Scraped: {new Date(kb.scrapedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function DetailModal({
  kb,
  onClose,
  onDelete,
}: {
  kb: KnowledgeBase;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="font-semibold text-stone-800">
            {kb.companyFoundation.alternativeNames?.[0] || kb.sourceUrl}
          </h2>
          <div className="flex gap-2">
            <a
              href={kb.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm"
            >
              Open site
            </a>
            <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:underline">
              Delete
            </button>
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Close
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4 space-y-4">
          {kb.keyPeople && kb.keyPeople.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
              <h3 className="mb-2 font-medium text-stone-800">Key people</h3>
              <ul className="space-y-2 text-sm text-stone-700">
                {kb.keyPeople.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium">{p.name}</span>
                    {(p.title || p.role) && <span className="text-stone-600"> — {[p.title, p.role].filter(Boolean).join(", ")}</span>}
                    {(p.email || p.phone) && (
                      <p className="mt-0.5 text-stone-500 text-xs">{[p.email, p.phone].filter(Boolean).join(" · ")}</p>
                    )}
                    {p.description && <p className="mt-0.5 pl-0 text-stone-600">{p.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
