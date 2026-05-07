/**
 * generate-travel-tips-patch.js
 *
 * Patches skipped holidays from the multi-country run.
 *
 * USAGE
 *   node scripts/generate-travel-tips-patch.js --dry-run
 *   node scripts/generate-travel-tips-patch.js
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

const PATCH_TARGETS = [
  { country_code: 'US', key: 'us_presidents',  match_name: 'Presidents Day' },
  { country_code: 'US', key: 'us_juneteenth',  match_name: 'Juneteenth' },
  { country_code: 'VN', key: 'vn_tet',         match_name: 'Tet' },
  { country_code: 'VN', key: 'vn_hungking',    match_name: 'Hung King' },
  { country_code: 'GB', key: 'gb_newyear',     match_name: 'New Year' },
  { country_code: 'GB', key: 'gb_eastermonday',match_name: 'Easter Monday' },
  { country_code: 'GB', key: 'gb_summerbank',  match_name: 'Summer Bank' },
];

const SYSTEM_INSTRUCTION = `You are a travel information writer for HolidayTrip, a global travel guide focused on public holidays and their practical impact on visitors. Your audience is INTERNATIONAL TRAVELERS (not locals) who are visiting the country during this holiday. Write in clear, practical English.`;

function buildUserPrompt(args) {
  const { country_name, country_code, holiday_name_en, holiday_name_local, sample_date, weekday, category } = args;
  return `Generate a travel tip for international visitors about the following public holiday.

Country: ${country_name} (${country_code})
Holiday: ${holiday_name_en}${holiday_name_local ? ' (' + holiday_name_local + ')' : ''}
Date: ${sample_date} (${weekday})
Holiday category: ${category}

Output a single JSON object with EXACTLY these 5 fields:
{
  "what_is_it": "1-2 sentences explaining the holiday.",
  "traveler_impact": "1-2 sentences on concrete traveler impact.",
  "cautions": "1-2 sentences of specific warnings. Empty string if none.",
  "recommendations": "1-2 sentences of recommendations. Empty string if none.",
  "practical_tips": "2-3 sentences of actionable advice."
}

Then on a separate line:
SOURCES: ["url1", "url2", "url3"]

Output ONLY the JSON + SOURCES line. No markdown fences.`;
}

function parseGeminiOutput(raw) {
  var text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  var sourcesMatch = text.match(/SOURCES\s*:\s*(\[[\s\S]*?\])\s*$/i);
  var sources = [];
  var jsonText = text;
  if (sourcesMatch) {
    try { sources = JSON.parse(sourcesMatch[1]); } catch (e) {}
    jsonText = text.slice(0, sourcesMatch.index).trim();
  }
  jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
  var obj = JSON.parse(jsonText);
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
  var d = new Date(isoDate + 'T00:00:00');
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
}

async function main() {
  var args   = process.argv.slice(2);
  var dryRun = args.includes('--dry-run');
  console.log('generate-travel-tips-patch.js  dryRun=' + dryRun + '\n');

  var summary = [];

  for (var i = 0; i < PATCH_TARGETS.length; i++) {
    var target = PATCH_TARGETS[i];
    console.log('\n[' + target.country_code + '] ' + target.key + ' -- searching "%' + target.match_name + '%"');

    var cRes = await supabase.from('countries').select('*').eq('code', target.country_code).maybeSingle();
    var countryRow = cRes.data;
    if (!countryRow) { console.log('  Country not found'); continue; }

    var hRes = await supabase.from('holidays').select('*')
      .eq('country_id', countryRow.id)
      .ilike('name', '%' + target.match_name + '%')
      .order('date', { ascending: true });
    var matched = hRes.data || [];

    if (matched.length === 0) {
      console.log('  No matches found in DB. Skipping.');
      summary.push({ code: target.country_code, key: target.key, skipped: true, reason: 'no_matches' });
      continue;
    }
    console.log('  Found ' + matched.length + ' rows:');
    matched.forEach(function(h) {
      console.log('    [id=' + h.id + '] ' + h.date + ' ' + h.name + ' (' + h.holiday_category + ')');
    });

    var ids = matched.map(function(h) { return h.id; });
    var eRes = await supabase.from('travel_tips').select('holiday_id').in('holiday_id', ids);
    var existing = eRes.data || [];
    if (existing.length > 0) {
      console.log('  Already has ' + existing.length + ' tip(s). Skipping.');
      summary.push({ code: target.country_code, key: target.key, skipped: true, reason: 'tip_exists' });
      continue;
    }

    var anchor = matched.find(function(h) { return h.holiday_category === 'regular'; }) || matched[0];
    var userPrompt = buildUserPrompt({
      country_name: countryRow.name,
      country_code: countryRow.code,
      holiday_name_en: anchor.name,
      holiday_name_local: anchor.name_local,
      sample_date: anchor.date,
      weekday: weekdayName(anchor.date),
      category: anchor.holiday_category || 'regular',
    });

    console.log('  Calling Gemini...');
    var t0 = Date.now();
    var result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    });
    var raw = result.response.text();
    console.log('  Got response in ' + ((Date.now()-t0)/1000).toFixed(1) + 's');

    var parsed;
    try { parsed = parseGeminiOutput(raw); }
    catch(e) {
      console.error('  Parse failed: ' + e.message);
      summary.push({ code: target.country_code, key: target.key, error: e.message });
      continue;
    }

    if (dryRun) {
      console.log('  DRY RUN -- would insert ' + matched.length + ' rows');
      summary.push({ code: target.country_code, key: target.key, dryRun: true });
      continue;
    }

    var rows = matched.map(function(h) {
      return {
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
        moderation_status: 'approved',
      };
    });

    var insRes = await supabase.from('travel_tips').insert(rows).select('id, holiday_id');
    if (insRes.error) {
      console.error('  Insert failed: ' + insRes.error.message);
      summary.push({ code: target.country_code, key: target.key, error: insRes.error.message });
      continue;
    }
    console.log('  Inserted ' + insRes.data.length + ' rows');
    summary.push({ code: target.country_code, key: target.key, inserted: insRes.data.length });

    await new Promise(function(res) { setTimeout(res, 1500); });
  }

  console.log('\n=== SUMMARY ===');
  summary.forEach(function(s) {
    if (s.error)        console.log('  [' + s.code + '] ' + s.key + ': ERROR - ' + s.error);
    else if (s.skipped) console.log('  [' + s.code + '] ' + s.key + ': skipped (' + s.reason + ')');
    else if (s.dryRun)  console.log('  [' + s.code + '] ' + s.key + ': dry-run OK');
    else                console.log('  [' + s.code + '] ' + s.key + ': inserted ' + s.inserted + ' rows');
  });
  console.log('\nDone.');
}

main().catch(function(e) { console.error('Fatal:', e); process.exit(1); });
