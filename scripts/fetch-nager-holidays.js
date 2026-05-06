// ==========================================================
// fetch-nager-holidays.js
// Fetches holidays for a given country/year from Nager.Date.
// Public API, no key required.
// ==========================================================

/**
 * Fetch holidays from Nager.Date for a country + year.
 * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. 'KR', 'JP')
 * @param {number} year - 4-digit year
 * @returns {Promise<Array<{ date: string, name: string, localName: string, types: string[] }>>}
 */
async function fetchNagerHolidays(countryCode, year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`;
  const response = await fetch(url);

  if (!response.ok) {
    // 404 is common (Nager doesn't support all countries, e.g. Thailand)
    if (response.status === 404) {
      console.warn(`   ⚠️  Nager.Date has no data for ${countryCode} ${year}`);
      return [];
    }
    throw new Error(`Nager.Date API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return data.map((h) => ({
    date: h.date,                   // "2026-01-01"
    name: h.name,                   // English name
    localName: h.localName,         // Local language name
    types: h.types || ['Public'],   // ["Public"], ["Bank"], ["School"], etc.
    source: 'nager',
  }));
}

/**
 * Fetch multiple years in parallel.
 * @param {string} countryCode
 * @param {number[]} years
 * @returns {Promise<Array>} Flattened list across all years.
 */
async function fetchNagerHolidaysMultiYear(countryCode, years) {
  const results = await Promise.all(
    years.map((y) => fetchNagerHolidays(countryCode, y))
  );
  return results.flat();
}

module.exports = { fetchNagerHolidays, fetchNagerHolidaysMultiYear };
