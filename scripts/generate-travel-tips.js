/**
 * generate-travel-tips.js
 *
 * Generates travel tips for selected holidays using Gemini, then saves
 * them to the `travel_tips` table with moderation_status='pending'.
 *
 * USAGE
 *   node scripts/generate-travel-tips.js              # generates all configured holidays
 *   node scripts/generate-travel-tips.js --only=lunar # just the matching key
 *   node scripts/generate-travel-tips.js --dry-run    # call Gemini, print JSON, do NOT write DB
 *
 * HOW IT WORKS
 *   1. Load HOLIDAY_TARGETS — the list of holidays we want tips for.
 *   2. For each target:
 *        a. Look up ALL DB rows whose name matches (across years and
 *           categories: regular, eve, day_after, substitute).
 *        b. Pick ONE "anchor" row (the regular one) to give to Gemini.
 *        c. Call Gemini → parse {what_is_it, traveler_impact, ...} JSON
 *           plus SOURCES line.
 *        d. INSERT one travel_tips row per matched holiday id, all
 *           sharing the same generated content. (The user agreed: eve
 *           and day_after share the regular tip; substitute also
 *           shares it.)
 *   3. All inserted rows have moderation_status='pending' so nothing
 *      ships to the public site until the admin approves.
 *
 * SAFETY
 *   - Skips a holiday entirely if a tip already exists for any of its
 *     DB rows. Prevents accidental duplicate insertion on re-runs.
 *   - Logs every Gemini call and every DB insert to the console.
 *   - --dry-run mode for testing prompt quality without DB writes.
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---------- ENV ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ---------- CONFIG ----------
// The 5 priority Korean holidays. `match` is a SQL ILIKE pattern run
// against holidays.name (English) for the regular-category row.
//
// Adding a new holiday = add one row here. The script handles
// resolution of all related rows (eve, day_after, substitute) by
// reading holiday_category and date proximity.
const HOLIDAY_TARGETS = [
  {
    key: 'newyear',
    country_code: 'KR',
    match_name: "New Year's Day",
    related_keywords: ["New Year's Day"],
  },
  {
    key: 'lunar',
    country_code: 'KR',
    match_name: 'Lunar New Year',
    related_keywords: ['Lunar New Year'],
  },
  {
    key: 'independence',
    country_code: 'KR',
    match_name: 'Independence Movement Day',
    related_keywords: ['Independence Movement'],
  },
  {
    key: 'labor',
    country_code: 'KR',
    match_name: 'Labor Day',
    related_keywords: ['Labor Day'],
  },
  {
    key: 'children',
    country_code: 'KR',
    match_name: "Children's Day",
    related_keywords: ["Children's Day"],
  },
  {
    key: 'buddha',
    country_code: 'KR',
    match_name: "Buddha's Birthday",
    related_keywords: ["Buddha's Birthday"],
  },
  {
    key: 'memorial',
    country_code: 'KR',
    match_name: 'Memorial Day',
    related_keywords: ['Memorial Day'],
  },
  {
    key: 'liberation',
    country_code: 'KR',
    match_name: 'National Liberation Day of Korea',
    related_keywords: ['Liberation', 'National Liberation'],
  },
  {
    key: 'foundation',
    country_code: 'KR',
    match_name: 'National Foundation Day',
    related_keywords: ['National Foundation Day'],
  },
  {
    key: 'hangul',
    country_code: 'KR',
    match_name: 'Hangul Day',
    related_keywords: ['Hangul Day'],
  },
  {
    key: 'constitution',
    country_code: 'KR',
    match_name: 'Constitution Day',
    related_keywords: ['Constitution Day'],
  },
  {
    key: 'chuseok',
    country_code: 'KR',
    match_name: 'Chuseok',
    related_keywords: ['Chuseok'],
  },
  {
    key: 'christmas',
    country_code: 'KR',
    match_name: 'Christmas Day',
    related_keywords: ['Christmas'],
  },
];

// ---------- PROMPT ----------
const SYSTEM_INSTRUCTION = `You are a travel information writer for HolidayTrip, a global travel guide focused on public holidays and their practical impact on visitors. Your audience is INTERNATIONAL TRAVELERS (not locals) who are visiting the country during this holiday. Write in clear, practical English.

You produce concise, action-oriented information. Travelers are busy — every sentence must give them something they can use to plan or adjust their trip.`;

function buildUserPrompt(args) {
  const { country_name, country_code, holiday_name_en, holiday_name_local, sample_date, weekday, category } = args;
  return `Generate a travel tip for international visitors about the following public holiday.

Country: ${country_name} (${country_code})
Holiday: ${holiday_name_en}${holiday_name_local ? ` (${holiday_name_local})` : ''}
Date: ${sample_date} (${weekday})
Holiday category: ${category}

Output a single JSON object with EXACTLY these 5 fields:

{
  "what_is_it": "1-2 sentences. What this holiday is and why locals observe it. Plain English, no jargon. Do NOT lecture about history — focus on what makes it culturally distinctive in 30 seconds.",
  "traveler_impact": "1-2 sentences. How this holiday affects an INTERNATIONAL TRAVELER's day. Concrete impacts: transport bookings, road traffic, attraction crowds, business closures. NO generic statements like 'expect crowds' — specify which crowds where.",
  "cautions": "1-2 sentences. SPECIFIC things travelers should avoid or watch out for. Skip if there's nothing concrete to warn about — return empty string '' rather than padding.",
  "recommendations": "1-2 sentences. What a smart traveler does INSTEAD or alongside. Concrete alternatives: a less-crowded area, a related cultural event worth attending, a good day-trip option. Skip if you don't have something concrete — return empty string ''.",
  "practical_tips": "2-3 sentences. The single most actionable section. Concrete, numeric, time-bound advice. NEVER skip this field."
}

CONSTRAINTS:
1. PARAPHRASE ALL FACTS in your own words. Do NOT copy phrases from any source.
2. Stay practical, not promotional. No tourism-board fluff like "vibrant celebrations".
3. Stay neutral on religion and politics. State facts, not opinions.
4. Use figures travelers can act on. Avoid vague hedges like "may", "might", "could potentially".
5. ALWAYS fill what_is_it — even for quiet holidays with little traveler impact. Every traveler who sees a closed sign deserves to know what the day commemorates.
6. If the holiday has minimal traveler impact, be honest: return empty strings for cautions/recommendations rather than inventing warnings. Keep traveler_impact short and factual.
7. Output ONLY the JSON object. No preamble, no markdown code fences.

Then, on a separate line AFTER the JSON, output:
SOURCES: ["url1", "url2", "url3"]

3+ source URLs you used. Prefer primary sources: official government tourism sites, Wikipedia, established travel guides.`;
}

// ---------- HELPERS ----------
function parseGeminiOutput(raw) {
  // Strip markdown fences if Gemini ignored the rule
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

  // Split JSON body from SOURCES line
  const sourcesMatch = text.match(/SOURCES\s*:\s*(\[[\s\S]*?\])\s*$/i);
  let sources = [];
  let jsonText = text;
  if (sourcesMatch) {
    try {
      sources = JSON.parse(sourcesMatch[1]);
    } catch (e) {
      console.warn('  ⚠ Could not parse SOURCES line:', sourcesMatch[1]);
    }
    jsonText = text.slice(0, sourcesMatch.index).trim();
  }

  // Strip trailing comma before } if model added one
  jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');

  let obj;
  try {
    obj = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse JSON body: ${e.message}\n--- raw output ---\n${raw}`);
  }

  // Normalize fields
  return {
    what_is_it: (obj.what_is_it || '').trim(),
    traveler_impact: (obj.traveler_impact || '').trim(),
    cautions: (obj.cautions || '').trim(),
    recommendations: (obj.recommendations || '').trim(),
    practical_tips: (obj.practical_tips || '').trim(),
    source_urls: Array.isArray(sources) ? sources : [],
  };
}

function weekdayName(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
}

// ---------- CORE ----------
async function findHolidaysForTarget(countryId, target) {
  // Find all rows matching by exact name OR by related keywords (for
  // substitute rows like "Substitute Holiday (X)").
  const { data: directMatches, error } = await supabase
    .from('holidays')
    .select('*')
    .eq('country_id', countryId)
    .ilike('name', `%${target.match_name}%`)
    .order('date', { ascending: true });

  if (error) throw error;

  // For substitute holidays where name = "Substitute Holiday (X)",
  // ILIKE %X% covers it. eve / day_after rows have name = X, also covered.
  return directMatches || [];
}

async function generateTipForTarget(countryRow, target, options) {
  console.log(`\n=== Target: ${target.key} (${target.match_name}) ===`);

  const matched = await findHolidaysForTarget(countryRow.id, target);
  if (matched.length === 0) {
    console.log(`  ⚠ No holidays matched. Skipping.`);
    return { skipped: true, reason: 'no_matches' };
  }
  console.log(`  Found ${matched.length} matching rows:`);
  for (const h of matched) {
    console.log(`    [id=${h.id}] ${h.date} ${h.name} (${h.holiday_category})`);
  }

  // Pick anchor: prefer regular, fall back to first
  const anchor = matched.find((h) => h.holiday_category === 'regular') || matched[0];
  console.log(`  Anchor: id=${anchor.id} ${anchor.date} ${anchor.name}`);

  // Skip if any of the matched rows already has a tip (don't dup-insert)
  const ids = matched.map((h) => h.id);
  const { data: existing, error: existErr } = await supabase
    .from('travel_tips')
    .select('holiday_id')
    .in('holiday_id', ids);
  if (existErr) throw existErr;
  if (existing && existing.length > 0) {
    console.log(`  ⏭  Skipping — ${existing.length} tip(s) already exist for this holiday set.`);
    return { skipped: true, reason: 'tip_exists', existing: existing.length };
  }

  // Build prompt
  const userPrompt = buildUserPrompt({
    country_name: countryRow.name,
    country_code: countryRow.code,
    holiday_name_en: anchor.name,
    holiday_name_local: anchor.name_local,
    sample_date: anchor.date,
    weekday: weekdayName(anchor.date),
    category: anchor.holiday_category || 'regular',
  });

  console.log(`  → Calling Gemini (gemini-2.5-flash)...`);
  const t0 = Date.now();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  });
  const raw = result.response.text();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✓ Got response in ${elapsed}s`);

  const parsed = parseGeminiOutput(raw);
  console.log(`  Parsed fields:`);
  console.log(`    what_is_it       (${parsed.what_is_it.length} chars)`);
  console.log(`    traveler_impact  (${parsed.traveler_impact.length} chars)`);
  console.log(`    cautions         (${parsed.cautions.length} chars)`);
  console.log(`    recommendations  (${parsed.recommendations.length} chars)`);
  console.log(`    practical_tips   (${parsed.practical_tips.length} chars)`);
  console.log(`    source_urls      (${parsed.source_urls.length} urls)`);

  if (options.dryRun) {
    console.log(`\n--- DRY RUN — would insert ${matched.length} rows ---`);
    console.log(JSON.stringify(parsed, null, 2));
    return { skipped: false, dryRun: true, parsed };
  }

  // Insert one row per matched holiday — same content, different holiday_id
  const rows = matched.map((h) => ({
    country_id: countryRow.id,
    holiday_id: h.id,
    title: anchor.name,
    what_is_it: parsed.what_is_it || null,
    traveler_impact: parsed.traveler_impact || null,
    cautions: parsed.cautions || null,
    recommendations: parsed.recommendations || null,
    practical_tips: parsed.practical_tips || null,
    source_urls: parsed.source_urls.length > 0 ? parsed.source_urls : null,
    language: 'en',
    ai_model: 'gemini-2.5-flash',
    moderation_status: 'pending',
  }));

  const { data: inserted, error: insErr } = await supabase
    .from('travel_tips')
    .insert(rows)
    .select('id, holiday_id');
  if (insErr) throw insErr;
  console.log(`  ✅ Inserted ${inserted.length} travel_tips rows (status=pending)`);

  return { skipped: false, inserted: inserted.length, ids: inserted.map((r) => r.id) };
}

// ---------- MAIN ----------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlyKey = onlyArg ? onlyArg.split('=')[1] : null;

  console.log(`generate-travel-tips.js`);
  console.log(`  dryRun=${dryRun}  onlyKey=${onlyKey || '(all)'}`);

  // Load country (KR for now — multi-country comes later)
  const { data: country, error: cErr } = await supabase
    .from('countries')
    .select('*')
    .eq('code', 'KR')
    .maybeSingle();
  if (cErr || !country) {
    console.error('Failed to load country KR', cErr);
    process.exit(1);
  }

  const targets = onlyKey
    ? HOLIDAY_TARGETS.filter((t) => t.key === onlyKey)
    : HOLIDAY_TARGETS;

  if (targets.length === 0) {
    console.error(`No targets matched onlyKey=${onlyKey}`);
    process.exit(1);
  }

  const summary = [];
  for (const target of targets) {
    try {
      const r = await generateTipForTarget(country, target, { dryRun });
      summary.push({ key: target.key, ...r });
    } catch (e) {
      console.error(`  ❌ ${target.key} failed:`, e.message);
      summary.push({ key: target.key, error: e.message });
    }
  }

  console.log(`\n=== SUMMARY ===`);
  for (const s of summary) {
    if (s.error) console.log(`  ❌ ${s.key}: ${s.error}`);
    else if (s.skipped) console.log(`  ⏭  ${s.key}: skipped (${s.reason})`);
    else if (s.dryRun) console.log(`  🧪 ${s.key}: dry-run OK`);
    else console.log(`  ✅ ${s.key}: inserted ${s.inserted} rows`);
  }
  console.log(`\nDone.`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
