/**
 * generate-au-labour-day-tips.js
 *
 * Generates Travel Tips for Australia Labour Day (state-specific)
 *
 * USAGE
 *   node scripts/generate-au-labour-day-tips.js --dry-run
 *   node scripts/generate-au-labour-day-tips.js
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

const SYSTEM_INSTRUCTION = `You are a travel information writer for HolidayTrip. Your audience is INTERNATIONAL TRAVELERS visiting Australia. Write in clear, practical English.`;

function buildPrompt(region, dates) {
  return `Generate a travel tip for international visitors about Labour Day in Australia.

Country: Australia
Holiday: Labour Day
Regions: ${region}
Dates: ${dates}
Note: This is a STATE-SPECIFIC holiday. Not all of Australia observes it on the same day.

Output a single JSON object with EXACTLY these 5 fields:
{
  "what_is_it": "1-2 sentences explaining Labour Day and that it varies by state.",
  "traveler_impact": "1-2 sentences on concrete traveler impact — which states are affected, what closes.",
  "cautions": "1-2 sentences of specific warnings. Empty string if none.",
  "recommendations": "1-2 sentences of recommendations. Empty string if none.",
  "practical_tips": "2-3 sentences of actionable advice including which states observe this day."
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
  const obj = JSON.parse(jsonText);
  return {
    what_is_it: (obj.what_is_it || '').trim(),
    traveler_impact: (obj.traveler_impact || '').trim(),
    cautions: (obj.cautions || '').trim(),
    recommendations: (obj.recommendations || '').trim(),
    practical_tips: (obj.practical_tips || '').trim(),
    source_urls: Array.isArray(sources) ? sources : [],
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`generate-au-labour-day-tips.js  dryRun=${dryRun}\n`);

  // Get Australia country id
  const { data: country } = await supabase
    .from('countries').select('id, name').eq('code', 'AU').maybeSingle();
  if (!country) { console.error('AU not found'); process.exit(1); }
  console.log(`Country: ${country.name} (id=${country.id})\n`);

  // Get all AU Labour Day holidays
  const { data: holidays } = await supabase
    .from('holidays').select('*')
    .eq('country_id', country.id)
    .ilike('name', '%Labour Day%')
    .order('date', { ascending: true });

  if (!holidays || holidays.length === 0) {
    console.log('No Labour Day holidays found!');
    process.exit(1);
  }

  console.log(`Found ${holidays.length} Labour Day rows:`);
  holidays.forEach(h => console.log(`  [id=${h.id}] ${h.date} region=${h.region}`));

  // Check existing tips
  const ids = holidays.map(h => h.id);
  const { data: existing } = await supabase
    .from('travel_tips').select('holiday_id').in('holiday_id', ids);
  if (existing && existing.length > 0) {
    console.log(`\n⏭  Already has ${existing.length} tip(s). Skipping.`);
    process.exit(0);
  }

  // Group by region for context
  const regionGroups = {};
  holidays.forEach(h => {
    const r = h.region || 'nationwide';
    if (!regionGroups[r]) regionGroups[r] = [];
    regionGroups[r].push(h.date);
  });

  const regionSummary = Object.entries(regionGroups)
    .map(([r, dates]) => `${r}: ${dates.join(', ')}`)
    .join('; ');

  console.log(`\n→ Calling Gemini...`);
  const t0 = Date.now();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(
      Object.keys(regionGroups).join(', '),
      regionSummary
    ) }] }],
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });
  const raw = result.response.text();
  console.log(`✓ Got response in ${((Date.now()-t0)/1000).toFixed(1)}s`);

  let parsed;
  try { parsed = parseOutput(raw); }
  catch(e) { console.error('Parse failed:', e.message); process.exit(1); }

  console.log('\nParsed:');
  console.log(`  what_is_it: ${parsed.what_is_it.substring(0, 80)}...`);
  console.log(`  practical_tips: ${parsed.practical_tips.substring(0, 80)}...`);

  if (dryRun) {
    console.log('\n🧪 DRY RUN — would insert', holidays.length, 'rows');
    process.exit(0);
  }

  // Insert one tip per holiday row
  const rows = holidays.map(h => ({
    country_id: country.id,
    holiday_id: h.id,
    title: 'Labour Day',
    what_is_it: parsed.what_is_it || null,
    traveler_impact: parsed.traveler_impact || null,
    cautions: parsed.cautions || null,
    recommendations: parsed.recommendations || null,
    practical_tips: parsed.practical_tips || null,
    source_urls: parsed.source_urls.length > 0 ? parsed.source_urls : null,
    language: 'en',
    ai_model: 'gemini-2.5-flash-lite',
    moderation_status: 'approved',
  }));

  const { data: inserted, error } = await supabase
    .from('travel_tips').insert(rows).select('id, holiday_id');
  if (error) { console.error('Insert failed:', error.message); process.exit(1); }

  console.log(`\n✅ Inserted ${inserted.length} Travel Tip rows for AU Labour Day!`);
  console.log('Done.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
