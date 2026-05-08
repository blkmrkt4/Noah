"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  PERSONA_LABELS,
  PERSONA_DESCRIPTIONS,
  Persona,
  usePersona,
} from "./PersonaContext";

/**
 * Returns true for routes that represent the day-to-day workspace (Dashboard,
 * Projects, project detail, questionnaire, review). The persona switcher is
 * only meaningful here — Authoring Admin and Admin imply their role.
 */
function isWorkspaceRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return true;
  return false;
}

export default function WorkspaceHeader() {
  const pathname = usePathname();
  if (!isWorkspaceRoute(pathname)) return null;

  return (
    <header className="border-b border-ey-dark-gray bg-ey-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-end h-12 px-6 gap-3">
        <PersonaSwitcher />
      </div>
    </header>
  );
}

function PersonaSwitcher() {
  const { persona, setPersona, hydrated } = usePersona();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onEsc);
      return () => {
        document.removeEventListener("mousedown", onClickOutside);
        document.removeEventListener("keydown", onEsc);
      };
    }
  }, [open]);

  // Avoid flicker between SSR default and stored value.
  const label = hydrated ? PERSONA_LABELS[persona] : "Loading…";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-ey-sonic-silver/40 text-xs text-ey-light-gray hover:border-ey-yellow/60 hover:text-ey-yellow transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ey-yellow" aria-hidden />
        <span className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
          Acting as
        </span>
        <span>{label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-ey-sonic-silver/40 bg-ey-dark-gray shadow-xl z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-ey-sonic-silver/20">
            <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
              Switch persona
            </p>
            <p className="text-[11px] text-ey-light-gray mt-0.5 leading-snug">
              Demo lens — emulates which role you&apos;d see if logged in.
            </p>
          </div>
          <ul>
            {(Object.keys(PERSONA_LABELS) as Persona[]).map((p) => {
              const active = p === persona;
              return (
                <li key={p}>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setPersona(p);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      active
                        ? "bg-ey-yellow/10 border-l-2 border-ey-yellow"
                        : "border-l-2 border-transparent hover:bg-black/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          active ? "text-ey-yellow" : "text-white"
                        }`}
                      >
                        {PERSONA_LABELS[p]}
                      </span>
                      {active && (
                        <span className="text-[10px] text-ey-yellow uppercase tracking-wider">
                          current
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ey-sonic-silver mt-0.5 leading-snug">
                      {PERSONA_DESCRIPTIONS[p]}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
