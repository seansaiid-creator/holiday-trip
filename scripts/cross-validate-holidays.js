// ==========================================================
// cross-validate-holidays.js (v2 - optimized)
//
// Key optimizations:
//   1. JS pre-matching: obvious matches and exact name matches are
//      classified without ever calling Gemini.
//   2. Batched Gemini judging: only cases needing AI judgment are sent,
//      and they are sent in a SINGLE batched prompt (not one call per date).
//   3. Expected Gemini calls per country: ~2 (1 for Wikipedia extraction,
//      1 for batch judging) instead of 68.
//
// MODE: Diagnostic only. DOES NOT modify the DB.
//
// USAGE:
//   node scripts/cross-validate-holidays.js
// ==========================================================

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const stringSimilarity = require('string-similarity');

const { fetchWikipediaHolidays } = require('./fetch-wikipedia-holidays');
const { fetchNagerHolidaysMultiYear } = require('./fetch-nager-holidays');

// --- Config ---
const COUNTRY_CODE = 'JP';
const COUNTRY_NAME = 'Japan';
const YEARS = [2025, 2026, 2027];

// Similarity thresholds
const AUTO_MATCH_THRESHOLD = 0.85;   // >= this = definitely same holiday
const NEEDS_JUDGE_THRESHOLD = 0.4;   // >= this but < AUTO = ask Gemini
                                      // < this = probably different holiday

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================================
// STEP 1: Fetch our DB's holidays
// ==========================================================
async function fetchDbHolidays() {
  const { data: country } = await supabase
    .from('countries')
    .select('id, code, name')
    .eq('code', COUNTRY_CODE)
    .maybeSingle();
  if (!country) throw new Error(`Country ${COUNTRY_CODE} not found in DB`);

  const { data, error } = await supabase
    .from('holidays')
    .select('id, date, name, name_local, holiday_category, is_substitute, year, data_source, manual_locked')
    .eq('country_id', country.id)
    .in('year', YEARS)
    .order('date');
  if (error) throw error;

  // Filter out manual_locked rows — these are excluded from re-validation
  const lockedCount = data.filter((h) => h.manual_locked).length;
  if (lockedCount > 0) {
    console.log(`   🔒 Excluding ${lockedCount} manual_locked row(s) from validation`);
  }
  const filtered = data.filter((h) => !h.manual_locked);

  return filtered.map((h) => ({
    db_id: h.id,
    date: h.date,
    name_en: h.name,
    name_local: h.name_local,
    category: h.holiday_category || 'regular',
    is_substitute: h.is_substitute,
    source: 'db',
  }));
}

// ==========================================================
// STEP 2: Group all sources by date
// ==========================================================
function groupByDate(dbHolidays, wikiHolidays, nagerHolidays) {
  const map = new Map();
  const ensure = (date) => {
    if (!map.has(date)) map.set(date, { date, db: [], wikipedia: [], nager: [] });
    return map.get(date);
  };
  dbHolidays.forEach((h) => ensure(h.date).db.push(h));
  wikiHolidays.forEach((h) => ensure(h.date).wikipedia.push(h));
  nagerHolidays.forEach((h) => ensure(h.date).nager.push(h));
  return map;
}

// ==========================================================
// STEP 3: JS PRE-MATCHING — free classification for obvious cases
// ==========================================================

/**
 * Normalize a holiday name for comparison.
 * Lowercase, strip punctuation, collapse whitespace, remove common noise words.
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')       // remove parentheticals
    .replace(/[^\w\s가-힣]/g, ' ')      // keep word chars and Hangul
    .replace(/\b(day|holiday|the|of|observed)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute best similarity between two arrays of holiday entries for one date.
 * Returns the max pairwise similarity between any DB entry and any external
 * source entry. We compare against DB specifically because DB is our source
 * of record being validated.
 */
function bestPairSimilarity(entriesA, entriesB) {
  if (entriesA.length === 0 || entriesB.length === 0) return 0;
  let best = 0;
  for (const a of entriesA) {
    const nameA = normalizeName(a.name_en || a.name || '');
    if (!nameA) continue;
    for (const b of entriesB) {
      const nameB = normalizeName(b.name_en || b.name || '');
      if (!nameB) continue;
      const sim = stringSimilarity.compareTwoStrings(nameA, nameB);
      if (sim > best) best = sim;
    }
  }
  return best;
}

/**
 * JS pre-classify a single date group.
 * Returns either a final classification OR { needs_judge: true, reason }.
 */
