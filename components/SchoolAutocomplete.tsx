"use client";

import React, { useEffect, useRef, useState } from "react";
import { School, Loader2, Check, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface SchoolSuggestion {
  id: string;
  name: string;
  district: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Minimum characters before a query fires. Default: 2 */
  minChars?: number;
  /** Max suggestions to show. Default: 8 */
  limit?: number;
}

export default function SchoolAutocomplete({
  value,
  onChange,
  disabled = false,
  placeholder = "උදා: Royal College, Colombo",
  minChars = 2,
  limit = 8,
}: Props) {
  const [suggestions, setSuggestions] = useState<SchoolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search against the schools table.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < minChars) {
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("schools")
        .select("id, name, district")
        .ilike("name", `%${trimmed}%`)
        .order("name", { ascending: true })
        .limit(limit);

      if (cancelled) return;

      if (error) {
        console.warn("School lookup failed:", error.message);
        setSuggestions([]);
      } else {
        setSuggestions((data as SchoolSuggestion[]) ?? []);
      }
      setLoading(false);
    }, 250); // 250 ms debounce — enough to avoid hammering the DB on fast typers

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [value, minChars, limit]);

  // Dismiss on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v); // free-text is still allowed — we don't force a pick
    setOpen(true);
    setHighlight(-1);
  };

  const pickSuggestion = (s: SchoolSuggestion) => {
    onChange(s.name);
    setOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  };

  const canSearch = value.trim().length >= minChars;

  const showDropdown =
    open &&
    !disabled &&
    canSearch &&
    (loading || suggestions.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <School className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none" />

      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
      />

      {loading && canSearch && (
        <Loader2 className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
      )}

      {showDropdown && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {loading && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> සොයමින්...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-500">
              &quot;{value}&quot; සඳහා පාසලක් හමු නොවීය — ඔබට එය ලෙසම ලියා තබාගත හැක.
            </div>
          ) : (
            suggestions.map((s, idx) => {
              const isHighlighted = idx === highlight;
              const isExactlyCurrent = s.name === value;
              return (
                <button
                  type="button"
                  key={s.id}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => pickSuggestion(s)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition flex items-start gap-2 ${
                    isHighlighted ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <School className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    {s.district && (
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {s.district}
                      </p>
                    )}
                  </div>
                  {isExactlyCurrent && (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}