/**
 * generate-regional-tips.js
 *
 * Generates Travel Tips for region-specific holidays for any country.
 *
 * USAGE
 *   node scripts/generate-regional-tips.js --country=CA
 *   node scripts/generate-regional-tips.js --country=DE
 *   node scripts/generate-regional-tips.js --country=CA --dry-run
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const SYSTEM_INSTRUCTION = `You are a travel information writer for HolidayTrip. Your audience is INTERNATIONAL TRAVELERS. Write in clear, practical English.`;

function buildPrompt(holiday, country) {
  const regionNote = holiday.region
    ? `This holiday is only observed in: ${holiday.region}`
    : 'This is a nationwide holiday.';

  return `Generate a travel tip for international visitors about the following public holiday.

Country: ${country.name} (${country.code})
Holiday: ${holiday.name}${holiday.name_local ? ' (' + holiday.name_local + ')' : ''}
Date: ${holiday.date}
Region: ${regionNote}

Output a single JSON object with EXACTLY these 5 fields:
{
  "what_is_it": "1-2 sentences explaining the holiday. Mention which regions observe it if region-specific.",
  "traveler_impact": "1-2 sentences on concrete traveler impact — which areas are affected, what closes.",
  "cautions": "1-2 sentences of specific warnings. Empty string if none.",
  "recommendations": "1-2 sentences of recommendations. Empty string if none.",
  "practical_tips": "2-3 sentences of actionable advice. Include region info if applicable."
}

Then on a separate line:
SOURCES: ["url1", "url2", "url3"]

Output ONLY the JSON + SOURCES line. No markdown fences.`;
}

function parseOutput(raw) {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const sourcesMatch = text.match(/SOURCES\s*:\s*(\[[\s\S]*?\])\s*$/i);
  let sources = [];
  let jsonText = text;
  if (sourcesMatch) {
    try { sources = JSON.parse(sourcesMatch[1]); } catch (e) {}
    jsonText = text.slice(0, sourcesMatch.index).trim();
  }
  jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON object found in response');
  const obj = JSON.parse(jsonMatch[0]);
  return {
    what_is_it:      (obj.what_is_it || '').trim(),
    traveler_impact: (obj.traveler_impact || '').trim(),
    cautions:        (obj.cautions || '').trim(),
    recommendations: (obj.recommendations || '').trim(),
    practical_tips:  (obj.practical_tips || '').trim(),
    source_urls:     Array.isArray(sources) ? sources : [],
  };
}

function weekdayName(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
}

async function main() {
  const args     = process.argv.slice(2);
  const dryRun   = args.includes('--dry-run');
  const countryArg = args.find(a => a.startsWith('--country='));
  const countryCode = countryArg ? countryArg.split('=')[1].toUpperCase() : null;

  if (!countryCode) {
    console.error('Usage: node scripts/generate-regional-tips.js --country=CA');
    process.exit(1);
  }

  console.log(`generate-regional-tips.js  country=${countryCode}  dryRun=${dryRun}\n`);

  // Load country
  const { data: country } = await supabase
    .from('countries').select('*').eq('code', countryCode).maybeSingle();
  if (!country) { console.error(`Country ${countryCode} not found`); process.exit(1); }
  console.log(`Country: ${country.name} (id=${country.id})\n`);

  // Get all holidays with region for this country
  const { data: holidays } = await supabase
    .from('holidays').select('*')
    .eq('country_id', country.id)
    .not('region', 'is', null)
    .order('date', { ascending: true });

  if (!holidays || holidays.length === 0) {
    console.log('No region-specific holidays found!');
    process.exit(0);
  }

  // Group by holiday name to avoid duplicate Gemini calls
  const nameGroups = new Map();
  for (const h of holidays) {
    if (!nameGroups.has(h.name)) nameGroups.set(h.name, []);
    nameGroups.get(h.name).push(h);
  }

  console.log(`Found ${holidays.length} region-specific holiday rows across ${nameGroups.size} unique holidays\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const [name, group] of nameGroups) {
    console.log(`\n[${name}] — ${group.length} rows (region: ${group[0].region})`);

    // Check existing tips
    const ids = group.map(h => h.id);
    const { data: existing } = await supabase
      .from('travel_tips').select('holiday_id').in('holiday_id', ids);
    if (existing && existing.length > 0) {
      console.log(`  ⏭  Already has ${existing.length} tip(s). Skipping.`);
      totalSkipped += existing.length;
      continue;
    }

    // Use first row as anchor
    const anchor = group.find(h => h.holiday_category === 'regular') || group[0];

    console.log(`  → Calling Gemini...`);
    const t0 = Date.now();
    let parsed;
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(anchor, country) }] }],
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      });
      const raw = result.response.text();
      console.log(`  ✓ Got response in ${((Date.now()-t0)/1000).toFixed(1)}s`);
      parsed = parseOutput(raw);
    } catch(e) {
      console.error(`  ❌ Failed: ${e.message}`);
      totalErrors++;
      continue;
    }

    if (dryRun) {
      console.log(`  🧪 DRY RUN — would insert ${group.length} rows`);
      continue;
    }

    const rows = group.map(h => ({
      country_id:        country.id,
      holiday_id:        h.id,
      title:             anchor.name,
      what_is_it:        parsed.what_is_it || null,
      traveler_impact:   parsed.traveler_impact || null,
      cautions:          parsed.cautions || null,
      recommendations:   parsed.recommendations || null,
      practical_tips:    parsed.practical_tips || null,
      source_urls:       parsed.source_urls.length > 0 ? parsed.source_urls : null,
      language:          'en',
      ai_model:          'gemini-2.5-flash-lite',
      moderation_status: 'approved',
    }));

    const { data: inserted, error } = await supabase
      .from('travel_tips').insert(rows).select('id');
    if (error) {
      console.error(`  ❌ Insert failed: ${error.message}`);
      totalErrors++;
      continue;
    }
    console.log(`  ✅ Inserted ${inserted.length} rows`);
    totalInserted += inserted.length;

    await new Promise(res => setTimeout(res, 1000));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Inserted: ${totalInserted} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
