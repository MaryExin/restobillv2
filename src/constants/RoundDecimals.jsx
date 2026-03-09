/**
 * Round a number to a given number of decimal places.
 *
 * @param {number} value      The value to round.
 * @param {number} [decimals=2]  How many decimal places to keep.
 * @returns {number}  The rounded number.
 */
export function roundDecimals(value, decimals = 2) {
  const num = Number(value);
  if (isNaN(num)) {
    console.warn(`roundDecimals: couldn’t coerce “${value}” to a number.`);
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}
