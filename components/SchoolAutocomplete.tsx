"use client";

import React, { useEffect, useRef, useState } from "react";
import { School, Loader2, Check, MapPin, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export interface SchoolSuggestion {
  id: string;
  name: string;
  district: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;

  /**
   * Fires with a school object when the user picks one from the
   * dropdown, or `null` when the input is edited / cleared /
   * changed externally by the parent.
   */
  onConfirm?: (school: SchoolSuggestion | null) => void;

  disabled?: boolean;
  placeholder?: string;
  /** Minimum characters before a query fires. Default: 2 */
  minChars?: number;
  /** Max suggestions to show. Default: 8 */
  limit?: number;
  /**
   * When true, the field shows a red/amber border if the current
   * value doesn't match a confirmed selection from `public.schools`.
   * The parent still needs to block submit on unconfirmed values.
   */
  strict?: boolean;
}

const LISTBOX_ID = "school-suggestion-listbox";

export default function SchoolAutocomplete({
  value,
  onChange,
  onConfirm,
  disabled = false,
  placeholder = "උදා: Royal College, Colombo",
  minChars = 2,
  limit = 8,
  strict = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<SchoolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [confirmed, setConfirmed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // Tracks the name we confirmed, so we can detect external value changes.
  const lastConfirmedNameRef = useRef<string | null>(null);

  // Debounced search against the schools table.
  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.length < minChars) {
      // Defer the state reset to a macrotask so we don't call setState
      // synchronously inside the effect body (react-hooks/set-state-in-effect).
      const clearHandle = window.setTimeout(() => {
        setSuggestions([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(clearHandle);
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
    }, 250);

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

  // If the parent changes `value` to something other than what we
  // confirmed, drop the confirmed flag and notify the parent.
  useEffect(() => {
    if (confirmed && lastConfirmedNameRef.current !== value) {
      const handle = window.setTimeout(() => {
        setConfirmed(false);
        lastConfirmedNameRef.current = null;
        onConfirm?.(null);
      }, 0);
      return () => window.clearTimeout(handle);
    }
  }, [value, confirmed, onConfirm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (confirmed) {
      setConfirmed(false);
      lastConfirmedNameRef.current = null;
      onConfirm?.(null);
    }
    setOpen(true);
    setHighlight(-1);
  };

  const pickSuggestion = (s: SchoolSuggestion) => {
    lastConfirmedNameRef.current = s.name;
    setConfirmed(true);
    onChange(s.name);
    onConfirm?.(s);
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

  const showStrictWarning = strict && value.trim().length >= minChars && !confirmed;
  const showConfirmed = strict && confirmed;

  return (
    <div ref={containerRef} className="relative">
      <School
        className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-colors ${
          showConfirmed
            ? "text-emerald-600"
            : showStrictWarning
              ? "text-amber-500"
              : "text-gray-400"
        }`}
      />

      <input
        type="text"
        role="combobox"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={
          highlight >= 0 && suggestions[highlight]
            ? `${LISTBOX_ID}-opt-${suggestions[highlight].id}`
            : undefined
        }
        className={`w-full pl-10 pr-10 py-3 border text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 outline-none disabled:opacity-60 transition-colors ${
          showConfirmed
            ? "bg-emerald-50/40 border-emerald-300 focus:ring-emerald-500"
            : showStrictWarning
              ? "bg-amber-50/40 border-amber-300 focus:ring-amber-500"
              : "bg-gray-50 border-gray-300 focus:ring-emerald-500"
        }`}
      />

      {loading && canSearch ? (
        <Loader2 className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
      ) : showConfirmed ? (
        <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
      ) : showStrictWarning ? (
        <AlertTriangle className="w-4 h-4 text-amber-500 absolute right-3 top-1/2 -translate-y-1/2" />
      ) : null}

      {showDropdown && (
        <div
          id={LISTBOX_ID}
          role="listbox"
          className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
        >
          {loading && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> සොයමින්...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-amber-700 bg-amber-50/40 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  &quot;{value}&quot; — පාසලක් හමු නොවීය.
                </p>
                <p className="mt-0.5 text-amber-800/80">
                  කරුණාකර ඔබගේ පාසල නිල ලැයිස්තුවෙන් තෝරන්න. එය නොමැති නම් AISSA පරිපාලනය අමතන්න.
                </p>
              </div>
            </div>
          ) : (
            suggestions.map((s, idx) => {
              const isHighlighted = idx === highlight;
              const isExactlyCurrent = s.name === value;
              return (
                <div
                  key={s.id}
                  id={`${LISTBOX_ID}-opt-${s.id}`}
                  role="option"
                  aria-selected={isHighlighted}
                  tabIndex={-1}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition flex items-start gap-2 cursor-pointer ${
                    isHighlighted ? "bg-emerald-50" : "hover:bg-gray-50"
                  }`}
                >
                  <School className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
                </div>
              );
            })
          )}
        </div>
      )}

      {strict && (
        <p
          className={`text-[11px] mt-1 flex items-center gap-1 ${
            showConfirmed
              ? "text-emerald-700 font-semibold"
              : showStrictWarning
                ? "text-amber-700 font-semibold"
                : "text-gray-500"
          }`}
        >
          {showConfirmed ? (
            <>
              <Check className="w-3 h-3" /> තහවුරු කළ පාසලක් ලෙස සටහන් විය
            </>
          ) : showStrictWarning ? (
            <>
              <AlertTriangle className="w-3 h-3" /> ලැයිස්තුවෙන් පාසලක් තෝරන්න
            </>
          ) : (
            <>* නිල පාසල් ලැයිස්තුවෙන් පාසලක් තෝරන්න</>
          )}
        </p>
      )}
    </div>
  );
}