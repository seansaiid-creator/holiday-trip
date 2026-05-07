/**
 * generate-travel-tips-multi.js
 *
 * Generates travel tips for JP, TH, US, FR, GB, AU, VN, SG, DE, IT
 * using the same pattern as generate-travel-tips.js (KR).
 *
 * USAGE
 *   node scripts/generate-travel-tips-multi.js              # all countries, all holidays
 *   node scripts/generate-travel-tips-multi.js --only=JP    # just Japan
 *   node scripts/generate-travel-tips-multi.js --dry-run    # test without DB writes
 *   node scripts/generate-travel-tips-multi.js --only=JP --dry-run
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---------- ENV ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI    = new GoogleGenerativeAI(GEMINI_KEY);
const model    = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ---------- HOLIDAY TARGETS PER COUNTRY ----------
const TARGETS_BY_COUNTRY = {
  JP: [
    { key: 'jp_newyear',       match_name: "New Year's Day" },
    { key: 'jp_comingofage',   match_name: 'Coming of Age Day' },
    { key: 'jp_foundation',    match_name: 'Foundation Day' },
    { key: 'jp_vernal',        match_name: 'Vernal Equinox Day' },
    { key: 'jp_showa',         match_name: 'Shōwa Day' },
    { key: 'jp_constitution',  match_name: 'Constitution Memorial Day' },
    { key: 'jp_greenery',      match_name: 'Greenery Day' },
    { key: 'jp_children',      match_name: "Children's Day" },
    { key: 'jp_marine',        match_name: 'Marine Day' },
    { key: 'jp_mountain',      match_name: 'Mountain Day' },
    { key: 'jp_aged',          match_name: 'Respect for the Aged Day' },
    { key: 'jp_autumnal',      match_name: 'Autumnal Equinox Day' },
    { key: 'jp_sports',        match_name: 'Sports Day' },
    { key: 'jp_culture',       match_name: 'Culture Day' },
    { key: 'jp_labour',        match_name: 'Labour Thanksgiving Day' },
    { key: 'jp_emperor',       match_name: "The Emperor's Birthday" },
  ],
  TH: [
    { key: 'th_newyear',       match_name: "New Year's Day" },
    { key: 'th_newyeareve',    match_name: "New Year's Eve" },
    { key: 'th_makha',         match_name: 'Makha Bucha Day' },
    { key: 'th_chakri',        match_name: 'Chakri Memorial Day' },
    { key: 'th_songkran',      match_name: 'Songkran Festival' },
    { key: 'th_labour',        match_name: 'Labour Day' },
    { key: 'th_coronation',    match_name: 'Coronation Day' },
    { key: 'th_visakha',       match_name: 'Visakha Bucha Day' },
    { key: 'th_asalha',        match_name: 'Asalha Bucha Day' },
    { key: 'th_king_birthday', match_name: "King Vajiralongkorn's Birthday" },
    { key: 'th_queen_mother',  match_name: "Queen Mother's Birthday" },
    { key: 'th_queen_suthida', match_name: "Queen Suthida's Birthday" },
    { key: 'th_chulalongkorn', match_name: 'Chulalongkorn Day' },
    { key: 'th_king_bhumibol', match_name: "King Bhumibol's Birthday" },
    { key: 'th_bhumibol_mem',  match_name: 'King Bhumibol Memorial Day' },
    { key: 'th_constitution',  match_name: 'Constitution Day' },
  ],
  US: [
    { key: 'us_newyear',       match_name: "New Year's Day" },
    { key: 'us_mlk',           match_name: 'Martin Luther King, Jr. Day' },
    { key: 'us_presidents',    match_name: "Washington's Birthday" },
    { key: 'us_memorial',      match_name: 'Memorial Day' },
    { key: 'us_juneteenth',    match_name: 'Juneteenth National Independence Day' },
    { key: 'us_independence',  match_name: 'Independence Day' },
    { key: 'us_labour',        match_name: 'Labour Day' },
    { key: 'us_columbus',      match_name: 'Columbus Day' },
    { key: 'us_indigenous',    match_name: "Indigenous Peoples' Day" },
    { key: 'us_veterans',      match_name: 'Veterans Day' },
    { key: 'us_thanksgiving',  match_name: 'Thanksgiving Day' },
    { key: 'us_christmas',     match_name: 'Christmas Day' },
  ],
  FR: [
    { key: 'fr_newyear',       match_name: "New Year's Day" },
    { key: 'fr_easter',        match_name: 'Easter Monday' },
    { key: 'fr_labour',        match_name: 'Labour Day' },
    { key: 'fr_victory',       match_name: 'Victory in Europe Day' },
    { key: 'fr_ascension',     match_name: 'Ascension Day' },
    { key: 'fr_whit',          match_name: 'Whit Monday' },
    { key: 'fr_bastille',      match_name: 'Bastille Day' },
    { key: 'fr_assumption',    match_name: 'Assumption Day' },
    { key: 'fr_allsaints',     match_name: "All Saints' Day" },
    { key: 'fr_armistice',     match_name: 'Armistice Day' },
    { key: 'fr_christmas',     match_name: 'Christmas Day' },
  ],
  GB: [
    { key: 'gb_newyear',       match_name: "New Year's Day" },
    { key: 'gb_goodfriday',    match_name: 'Good Friday' },
    { key: 'gb_eastermonday',  match_name: 'Easter Monday' },
    { key: 'gb_earlymaybh',    match_name: 'Early May Bank Holiday' },
    { key: 'gb_springbh',      match_name: 'Spring Bank Holiday' },
    { key: 'gb_summerbank',    match_name: 'Summer Bank Holiday' },
    { key: 'gb_christmas',     match_name: 'Christmas Day' },
    { key: 'gb_ststephen',     match_name: "St. Stephen's Day" },
  ],
  AU: [
    { key: 'au_newyear',       match_name: "New Year's Day" },
    { key: 'au_australia',     match_name: 'Australia Day' },
    { key: 'au_goodfriday',    match_name: 'Good Friday' },
    { key: 'au_eastermonday',  match_name: 'Easter Monday' },
    { key: 'au_anzac',         match_name: 'Anzac Day' },
    { key: 'au_christmas',     match_name: 'Christmas Day' },
    { key: 'au_ststephen',     match_name: "St. Stephen's Day" },
  ],
  VN: [
    { key: 'vn_newyear',       match_name: "New Year's Day" },
    { key: 'vn_tet',           match_name: 'Tết Nguyên Đán' },
    { key: 'vn_hungking',      match_name: 'Hung Kings Festival' },
    { key: 'vn_reunification', match_name: 'Reunification Day' },
    { key: 'vn_labour',        match_name: 'Labour Day' },
    { key: 'vn_national',      match_name: 'National Day' },
  ],
  SG: [
    { key: 'sg_newyear',       match_name: "New Year's Day" },
    { key: 'sg_chinesenewyear',match_name: 'Chinese New Year' },
    { key: 'sg_goodfriday',    match_name: 'Good Friday' },
    { key: 'sg_labour',        match_name: 'Labour Day' },
    { key: 'sg_vesak',         match_name: 'Vesak Day' },
    { key: 'sg_hari_puasa',    match_name: 'Hari Raya Puasa' },
    { key: 'sg_national',      match_name: 'National Day' },
    { key: 'sg_hari_haji',     match_name: 'Hari Raya Haji' },
    { key: 'sg_deepavali',     match_name: 'Deepavali' },
    { key: 'sg_christmas',     match_name: 'Christmas Day' },
  ],
  DE: [
    { key: 'de_newyear',       match_name: "New Year's Day" },
    { key: 'de_goodfriday',    match_name: 'Good Friday' },
    { key: 'de_eastermonday',  match_name: 'Easter Monday' },
    { key: 'de_labour',        match_name: 'Labour Day' },
    { key: 'de_ascension',     match_name: 'Ascension Day' },
    { key: 'de_whit',          match_name: 'Whit Monday' },
    { key: 'de_unity',         match_name: 'German Unity Day' },
    { key: 'de_christmas',     match_name: 'Christmas Day' },
    { key: 'de_ststephen',     match_name: "St. Stephen's Day" },
  ],
  IT: [
    { key: 'it_newyear',       match_name: "New Year's Day" },
    { key: 'it_epiphany',      match_name: 'Epiphany' },
    { key: 'it_easter',        match_name: 'Easter Sunday' },
    { key: 'it_eastermonday',  match_name: 'Easter Monday' },
    { key: 'it_liberation',    match_name: 'Liberation Day' },
    { key: 'it_workers',       match_name: 'International Workers Day' },
    { key: 'it_republic',      match_name: 'Republic Day' },
    { key: 'it_assumption',    match_name: 'Assumption Day' },
    { key: 'it_allsaints',     match_name: 'All Saints Day' },
    { key: 'it_immaculate',    match_name: 'Immaculate Conception' },
    { key: 'it_christmas',     match_name: 'Christmas Day' },
    { key: 'it_ststephen',     match_name: "St. Stephen's Day" },
  ],
};

// ---------- PROMPT ----------
const SYSTEM_INSTRUCTION = `You are a travel information writer for HolidayTrip, a global travel guide focused on public holidays and their practical impact on visitors. Your audience is INTERNATIONAL TRAVELERS (not locals) who are visiting the country during this holiday. Write in clear, practical English.

You produce concise, action-oriented information. Travelers are busy — every sentence must give them something they can use to plan or adjust their trip.`;

function buildUserPrompt({ country_name, country_code, holiday_name_en, holiday_name_local, sample_date, weekday, category }) {
  return `Generate a travel tip for international visitors about the following public holiday.

Country: ${country_name} (${country_code})
Holiday: ${holiday_name_en}${holiday_name_local ? ` (${holiday_name_local})` : ''}
Date: ${sample_date} (${weekday})
Holiday category: ${category}

Output a single JSON object with EXACTLY these 5 fields:

{
  "what_is_it": "1-2 sentences. What this holiday is and why locals observe it. Plain English, no jargon.",
  "traveler_impact": "1-2 sentences. How this holiday affects an INTERNATIONAL TRAVELER's day. Concrete impacts: transport bookings, road traffic, attraction crowds, business closures.",
  "cautions": "1-2 sentences. SPECIFIC things travelers should avoid or watch out for. Return empty string '' if nothing concrete to warn about.",
  "recommendations": "1-2 sentences. What a smart traveler does INSTEAD or alongside. Return empty string '' if nothing concrete.",
  "practical_tips": "2-3 sentences. The single most actionable section. Concrete, numeric, time-bound advice. NEVER skip this field."
}

CONSTRAINTS:
1. PARAPHRASE ALL FACTS in your own words.
2. Stay practical, not promotional.
3. Stay neutral on religion and politics.
4. Use figures travelers can act on.
5. Output ONLY the JSON object. No preamble, no markdown code fences.

Then, on a separate line AFTER the JSON, output:
SOURCES: ["url1", "url2", "url3"]

3+ source URLs you used. Prefer primary sources: official government tourism sites, Wikipedia, established travel guides.`;
}

// ---------- HELPERS ----------
function parseGeminiOutput(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

  const sourcesMatch = text.match(/SOURCES\s*:\s*(\[[\s\S]*?\])\s*$/i);
  let sources = [];
  let jsonText = text;
  if (sourcesMatch) {
    try { sources = JSON.parse(sourcesMatch[1]); } catch (e) { /* ignore */ }
    jsonText = text.slice(0, sourcesMatch.index).trim();
  }

  jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');

  let obj;
  try {
    obj = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}\n--- raw ---\n${raw}`);
  }

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

// ---------- CORE ----------
async function findHolidaysForTarget(countryId, target) {
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .eq('country_id', countryId)
    .ilike('name', `%${target.match_name}%`)
    .order('date', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function generateTipForTarget(countryRow, target, options) {
  console.log(`\n  [${target.key}] ${target.match_name}`);

  const matched = await findHolidaysForTarget(countryRow.id, target);
  if (matched.length === 0) {
    console.log(`    ⚠ No matches. Skipping.`);
    return { skipped: true, reason: 'no_matches' };
  }

  const ids = matched.map((h) => h.id);
  const { data: existing, error: existErr } = await supabase
    .from('travel_tips')
    .select('holiday_id')
    .in('holiday_id', ids);
  if (existErr) throw existErr;
  if (existing && existing.length > 0) {
    console.log(`    ⏭  Already has ${existing.length} tip(s). Skipping.`);
    return { skipped: true, reason: 'tip_exists' };
  }

  const anchor = matched.find((h) => h.holiday_category === 'regular') || matched[0];

  const userPrompt = buildUserPrompt({
    country_name:      countryRow.name,
    country_code:      countryRow.code,
    holiday_name_en:   anchor.name,
    holiday_name_local: anchor.name_local,
    sample_date:       anchor.date,
    weekday:           weekdayName(anchor.date),
    category:          anchor.holiday_category || 'regular',
  });

  console.log(`    → Calling Gemini for ${matched.length} row(s)...`);
  const t0 = Date.now();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });
  const raw = result.response.text();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`    ✓ Got response in ${elapsed}s`);

  const parsed = parseGeminiOutput(raw);

  if (options.dryRun) {
    console.log(`    🧪 DRY RUN — would insert ${matched.length} rows`);
    return { skipped: false, dryRun: true };
  }

  const rows = matched.map((h) => ({
    country_id:        countryRow.id,
    holiday_id:        h.id,
    title:             anchor.name,
    what_is_it:        parsed.what_is_it || null,
    traveler_impact:   parsed.traveler_impact || null,
    cautions:          parsed.cautions || null,
    recommendations:   parsed.recommendations || null,
    practical_tips:    parsed.practical_tips || null,
    source_urls:       parsed.source_urls.length > 0 ? parsed.source_urls : null,
    language:          'en',
    ai_model:          'gemini-2.5-flash',
    moderation_status: 'pending',
  }));

  const { data: inserted, error: insErr } = await supabase
    .from('travel_tips')
    .insert(rows)
    .select('id, holiday_id');
  if (insErr) throw insErr;
  console.log(`    ✅ Inserted ${inserted.length} rows (status=pending)`);
  return { skipped: false, inserted: inserted.length };
}

// ---------- MAIN ----------
async function main() {
  const args     = process.argv.slice(2);
  const dryRun   = args.includes('--dry-run');
  const onlyArg  = args.find((a) => a.startsWith('--only='));
  const onlyCode = onlyArg ? onlyArg.split('=')[1].toUpperCase() : null;

  console.log(`generate-travel-tips-multi.js`);
  console.log(`  dryRun=${dryRun}  onlyCode=${onlyCode || '(all)'}\n`);

  const countryCodes = onlyCode
    ? [onlyCode]
    : Object.keys(TARGETS_BY_COUNTRY);

  const summary = [];

  for (const code of countryCodes) {
    const targets = TARGETS_BY_COUNTRY[code];
    if (!targets) {
      console.error(`Unknown country code: ${code}`);
      continue;
    }

    // Load country row
    const { data: countryRow, error: cErr } = await supabase
      .from('countries')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (cErr || !countryRow) {
      console.error(`Failed to load country ${code}:`, cErr);
      continue;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Country: ${countryRow.name} (${code}) — ${targets.length} targets`);
    console.log('='.repeat(50));

    for (const target of targets) {
      try {
        const r = await generateTipForTarget(countryRow, target, { dryRun });
        summary.push({ code, key: target.key, ...r });
        // Rate limit: small delay between Gemini calls
        if (!r.skipped && !dryRun) {
          await new Promise((res) => setTimeout(res, 1500));
        }
      } catch (e) {
        console.error(`    ❌ ${target.key} failed:`, e.message);
        summary.push({ code, key: target.key, error: e.message });
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('SUMMARY');
  console.log('='.repeat(50));
  let inserted = 0, skipped = 0, errors = 0;
  for (const s of summary) {
    if (s.error)        { console.log(`  ❌ [${s.code}] ${s.key}: ${s.error}`); errors++; }
    else if (s.skipped) { console.log(`  ⏭  [${s.code}] ${s.key}: skipped (${s.reason})`); skipped++; }
    else if (s.dryRun)  { console.log(`  🧪 [${s.code}] ${s.key}: dry-run OK`); }
    else                { console.log(`  ✅ [${s.code}] ${s.key}: inserted ${s.inserted} rows`); inserted += s.inserted; }
  }
  console.log(`\nTotal inserted: ${inserted} rows | Skipped: ${skipped} | Errors: ${errors}`);
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
