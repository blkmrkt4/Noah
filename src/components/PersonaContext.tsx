"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Persona =
  | "commercial_owner"
  | "section_lead"
  | "question_collaborator"
  | "reviewer";

export const PERSONA_LABELS: Record<Persona, string> = {
  commercial_owner: "Commercial Owner",
  section_lead: "Section Lead",
  question_collaborator: "Question Collaborator",
  reviewer: "Reviewer",
};

export const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
  commercial_owner: "Answers, attests, and submits.",
  section_lead: "A Collaborator handling a delegated section.",
  question_collaborator: "A Collaborator answering a single delegated question.",
  reviewer: "Evaluates dispositioned answers in their domain.",
};

const STORAGE_KEY = "arc.persona";
const DEFAULT_PERSONA: Persona = "commercial_owner";

interface PersonaContextValue {
  persona: Persona;
  setPersona: (p: Persona) => void;
  hydrated: boolean;
}

const PersonaCtx = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>(DEFAULT_PERSONA);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && stored in PERSONA_LABELS) {
        setPersonaState(stored as Persona);
      }
    } catch {
      // Storage unavailable (privacy mode, SSR fallback) — keep default.
    }
    setHydrated(true);
  }, []);

  function setPersona(p: Persona) {
    setPersonaState(p);
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // No-op; demo state lives in memory for this session.
    }
  }

  return (
    <PersonaCtx.Provider value={{ persona, setPersona, hydrated }}>
      {children}
    </PersonaCtx.Provider>
  );
}

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaCtx);
  if (!ctx) {
    throw new Error("usePersona must be used inside a PersonaProvider");
  }
  return ctx;
}
