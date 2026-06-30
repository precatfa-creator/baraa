"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

type Item = { id: string; name_ar: string };

// Searchable item picker. Opening it shows the item list; typing filters it.
// Reads items directly from the browser client — RLS scopes results to the
// company (ARCHITECTURE §6 allows RLS-protected selects). The chosen id goes
// into a hidden input named `item_id`; the form rejects a non-selection.
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
      // Empty query shows the list (alphabetical); a term narrows it.
      let q = supabase.current
        .from("items")
        .select("id, name_ar")
        .eq("is_active", true)
        .order("name_ar")
        .limit(term ? 10 : 50);
      if (term) q = q.ilike("name_ar", `%${term}%`);
      const { data } = await q;
      setResults(data ?? []);
    }, 150);
    return () => clearTimeout(handle);
  }, [query, selected]);

  // Submit the explicit pick, or fall back to an exact name match in the loaded
  // list — so a valid typed/selected name always carries its id (and a stale
  // "choose an item" error clears once the text resolves).
  const itemId = selected?.id ?? results.find((r) => r.name_ar === query)?.id ?? "";

  const choose = (item: Item) => {
    setSelected(item);
    setQuery(item.name_ar);
    setOpen(false);
  };

  return (
    <div className="relative space-y-1">
      <input type="hidden" name="item_id" value={itemId} />
      <Input
        placeholder="اختر الصنف أو اكتب للبحث"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on an option registers before the list closes.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-start text-sm hover:bg-accent"
                // Commit on pointer-down (covers mouse + touch) and preventDefault so
                // the input never blurs: on touch the blur dismisses the keyboard and
                // reflows the layout, moving this option out from under the tap before
                // the click lands, which dropped the selection. onClick stays for
                // keyboard/programmatic activation.
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
                onClick={() => choose(item)}
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
