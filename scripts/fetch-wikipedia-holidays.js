// ==========================================================
// fetch-wikipedia-holidays.js (v2 - optimized)
//
// Changes from v1:
//   - Single Gemini call returns ALL years at once (was 3 calls)
//   - Uses gemini-2.5-flash (large HTML input benefits from stronger model)
//   - Compressed HTML preprocessing to reduce input tokens
// ==========================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

const WIKIPEDIA_PAGE_NAMES = {
  KR: 'Public_holidays_in_South_Korea',
  JP: 'Public_holidays_in_Japan',
  US: 'Federal_holidays_in_the_United_States',
  TH: 'Public_holidays_in_Thailand',
  FR: 'Public_holidays_in_France',
  GB: 'Public_holidays_in_the_United_Kingdom',
  DE: 'Public_holidays_in_Germany',
  CN: 'Public_holidays_in_China',
};

async function fetchWikipediaHTML(pageName) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageName)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'HolidayTrip/1.0 (holiday-trip.com; seansaiid@gmail.com)',
      'Accept': 'text/html',
    },
  });
  if (!response.ok) throw new Error(`Wikipedia fetch failed: ${response.status}`);
  return await response.text();
}

function extractRelevantSections(html) {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) cleaned = bodyMatch[1];

  cleaned = cleaned.replace(/<(\w+)\s+[^>]*>/g, '<$1>');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  const MAX_CHARS = 50000;
  if (cleaned.length > MAX_CHARS) cleaned = cleaned.slice(0, MAX_CHARS);
  return cleaned;
}

/**
 * OPTIMIZED: Extract holidays for ALL years in a single Gemini call.
 * This replaces 3 separate calls (one per year) with 1 call.
 */
async function extractAllYearsWithGemini(pageHtml, countryName, years) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const yearList = years.join(', ');

  const prompt = `You are extracting public holiday data from a Wikipedia page about public holidays in ${countryName}.

TASK: From the HTML below, extract ALL public holidays that apply to these years: ${yearList}.
Include substitute holidays, temporary holidays (e.g. elections), and eve/day-after entries if Wikipedia lists them separately.

RULES:
- Output ONLY valid JSON. No markdown, no code fences, no commentary.
- For each target year (${yearList}), compute the actual calendar date for movable/lunar holidays (e.g. Lunar New Year, Chuseok, Easter). Use Wikipedia's own table values if listed for that year; otherwise compute from the rules the page describes.
- If you cannot determine a date for a given year, skip that entry.
- Use the official English name as presented on the page (e.g. "National Liberation Day of Korea", not "Liberation Day").
- category values: "regular" | "substitute" | "eve" | "day_after" | "temporary" | "observed"

OUTPUT FORMAT (single JSON object with holidays array across all years):
{
  "holidays": [
    {
      "date": "YYYY-MM-DD",
      "year": 2025,
      "name_en": "official English name",
      "name_local": "local-language name or null",
      "category": "regular",
      "is_substitute_for": "name of the holiday this substitutes, or null"
    }
  ]
}

HTML:
${pageHtml}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.holidays)) {
      throw new Error('Expected "holidays" array in response');
    }
    return parsed.holidays.map((h) => ({ ...h, source: 'wikipedia' }));
  } catch (err) {
    console.error('   ❌ Failed to parse Gemini response:');
    console.error('   First 500 chars:', cleaned.slice(0, 500));
    throw err;
  }
}

async function fetchWikipediaHolidays(countryCode, years, countryName) {
  const pageName = WIKIPEDIA_PAGE_NAMES[countryCode.toUpperCase()];
  if (!pageName) {
    console.warn(`   ⚠️  No Wikipedia page mapping for ${countryCode}`);
    return [];
  }

  console.log(`   📥 Fetching Wikipedia HTML: ${pageName}`);
  const html = await fetchWikipediaHTML(pageName);
  const relevant = extractRelevantSections(html);
  console.log(`   ✓ HTML fetched (${relevant.length} chars after cleaning)`);

  console.log(`   🤖 Gemini extracting holidays for all years (${years.join(', ')})...`);
  const hols = await extractAllYearsWithGemini(relevant, countryName, years);
  console.log(`      → ${hols.length} total holidays extracted`);

  return hols;
}

module.exports = { fetchWikipediaHolidays };
