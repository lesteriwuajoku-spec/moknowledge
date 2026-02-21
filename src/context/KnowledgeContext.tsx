"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { KnowledgeBase } from "@/types/knowledge";

const STORAGE_KEY = "moknowledge-bases";

type KnowledgeContextValue = {
  knowledgeBases: KnowledgeBase[];
  addKnowledgeBase: (kb: KnowledgeBase) => void;
  updateKnowledgeBase: (id: string, update: Partial<KnowledgeBase>) => void;
  deleteKnowledgeBase: (id: string) => void;
  getKnowledgeBase: (id: string) => KnowledgeBase | undefined;
};

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

function loadFromStorage(): KnowledgeBase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as KnowledgeBase[];
  } catch {
    return [];
  }
}

function saveToStorage(list: KnowledgeBase[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function KnowledgeProvider(props: { children: React.ReactNode }) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setKnowledgeBases(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveToStorage(knowledgeBases);
  }, [knowledgeBases, hydrated]);

  const addKnowledgeBase = useCallback((kb: KnowledgeBase) => {
    setKnowledgeBases((prev) => [kb, ...prev]);
  }, []);

  const updateKnowledgeBase = useCallback((id: string, update: Partial<KnowledgeBase>) => {
    setKnowledgeBases((prev) =>
      prev.map((kb) => (kb.id === id ? { ...kb, ...update } : kb))
    );
  }, []);

  const deleteKnowledgeBase = useCallback((id: string) => {
    setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
  }, []);

  const getKnowledgeBase = useCallback(
    (id: string) => knowledgeBases.find((kb) => kb.id === id),
    [knowledgeBases]
  );

  const value: KnowledgeContextValue = {
    knowledgeBases,
    addKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    getKnowledgeBase,
  };

  return (
    <KnowledgeContext.Provider value={value}>
      {props.children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error("useKnowledge must be used within KnowledgeProvider");
  return ctx;
}