function preClassify(group) {
  const inDb = group.db.length > 0;
  const inWiki = group.wikipedia.length > 0;
  const inNager = group.nager.length > 0;
  const presenceCount = [inDb, inWiki, inNager].filter(Boolean).length;

  // Case: only 1 source has it
  if (presenceCount === 1) {
    if (!inDb) {
      // Missing from DB but present elsewhere → needs judgment
      return { needs_judge: true, reason: 'missing_in_db_candidate' };
    }
    // Only in DB (probably temporary/substitute holiday Wiki/Nager doesn't track)
    // Judgment: single_source is normal for temporary/substitute in our DB.
    // Check if it's a substitute or temporary — those are expected to be DB-only.
    const entry = group.db[0];
    const isExpectedDbOnly =
      entry.is_substitute ||
      entry.category === 'substitute' ||
      entry.category === 'temporary' ||
      /substitute|temporary|election/i.test(entry.name_en || '');
    if (isExpectedDbOnly) {
      return {
        verification_status: 'single_source',
        present_in: { db: true, wikipedia: false, nager: false },
        recommended_name_en: entry.name_en,
        issue: null,
        action: 'keep_as_is',
        note: 'Substitute/temporary holiday only in our DB (expected).',
      };
    }
    // Regular holiday only in DB — suspicious, ask Gemini
    return { needs_judge: true, reason: 'db_only_regular' };
  }

  // Case: 2 or 3 sources have it — check name similarity
  // Compare the strongest pair that includes DB (if DB is present) or any pair
  const allSources = [];
  if (inDb) allSources.push({ name: 'db', entries: group.db });
  if (inWiki) allSources.push({ name: 'wikipedia', entries: group.wikipedia });
  if (inNager) allSources.push({ name: 'nager', entries: group.nager });

  // Compute pairwise similarities between all source pairs
  let minSim = 1;
  let maxSim = 0;
  for (let i = 0; i < allSources.length; i++) {
    for (let j = i + 1; j < allSources.length; j++) {
      const sim = bestPairSimilarity(allSources[i].entries, allSources[j].entries);
      if (sim < minSim) minSim = sim;
      if (sim > maxSim) maxSim = sim;
    }
  }

  if (minSim >= AUTO_MATCH_THRESHOLD) {
    // All pairs similar enough → auto verify
    const bestName = chooseBestName(group);
    return {
      verification_status: presenceCount === 3 ? 'verified_high' : 'verified_mid',
      present_in: { db: inDb, wikipedia: inWiki, nager: inNager },
      recommended_name_en: bestName,
      issue: null,
      action: 'keep_as_is',
      note: `Auto-matched by JS (min similarity ${minSim.toFixed(2)}).`,
    };
  }

  if (maxSim < NEEDS_JUDGE_THRESHOLD && inDb && (inWiki || inNager)) {
    // Very different names — likely different holidays on same date
    // (e.g. Children's Day + Buddha's Birthday both on May 5, 2025)
    return { needs_judge: true, reason: 'very_different_names_same_date' };
  }

  // Between thresholds → needs Gemini judgment
  return { needs_judge: true, reason: `similarity ${minSim.toFixed(2)}-${maxSim.toFixed(2)}` };
}

/**
 * Pick the "best" English name when sources agree it's the same holiday.
 * Preference: Wikipedia (usually most formal/official) > DB > Nager.
 */
function chooseBestName(group) {
  if (group.wikipedia.length > 0 && group.wikipedia[0].name_en) {
    return group.wikipedia[0].name_en;
  }
  if (group.db.length > 0 && group.db[0].name_en) {
    return group.db[0].name_en;
  }
  if (group.nager.length > 0) {
    return group.nager[0].name || group.nager[0].name_en;
  }
  return null;
}

// ==========================================================
// STEP 4: BATCHED Gemini judgment for ambiguous cases
// ==========================================================

