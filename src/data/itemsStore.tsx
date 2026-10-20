/**
 * Runtime store for the item data.
 *
 * The data used to be imported statically from './items', which put ~520 KB of
 * prices, history and roll data straight into the JS bundle. It is now served
 * as a static JSON file and fetched once at start-up.
 *
 * IMPORTANT: the path is absolute on purpose. The site is served from the
 * domain root, but the app also boots on /item/<slug>/ pages, where a relative
 * path would resolve one directory too deep and 404.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { BSSItem } from './items';

const ItemsContext = createContext<BSSItem[]>([]);

export function ItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BSSItem[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/data/items.json')
      .then((res) => {
        if (!res.ok) throw new Error(`items.json responded ${res.status}`);
        return res.json();
      })
      .then((data: BSSItem[]) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('[items] failed to load item data:', err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-amber-400 font-black uppercase tracking-widest text-xs">BSS Index</p>
          <h1 className="text-xl font-black text-white">Could not load the price list</h1>
          <p className="text-sm text-neutral-500 max-w-sm">
            The item data failed to load. Check your connection and refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return <ItemsContext.Provider value={items}>{children}</ItemsContext.Provider>;
}

/** The loaded item data. Empty until the fetch resolves. */
export function useItems(): BSSItem[] {
  return useContext(ItemsContext);
}
