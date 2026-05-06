/**
 * generate-price-data.js
 *
 * Generates price comparison data for a country using Gemini,
 * then saves to country_prices table with moderation_status='pending'.
 *
 * USAGE
 *   node scripts/generate-price-data.js --country=KR --dry-run
 *   node scripts/generate-price-data.js --country=KR
 *   node scripts/generate-price-data.js --country=KR --country=JP --country=TH
 *   node scripts/generate-price-data.js --all
 *
 * WHAT IT GENERATES
 *   - 14 price items per country (meal, bigmac, starbucks, beer, transit, etc.)
 *   - Transport tips (card purchase, apps like KakaoT/Grab/Uber, transfer policy)
 *   - All prices in USD + local currency
 *   - Local brand names where applicable (e.g., "Cass" for Korean beer)
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI    = new GoogleGenerativeAI(GEMINI_KEY);
const model    = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ---------- ARGS ----------
function parseArgs() {
  const args  = process.argv.slice(2);
  const opts  = { countries: [], dryRun: false, all: false };
  for (const a of args) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--all')  opts.all   = true;
    else if (a.startsWith('--country=')) {
      opts.countries.push(a.split('=')[1].toUpperCase());
    }
  }
  return opts;
}

// ---------- PROMPT ----------
const SYSTEM = `You are a travel cost researcher. You provide accurate, up-to-date price
estimates for common items that travelers encounter. Use recent data from travel blogs,
forums, and official sources. All prices must be realistic and based on actual market
conditions as of 2025-2026.`;

function buildPromptPart1(country) {
  return `Generate price data for travelers visiting ${country.name} (${country.code}).
Currency: ${country.currency_code}. Use 2025-2026 realistic prices.

Return ONLY a JSON object for these 7 items. Keep all "notes" fields under 80 characters:

{
  "meal_local":        { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" },
  "bigmac":           { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" },
  "starbucks_latte":  { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" },
  "beer_bar":         { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "local_brand": "<local beer name>", "notes": "" },
  "beer_convenience": { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "local_brand": "<same>", "notes": "" },
  "transit_single":   { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "<max 80 chars: fare structure>" },
  "taxi_start":       { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" }
}

Rules: realistic prices only. notes MUST be under 80 characters. Output ONLY the JSON object, no markdown, no explanation.`;
}

function buildPromptPart2(country) {
  return `Generate price data for travelers visiting ${country.name} (${country.code}).
Currency: ${country.currency_code}. Use 2025-2026 realistic prices.

Return ONLY a JSON object. Keep all "notes" fields under 80 characters:

{
  "prices": {
    "airport_city":       { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "<transport type, max 80 chars>" },
    "water_convenience":  { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" },
    "water_supermarket":  { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" },
    "coke_convenience":   { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" },
    "coke_supermarket":   { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "" },
    "sim_7day":           { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "<where to buy, max 80 chars>" },
    "attraction":         { "usd_min": N, "usd_max": N, "local_min": N, "local_max": N, "notes": "<attraction name, max 80 chars>" }
  },
  "transport_tips": "<2-3 sentences: transit card name + where to buy, main rideshare app, transfer policy>"
}

Rules: realistic prices only. notes MUST be under 80 characters. Output ONLY the JSON object, no markdown.`;
}

// ---------- PARSE GEMINI OUTPUT ----------
function parseOutput(raw) {
  let text = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/,(\s*[}\]])/g, '$1'); // trailing commas

  return JSON.parse(text);
}

// ---------- DB HELPERS ----------
async function getCountries(codes) {
  const q = supabase.from('countries').select('id,code,name,currency_code,currency_symbol');
  if (codes.length > 0) q.in('code', codes);
  const { data, error } = await q.order('code');
  if (error) throw error;
  return data || [];
}

async function getPriceItems() {
  const { data, error } = await supabase
    .from('price_items')
    .select('id,key')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

async function getExistingPrices(countryId) {
  const { data } = await supabase
    .from('country_prices')
    .select('price_item_id')
    .eq('country_id', countryId)
    .not('price_item_id', 'is', null);
  return new Set((data || []).map(r => r.price_item_id));
}

async function upsertPrices(countryId, currencyCode, parsed, priceItems, dryRun) {
  const itemByKey = Object.fromEntries(priceItems.map(i => [i.key, i.id]));
  const rows = [];

  for (const [key, val] of Object.entries(parsed.prices || {})) {
    const itemId = itemByKey[key];
    if (!itemId) { console.log(`  ⚠ Unknown key: ${key}`); continue; }

    rows.push({
      country_id:       countryId,
      price_item_id:    itemId,
      price_usd_min:    val.usd_min   ?? null,
      price_usd_max:    val.usd_max   ?? null,
      price_local_min:  val.local_min ?? null,
      price_local_max:  val.local_max ?? null,
      currency_code:    currencyCode  ?? null,
      local_brand:      val.local_brand ?? null,
      notes:            val.notes     ?? null,
      data_source:      'gemini',
      moderation_status:'pending',
    });
  }

  // Transport tips row (price_item_id = null)
  if (parsed.transport_tips) {
    rows.push({
      country_id:       countryId,
      price_item_id:    null,
      transport_tips:   parsed.transport_tips,
      data_source:      'gemini',
      moderation_status:'pending',
    });
  }

  if (dryRun) {
    console.log(`  🧪 DRY RUN — would upsert ${rows.length} rows`);
    console.log(JSON.stringify(parsed, null, 2));
    return rows.length;
  }

  // Upsert price rows
  const priceRows = rows.filter(r => r.price_item_id !== null && r.price_item_id !== undefined);
  if (priceRows.length > 0) {
    const { error } = await supabase
      .from('country_prices')
      .upsert(priceRows, { onConflict: 'country_id,price_item_id' });
    if (error) throw error;
  }

  // Transport tips — delete existing then insert (no unique key for null price_item_id)
  const tipRow = rows.find(r => r.price_item_id === null || r.price_item_id === undefined);
  if (tipRow) {
    await supabase
      .from('country_prices')
      .delete()
      .eq('country_id', countryId)
      .is('price_item_id', null);
    const { error } = await supabase.from('country_prices').insert(tipRow);
    if (error) throw error;
  }

  return rows.length;
}

// ---------- MAIN ----------
async function main() {
  const opts = parseArgs();

  if (!opts.all && opts.countries.length === 0) {
    console.error('Usage: node scripts/generate-price-data.js --country=KR [--dry-run] | --all');
    process.exit(1);
  }

  console.log(`generate-price-data.js`);
  console.log(`  dryRun:    ${opts.dryRun}`);
  console.log(`  countries: ${opts.all ? '(all)' : opts.countries.join(', ')}`);
  console.log('');

  const [countries, priceItems] = await Promise.all([
    getCountries(opts.all ? [] : opts.countries),
    getPriceItems(),
  ]);

  console.log(`Price items loaded: ${priceItems.length}`);
  console.log(`Countries to process: ${countries.length}\n`);

  const summary = [];

  for (const country of countries) {
    process.stdout.write(`[${country.code}] ${country.name.padEnd(25)} → Calling Gemini... `);

    let raw1 = '';
    let raw2 = '';
    try {
      // Part 1: food + basic transport (7 items)
      process.stdout.write(`part1... `);
      const r1 = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildPromptPart1(country) }] }],
        systemInstruction: SYSTEM,
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      });
      raw1 = r1.response.text();
      const part1 = parseOutput(raw1);

      await new Promise(r => setTimeout(r, 1000));

      // Part 2: groceries + sim + attraction + transport tips
      process.stdout.write(`part2... `);
      const r2 = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildPromptPart2(country) }] }],
        systemInstruction: SYSTEM,
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      });
      raw2 = r2.response.text();
      const part2 = parseOutput(raw2);

      // Merge
      const merged = {
        prices: { ...part1, ...(part2.prices || {}) },
        transport_tips: part2.transport_tips || '',
      };

      const n = await upsertPrices(
        country.id, country.currency_code, merged, priceItems, opts.dryRun
      );

      console.log(`✅ ${n} rows`);
      summary.push({ code: country.code, result: 'ok', rows: n });

      await new Promise(r => setTimeout(r, 1500));

    } catch (e) {
      console.log(`❌ ${e.message}`);
      console.log('--- raw1 (first 800 chars) ---');
      console.log(raw1 ? raw1.slice(0, 800) : '(empty — API call failed before text was received)');
      if (raw2) {
        console.log('--- raw2 (first 800 chars) ---');
        console.log(raw2.slice(0, 800));
      }
      summary.push({ code: country.code, result: 'error', error: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  const ok  = summary.filter(s => s.result === 'ok');
  const err = summary.filter(s => s.result === 'error');
  console.log(`  ✅ Success: ${ok.length} countries`);
  console.log(`  ❌ Errors:  ${err.length}`);
  if (err.length > 0) {
    for (const s of err) console.log(`     ${s.code}: ${s.error}`);
  }
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
