/**
 * Floor-aware formatting for beequip roll values, for the build scripts.
 *
 * Roll prices in the source are not always plain numbers: some are floors
 * (">=100") and some are expressed in other items (">={Bee Cub}"). The updater
 * resolves those into numbers and marks the roll with isFloor, so the output
 * shows "100+★" rather than pretending it is an exact price.
 *
 * The browser equivalent lives in src/data/rollValue.ts - keep the two in sync.
 */

/** 1000 -> "1k" */
function formatNumber(value) {
  if (!value) return '0';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Number(Number(value).toFixed(4)));
}

/**
 * The value of a roll as it should be shown.
 * Returns e.g. "100+ ★", "0.5 - 1 ★", "0.75 ★" or "TBD".
 */
function formatRollValue(roll) {
  const low = Number(roll.valueLow) || 0;
  const high = Number(roll.valueHigh) || 0;
  const text = roll.valueText;

  if (!low && !high) {
    return text && text !== 'TBD' ? text : 'TBD';
  }

  if (roll.isFloor) {
    return `${formatNumber(low)}+`;
  }

  if (low !== high) {
    return `${formatNumber(low)}–${formatNumber(high)}`;
  }

  return formatNumber(low);
}

module.exports = { formatRollValue, formatNumber };
