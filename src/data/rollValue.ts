/**
 * Formatting for beequip roll values.
 *
 * Roll prices in the source data are not always plain numbers. Some are
 * floors (">=100") and some are expressed in other items (">={Bee Cub}"). The
 * updater resolves those into a number and marks the roll with isFloor, so the
 * UI can show "100+★" instead of pretending it is an exact price.
 */
import type { BeequipRoll } from './items';

export function formatRollNumber(value: number): string {
  if (!value) return '0';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Number(value.toFixed(4)));
}

/** The value of a roll as it should be shown, e.g. "100+★", "0.5 - 1 ★", "TBD". */
export function formatRollValue(roll: Pick<BeequipRoll, 'valueLow' | 'valueHigh' | 'value' | 'isFloor' | 'valueText'>): string {
  const { valueLow, valueHigh, isFloor, valueText } = roll;

  if (!valueLow && !valueHigh) {
    // The source itself has no price for this roll.
    return valueText && valueText !== 'TBD' ? valueText : 'TBD';
  }

  if (isFloor) {
    return `${formatRollNumber(valueLow)}+ ★`;
  }

  if (valueLow !== valueHigh) {
    return `${formatRollNumber(valueLow)} - ${formatRollNumber(valueHigh)} ★`;
  }

  return `${formatRollNumber(valueLow)} ★`;
}
