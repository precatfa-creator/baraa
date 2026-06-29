"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

type Item = { id: string; name_ar: string };

// Type-to-search item picker. Reads items directly from the browser client —
// RLS scopes results to the company (ARCHITECTURE §6 allows RLS-protected selects).
// Writes the chosen id into a hidden input named `item_id` for the form.
export function ItemCombobox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const supabase = useRef(createClient());

  useEffect(() => {
    if (selected && query === selected.name_ar) return; // don't re-search the picked label
    const term = query.replace(/[,()*%]/g, "").trim();
    const handle = setTimeout(async () => {
      if (!term) {
        setResults([]);
        return;
      }
      const { data } = await supabase.current
        .from("items")
        .select("id, name_ar")
        .eq("is_active", true)
        .ilike("name_ar", `%${term}%`)
        .order("name_ar")
        .limit(10);
      setResults(data ?? []);
      setOpen(true);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, selected]);

  return (
    <div className="relative space-y-1">
      <input type="hidden" name="item_id" value={selected?.id ?? ""} />
      <Input
        placeholder="ابحث عن الصنف"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        onFocus={() => results.length && setOpen(true)}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-start text-sm hover:bg-accent"
                onClick={() => {
                  setSelected(item);
                  setQuery(item.name_ar);
                  setOpen(false);
                }}
              >
                {item.name_ar}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
