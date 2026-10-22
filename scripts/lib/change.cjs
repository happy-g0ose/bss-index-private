/**
 * Price change over a period, computed from the recorded history.
 *
 * The history is an irregular dated series, not weekly samples, so the value
 * "days ago" is interpolated between the two surrounding snapshots.
 *
 * This lives in one place on purpose: the site, the API and the static pages
 * used to disagree (the site took the nearest snapshot, the API interpolated),
 * which produced figures like +180% on a page and +12.7% in the API for the
 * same item.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Turn the raw history arrays into a sorted {t, p} series. */
function toSeries(item) {
  const prices = item.historicalPrices;
  const dates = item.historicalDates;
  if (!Array.isArray(prices) || !Array.isArray(dates)) return [];

  const series = [];
  for (let i = 0; i < Math.min(prices.length, dates.length); i++) {
    const t = new Date(dates[i]).getTime();
    const p = Number(prices[i]);
    if (Number.isNaN(t) || !Number.isFinite(p)) continue;
    series.push({ t, p });
  }
  series.sort((a, b) => a.t - b.t);
  return series;
}

/**
 * The interpolated value at a point in time.
 * Returns null when the timestamp falls outside the recorded range — an item
 * without enough history is better reported as unknown than guessed at.
 */
function priceAt(points, when) {
  if (!points.length) return null;
  if (when < points[0].t || when > points[points.length - 1].t) return null;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.t >= when) {
      if (b.t === a.t) return b.p;
      const f = (when - a.t) / (b.t - a.t);
      return a.p + (b.p - a.p) * f;
    }
  }
  return points[points.length - 1].p;
}

/**
 * Percentage change over the last N days, given an already built series.
 * Returns null when there is not enough history to say anything honest.
 */
function changeOverPoints(points, days) {
  if (points.length < 2) return null;

  const end = points[points.length - 1].t;
  const base = priceAt(points, end - days * DAY_MS);
  if (base === null || !Number.isFinite(base) || base === 0) return null;

  const last = points[points.length - 1].p;
  return Math.round(((last - base) / base) * 1000) / 10;
}

/** Percentage change over the last N days of an item's recorded history. */
function changeOver(item, days) {
  return changeOverPoints(toSeries(item), days);
}

/** Both changes at once: { change7d, change30d }. */
function changes(item) {
  return { change7d: changeOver(item, 7), change30d: changeOver(item, 30) };
}

module.exports = {
  toSeries,
  priceAt,
  changeOver,
  changeOverPoints,
  changes,
  DAY_MS,
};
