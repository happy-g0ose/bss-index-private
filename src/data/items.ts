/**
 * Item data types.
 *
 * The data itself is NOT in this module any more. It is generated into
 * public/data/items.json at build time (scripts/generate-runtime-items.cjs)
 * and fetched at runtime, which keeps ~520 KB of prices, history and roll data
 * out of the JS bundle.
 *
 * Use the `useItems()` hook from './itemsStore' to read the data in a component.
 */
export interface BeequipRoll {
  rollName: string;
  valueLow: number;
  valueHigh: number;
  value: number;
  demand: "Низкий" | "Средний" | "Высокий" | "Хайп";
  /** The original source expression, e.g. ">=100" or ">={Bee Cub}". */
  valueText?: string;
  /** True when the value is a lower bound rather than an exact price. */
  isFloor?: boolean;
}

export interface BeequipStatGroup {
  groupName: string;
  rolls: BeequipRoll[];
}

export interface BSSItem {
  id: string;
  name: string;
  englishName: string;
  category: string;
  value: number;
  valueLow: number;
  valueHigh: number;
  demand: "Низкий" | "Средний" | "Высокий" | "Хайп";
  stability: "Растет" | "Стабильно" | "Падает";
  glowColor: string;
  borderColor: string;
  badgeColor: string;
  textColor: string;
  hexColor?: string;
  description: string;
  historicalPrices: number[];
  historicalDates?: string[];
  image: string;
  beequipData?: BeequipStatGroup[];
}