async function batchJudgeWithGemini(ambiguousCases) {
  if (ambiguousCases.length === 0) return {};

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  // Build a compact representation for Gemini
  const items = ambiguousCases.map((c, idx) => ({
    id: idx,
    date: c.date,
    db: c.group.db.map((x) => ({ name: x.name_en, category: x.category })),
    wikipedia: c.group.wikipedia.map((x) => ({ name: x.name_en, category: x.category })),
    nager: c.group.nager.map((x) => ({ name: x.name || x.name_en })),
    reason: c.reason,
  }));

  const prompt = `You are judging public holiday data validation cases for ${COUNTRY_NAME}.

For each case below, decide if the entries across DB, Wikipedia, and Nager.Date refer to the SAME public holiday on that date.

Key judgments:
- Name variants like "Liberation Day" vs "National Liberation Day of Korea" describe the SAME holiday.
- Nager.Date often omits substitute holidays and temporary holidays — their absence there is normal.
- Wikipedia sometimes uses traditional names (e.g. "Korean New Year" vs "Lunar New Year") — still the same holiday.
- Multiple DISTINCT holidays can fall on the same date (e.g. Children's Day + Buddha's Birthday on May 5, 2025) — that's not a conflict, all sources just list the same two holidays.

For each case, pick ONE status:
- "verified_high": present in DB + Wikipedia + Nager, all refer to the same holiday(s)
- "verified_mid": present in exactly 2 sources, same holiday
- "single_source": present in only 1 source (and that's expected — e.g. substitute/temporary only in DB)
- "conflict": sources disagree on what the holiday IS (not just different names)
- "missing_in_db": Wikipedia/Nager have a holiday our DB is missing (action: add_to_db)

Output ONLY valid JSON. No markdown, no code fences. Format:
{
  "judgments": [
    {
      "id": 0,
      "verification_status": "verified_high" | "verified_mid" | "single_source" | "conflict" | "missing_in_db",
      "recommended_name_en": "the best English name, or null",
      "issue": "short description of any real discrepancy, or null",
      "action": "keep_as_is" | "update_db_name" | "add_to_db" | "remove_from_db" | "manual_review"
    }
  ]
}

CASES:
${JSON.stringify(items, null, 2)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('   ❌ Failed to parse batch judgment response:');
    console.error('   First 500 chars:', cleaned.slice(0, 500));
    throw err;
  }

  if (!Array.isArray(parsed.judgments)) {
    throw new Error('Expected judgments array');
  }

  // Build id -> judgment map
  const byId = {};
  for (const j of parsed.judgments) {
    byId[j.id] = j;
  }
  return byId;
}

// ==========================================================
// MAIN
// ==========================================================
async function main() {
  const startTime = Date.now();
  console.log(`🔍 3-source cross-validation for ${COUNTRY_NAME} (v2 optimized)`);
  console.log(`   Years: ${YEARS.join(', ')}`);
  console.log(`   Mode: DIAGNOSTIC ONLY (no DB changes)\n`);

  // --- Fetch ---
  console.log('━'.repeat(60));
  console.log('1️⃣  Fetching from all sources');
  console.log('━'.repeat(60));

  console.log('\n📦 Source 1: Our DB');
  const dbHolidays = await fetchDbHolidays();
  console.log(`   ✓ ${dbHolidays.length} holidays from DB`);

  console.log('\n📦 Source 2: Wikipedia');
  const wikiHolidays = await fetchWikipediaHolidays(COUNTRY_CODE, YEARS, COUNTRY_NAME);
  console.log(`   ✓ ${wikiHolidays.length} holidays from Wikipedia`);

  console.log('\n📦 Source 3: Nager.Date');
  const nagerHolidays = await fetchNagerHolidaysMultiYear(COUNTRY_CODE, YEARS);
  console.log(`   ✓ ${nagerHolidays.length} holidays from Nager.Date`);

  // --- Group ---
  console.log('\n' + '━'.repeat(60));
  console.log('2️⃣  Grouping entries by date');
  console.log('━'.repeat(60));
  const grouped = groupByDate(dbHolidays, wikiHolidays, nagerHolidays);
  console.log(`\n✓ ${grouped.size} unique dates to validate\n`);

  // --- JS pre-classify ---
  console.log('━'.repeat(60));
  console.log('3️⃣  JS pre-matching (free, no Gemini calls)');
  console.log('━'.repeat(60) + '\n');

  const results = [];
  const ambiguous = [];

  for (const [date, group] of grouped) {
    const pre = preClassify(group);
    if (pre.needs_judge) {
      ambiguous.push({ date, group, reason: pre.reason });
      results.push({ date, group, _pending: true });
    } else {
      results.push({ date, group, ...pre });
    }
  }

  const autoCount = results.filter((r) => !r._pending).length;
  console.log(`   ✓ ${autoCount} dates auto-classified by JS (${Math.round(autoCount / grouped.size * 100)}%)`);
  console.log(`   ⚖️  ${ambiguous.length} dates need Gemini judgment`);

  // --- Batched Gemini judgment ---
  if (ambiguous.length > 0) {
    console.log('\n' + '━'.repeat(60));
    console.log('4️⃣  Gemini batch judgment (1 call for all ambiguous cases)');
    console.log('━'.repeat(60) + '\n');
    console.log(`   🤖 Judging ${ambiguous.length} cases in a single batch call...`);

    try {
      const judgments = await batchJudgeWithGemini(ambiguous);
      console.log(`   ✓ Received ${Object.keys(judgments).length} judgments`);

      // Merge judgments back into results
      let ambIdx = 0;
      for (const r of results) {
        if (r._pending) {
          const j = judgments[ambIdx];
          if (j) {
            r.verification_status = j.verification_status;
            r.recommended_name_en = j.recommended_name_en;
            r.issue = j.issue;
            r.action = j.action;
            r.present_in = {
              db: r.group.db.length > 0,
              wikipedia: r.group.wikipedia.length > 0,
              nager: r.group.nager.length > 0,
            };
            r.note = 'Judged by Gemini (batch)';
          } else {
            r.verification_status = 'conflict';
            r.issue = 'Gemini batch did not return judgment for this case';
            r.action = 'manual_review';
          }
          delete r._pending;
          ambIdx++;
        }
      }
    } catch (err) {
      console.error(`   ❌ Batch judgment failed: ${err.message}`);
      for (const r of results) {
        if (r._pending) {
          r.verification_status = 'conflict';
          r.issue = `Gemini batch error: ${err.message}`;
          r.action = 'manual_review';
          delete r._pending;
        }
      }
    }
  }

  // --- Report ---
  console.log('\n' + '━'.repeat(60));
  console.log('5️⃣  Report');
  console.log('━'.repeat(60) + '\n');

  const summary = {
    verified_high: 0,
    verified_mid: 0,
    single_source: 0,
    conflict: 0,
    missing_in_db: 0,
  };
  for (const r of results) {
    const s = r.verification_status;
    if (s in summary) summary[s]++;
  }

  console.log('📊 SUMMARY');
  console.log('─'.repeat(40));
  console.log(`   ✅ verified_high:  ${summary.verified_high}`);
  console.log(`   ✅ verified_mid:   ${summary.verified_mid}`);
  console.log(`   ⚠️  single_source: ${summary.single_source}`);
  console.log(`   ⚠️  conflict:      ${summary.conflict}`);
  console.log(`   🚨 missing_in_db:  ${summary.missing_in_db}`);
  console.log('');

  // Print problems in detail
  const problems = results
    .filter((r) => ['conflict', 'missing_in_db'].includes(r.verification_status))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (problems.length > 0) {
    console.log('🚨 ISSUES REQUIRING ATTENTION');
    console.log('─'.repeat(40));
    for (const p of problems) {
      console.log(`\n  📅 ${p.date}  [${p.verification_status}]`);
      console.log(`     DB:        ${p.group.db.length > 0 ? p.group.db.map((x) => x.name_en).join(', ') : '(none)'}`);
      console.log(`     Wikipedia: ${p.group.wikipedia.length > 0 ? p.group.wikipedia.map((x) => x.name_en).join(', ') : '(none)'}`);
      console.log(`     Nager:     ${p.group.nager.length > 0 ? p.group.nager.map((x) => x.name || x.name_en).join(', ') : '(none)'}`);
      if (p.issue) console.log(`     💬 ${p.issue}`);
      if (p.recommended_name_en) console.log(`     → recommended: ${p.recommended_name_en}`);
      if (p.action) console.log(`     → action: ${p.action}`);
    }
  }

  // --- Save detailed report ---
  const reportDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const runId = `${COUNTRY_CODE}-${new Date().toISOString().slice(0, 10)}`;
  const reportPath = path.join(reportDir, `validation-${runId}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        validation_run_id: runId,
        country: COUNTRY_NAME,
        country_code: COUNTRY_CODE,
        years: YEARS,
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        summary,
        source_counts: {
          db: dbHolidays.length,
          wikipedia: wikiHolidays.length,
          nager: nagerHolidays.length,
        },
        optimization: {
          auto_classified_by_js: autoCount,
          needed_gemini_judgment: ambiguous.length,
          total_gemini_calls: ambiguous.length > 0 ? 2 : 1,
        },
        results,
      },
      null,
      2
    )
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n💾 Detailed report: ${reportPath}`);
  console.log(`⏱️  Total duration: ${duration}s`);
  console.log(`🤖 Total Gemini calls: ~${ambiguous.length > 0 ? 2 : 1} (vs ~68 in v1)`);
  console.log('\n✅ Validation complete. No DB changes were made.');
  console.log('\n💡 To apply these results to the DB:');
  console.log(`   node scripts/apply-validation.js ${path.basename(reportPath)}`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
