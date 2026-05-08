"use client";

import { useEffect, useMemo, useState } from "react";

export type JurisdictionScope =
  | null
  | { mode: "include" | "exclude"; codes: string[] };

interface Country {
  id: string;
  code: string;
  name: string;
}
interface Region {
  id: string;
  name: string;
  shortName: string;
  countries: Country[];
}

export function JurisdictionPicker({
  value,
  onChange,
}: {
  value: JurisdictionScope;
  onChange: (next: JurisdictionScope) => void;
}) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/jurisdictions")
      .then((r) => r.json())
      .then((d) => setRegions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const mode = value?.mode ?? "global";
  const codes = useMemo(() => new Set(value?.codes ?? []), [value]);

  function setMode(m: "global" | "include" | "exclude") {
    if (m === "global") {
      onChange(null);
      return;
    }
    onChange({ mode: m, codes: [...codes] });
  }

  function toggleCountry(code: string) {
    if (!value) return;
    const next = new Set(codes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange({ mode: value.mode, codes: [...next] });
  }

  function toggleRegion(region: Region) {
    if (!value) return;
    const all = region.countries.map((c) => c.code);
    const next = new Set(codes);
    const allSelected = all.every((c) => next.has(c));
    if (allSelected) all.forEach((c) => next.delete(c));
    else all.forEach((c) => next.add(c));
    onChange({ mode: value.mode, codes: [...next] });
  }

  const filteredRegions = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return regions;
    return regions
      .map((r) => ({
        ...r,
        countries: r.countries.filter(
          (c) =>
            c.name.toLowerCase().includes(f) ||
            c.code.toLowerCase().includes(f) ||
            r.name.toLowerCase().includes(f) ||
            r.shortName.toLowerCase().includes(f)
        ),
      }))
      .filter((r) => r.countries.length > 0);
  }, [regions, filter]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <ModeTab
          active={mode === "global"}
          label="Global"
          onClick={() => setMode("global")}
        />
        <ModeTab
          active={mode === "include"}
          label="Specific countries"
          onClick={() => setMode("include")}
        />
        <ModeTab
          active={mode === "exclude"}
          label="Global except"
          onClick={() => setMode("exclude")}
        />
      </div>

      {mode === "global" ? (
        <p className="text-xs text-ey-sonic-silver">
          Applies to all jurisdictions.
        </p>
      ) : (
        <div className="border border-ey-sonic-silver/30 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-ey-sonic-silver/20 flex items-center justify-between gap-3 bg-black/40">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter regions or countries…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-ey-sonic-silver focus:outline-none"
            />
            <span className="text-[11px] text-ey-sonic-silver shrink-0">
              {codes.size}{" "}
              {mode === "include" ? "selected" : "excluded"}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-2 text-xs text-ey-sonic-silver">Loading…</p>
            ) : (
              filteredRegions.map((r) => (
                <RegionRow
                  key={r.id}
                  region={r}
                  expanded={expandedRegion === r.id || filter.trim().length > 0}
                  onToggleExpand={() =>
                    setExpandedRegion((cur) => (cur === r.id ? null : r.id))
                  }
                  selected={codes}
                  onToggleCountry={toggleCountry}
                  onToggleRegion={() => toggleRegion(r)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-ey-yellow text-black"
          : "bg-ey-dark-gray text-ey-light-gray border border-ey-sonic-silver/40 hover:border-ey-yellow/50"
      }`}
    >
      {label}
    </button>
  );
}

function RegionRow({
  region,
  expanded,
  onToggleExpand,
  selected,
  onToggleCountry,
  onToggleRegion,
}: {
  region: Region;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: Set<string>;
  onToggleCountry: (code: string) => void;
  onToggleRegion: () => void;
}) {
  const all = region.countries.map((c) => c.code);
  const selectedHere = all.filter((c) => selected.has(c)).length;
  const allSelected = selectedHere === all.length && all.length > 0;
  const someSelected = selectedHere > 0 && !allSelected;
  return (
    <div className="border-b border-ey-sonic-silver/15 last:border-0">
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-black/30">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={onToggleRegion}
          className="accent-ey-yellow"
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 text-left text-xs text-white"
        >
          <span className="font-medium">{region.name}</span>
          <span className="text-ey-sonic-silver ml-2">
            {selectedHere}/{all.length}
          </span>
        </button>
        <span className="text-ey-sonic-silver text-xs">
          {expanded ? "−" : "+"}
        </span>
      </div>
      {expanded && (
        <ul className="pl-8 pr-3 pb-2 space-y-0.5">
          {region.countries.map((c) => (
            <li key={c.code} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id={`jp-${c.code}`}
                checked={selected.has(c.code)}
                onChange={() => onToggleCountry(c.code)}
                className="accent-ey-yellow"
              />
              <label
                htmlFor={`jp-${c.code}`}
                className="text-ey-light-gray cursor-pointer flex-1"
              >
                {c.name}
              </label>
              <code className="text-[10px] text-ey-sonic-silver">{c.code}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function summarizeScope(value: JurisdictionScope): string {
  if (!value) return "Global";
  if (value.mode === "include") {
    if (value.codes.length === 0) return "No countries selected";
    if (value.codes.length <= 3) return value.codes.join(", ");
    return `${value.codes.length} countries`;
  }
  if (value.codes.length === 0) return "Global";
  if (value.codes.length <= 3) return `Global except ${value.codes.join(", ")}`;
  return `Global except ${value.codes.length} countries`;
}
