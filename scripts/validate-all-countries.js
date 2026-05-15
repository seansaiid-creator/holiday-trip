// ==========================================================
// validate-all-countries.js
//
// Runs cross-validation on multiple countries sequentially.
// Writes per-country JSON reports (same format as cross-validate-holidays.js)
// plus a combined summary report.
//
// Currently targets the 8 countries with Wikipedia page mappings.
// Extend WIKIPEDIA_PAGE_NAMES in fetch-wikipedia-holidays.js to add more.
//
// MODE: Diagnostic only. DOES NOT modify the DB.
// Use apply-validation.js per country to apply specific reports.
//
// USAGE:
//   node scripts/validate-all-countries.js
//   node scripts/validate-all-countries.js --only KR,JP   # subset
// ==========================================================

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { fetchWikipediaHolidays } = require('./fetch-wikipedia-holidays');
const { fetchNagerHolidaysMultiYear } = require('./fetch-nager-holidays');

// --- Config ---
const YEARS = [2025, 2026, 2027];
const AUTO_MATCH_THRESHOLD = 0.85;
const NEEDS_JUDGE_THRESHOLD = 0.4;

// 8 countries with existing Wikipedia mapping
const TARGET_COUNTRIES = [
  { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' },
  { code: 'US', name: 'United States' },
  { code: 'TH', name: 'Thailand' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'CN', name: 'China' },
];

// Parse --only CLI flag (optional)
function parseOnlyFlag() {
  const onlyIdx = process.argv.indexOf('--only');
  if (onlyIdx === -1) return null;
  const codes = (process.argv[onlyIdx + 1] || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  return codes.length > 0 ? codes : null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================================
// Shared validation logic (same as cross-validate-holidays.js)
// Duplicated here so this script is self-contained.
// TODO: refactor into a shared module later.
// ==========================================================

async function fetchDbHolidays(countryCode) {
  const { data: country } = await supabase
    .from('countries')
    .select('id')
    .eq('code', countryCode)
    .maybeSingle();
  if (!country) throw new Error(`Country ${countryCode} not found in DB`);

  const { data, error } = await supabase
    .from('holidays')
    .select('id, date, name, name_local, holiday_category, is_substitute, year, data_source, manual_locked')
    .eq('country_id', country.id)
    .in('year', YEARS)
    .order('date');
  if (error) throw error;

  const lockedCount = data.filter((h) => h.manual_locked).length;
  const filtered = data.filter((h) => !h.manual_locked);
  return {
    holidays: filtered.map((h) => ({
      db_id: h.id,
      date: h.date,
      name_en: h.name,
      name_local: h.name_local,
      category: h.holiday_category || 'regular',
      is_substitute: h.is_substitute,
      source: 'db',
    })),
    lockedCount,
    totalCount: data.length,
    countryId: country.id,
  };
}

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

function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\w\s가-힣]/g, ' ')
    .replace(/\b(day|holiday|the|of|observed)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function chooseBestName(group) {
  if (group.wikipedia.length > 0 && group.wikipedia[0].name_en) return group.wikipedia[0].name_en;
  if (group.db.length > 0 && group.db[0].name_en) return group.db[0].name_en;
  if (group.nager.length > 0) return group.nager[0].name || group.nager[0].name_en;
  return null;
}

function preClassify(group) {
  const inDb = group.db.length > 0;
  const inWiki = group.wikipedia.length > 0;
  const inNager = group.nager.length > 0;
  const presenceCount = [inDb, inWiki, inNager].filter(Boolean).length;

  if (presenceCount === 1) {
    if (!inDb) return { needs_judge: true, reason: 'missing_in_db_candidate' };
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
    return { needs_judge: true, reason: 'db_only_regular' };
  }

  const allSources = [];
  if (inDb) allSources.push({ name: 'db', entries: group.db });
  if (inWiki) allSources.push({ name: 'wikipedia', entries: group.wikipedia });
  if (inNager) allSources.push({ name: 'nager', entries: group.nager });

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
    return {
      verification_status: presenceCount === 3 ? 'verified_high' : 'verified_mid',
      present_in: { db: inDb, wikipedia: inWiki, nager: inNager },
      recommended_name_en: chooseBestName(group),
      issue: null,
      action: 'keep_as_is',
      note: `Auto-matched by JS (min similarity ${minSim.toFixed(2)}).`,
    };
  }

  if (maxSim < NEEDS_JUDGE_THRESHOLD && inDb && (inWiki || inNager)) {
    return { needs_judge: true, reason: 'very_different_names_same_date' };
  }

  return { needs_judge: true, reason: `similarity ${minSim.toFixed(2)}-${maxSim.toFixed(2)}` };
}

async function batchJudgeWithGemini(ambiguousCases, countryName) {
  if (ambiguousCases.length === 0) return {};

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const items = ambiguousCases.map((c, idx) => ({
    id: idx,
    date: c.date,
    db: c.group.db.map((x) => ({ name: x.name_en, category: x.category })),
    wikipedia: c.group.wikipedia.map((x) => ({ name: x.name_en, category: x.category })),
    nager: c.group.nager.map((x) => ({ name: x.name || x.name_en })),
    reason: c.reason,
  }));

  const prompt = `You are judging public holiday data validation cases for ${countryName}.

For each case, decide if the entries across DB, Wikipedia, and Nager.Date refer to the SAME public holiday on that date.

Key judgments:
- Name variants like "Liberation Day" vs "National Liberation Day" describe the SAME holiday.
- Nager.Date often omits substitute and temporary holidays — absence there is normal.
- Wikipedia sometimes uses traditional names — still the same holiday.
- Multiple DISTINCT holidays can fall on the same date — that's not a conflict.

Pick ONE status per case:
- "verified_high": present in DB + Wikipedia + Nager, same holiday
- "verified_mid": present in exactly 2 sources, same holiday
- "single_source": present in only 1 source (expected for substitute/temporary)
- "conflict": sources disagree on what the holiday IS
- "missing_in_db": Wikipedia/Nager have a holiday our DB is missing

Output ONLY valid JSON:
{
  "judgments": [
    {
      "id": 0,
      "verification_status": "...",
      "recommended_name_en": "...",
      "issue": "...",
      "action": "keep_as_is | update_db_name | add_to_db | remove_from_db | manual_review"
    }
  ]
}

CASES:
${JSON.stringify(items, null, 2)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  const parsed = JSON.parse(cleaned);
  const byId = {};
  for (const j of parsed.judgments) byId[j.id] = j;
  return byId;
}

// ==========================================================
// Single-country validation — returns structured result
// ==========================================================
async function validateOneCountry(country) {
  const { code, name } = country;
  const startTime = Date.now();

  try {
    // Fetch 3 sources
    const { holidays: dbHolidays, lockedCount, totalCount } = await fetchDbHolidays(code);
    const wikiHolidays = await fetchWikipediaHolidays(code, YEARS, name);
    const nagerHolidays = await fetchNagerHolidaysMultiYear(code, YEARS);

    // Group
    const grouped = groupByDate(dbHolidays, wikiHolidays, nagerHolidays);

    // Pre-classify
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

    // Gemini batch judgment
    if (ambiguous.length > 0) {
      try {
        const judgments = await batchJudgeWithGemini(ambiguous, name);
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
              r.issue = 'Gemini batch did not return judgment';
              r.action = 'manual_review';
            }
            delete r._pending;
            ambIdx++;
          }
        }
      } catch (err) {
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

    // Summary
    const summary = {
      verified_high: 0,
      verified_mid: 0,
      single_source: 0,
      conflict: 0,
      missing_in_db: 0,
    };
    for (const r of results) {
      if (r.verification_status in summary) summary[r.verification_status]++;
    }

    const healthScore = results.length > 0
      ? Math.round(((summary.verified_high + summary.verified_mid) / results.length) * 100)
      : 0;

    return {
      success: true,
      runId: `${code}-${new Date().toISOString().slice(0, 10)}`,
      country_code: code,
      country_name: name,
      duration_ms: Date.now() - startTime,
      source_counts: {
        db: dbHolidays.length,
        db_locked: lockedCount,
        db_total: totalCount,
        wikipedia: wikiHolidays.length,
        nager: nagerHolidays.length,
      },
      summary,
      health_score: healthScore,
      results,
    };
  } catch (err) {
    return {
      success: false,
      country_code: code,
      country_name: name,
      duration_ms: Date.now() - startTime,
      error: err.message,
    };
  }
}

// ==========================================================
// MAIN
// ==========================================================
async function main() {
  const startTime = Date.now();
  const onlyFilter = parseOnlyFlag();
  const targets = onlyFilter
    ? TARGET_COUNTRIES.filter((c) => onlyFilter.includes(c.code))
    : TARGET_COUNTRIES;

  console.log(`🌍 Multi-country cross-validation`);
  console.log(`   Countries: ${targets.map((c) => c.code).join(', ')}  (${targets.length} total)`);
  console.log(`   Years:     ${YEARS.join(', ')}`);
  console.log(`   Mode:      DIAGNOSTIC ONLY (no DB changes)`);
  console.log(`   Estimated duration: ~${Math.ceil(targets.length * 1)} minutes\n`);

  const reportDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const allResults = [];

  for (let i = 0; i < targets.length; i++) {
    const country = targets[i];
    console.log('\n' + '═'.repeat(60));
    console.log(`[${i + 1}/${targets.length}]  🏁  ${country.name} (${country.code})`);
    console.log('═'.repeat(60));

    const result = await validateOneCountry(country);
    allResults.push(result);

    // Save per-country report (full detail)
    if (result.success) {
      const reportPath = path.join(reportDir, `validation-${result.runId}.json`);
      fs.writeFileSync(
        reportPath,
        JSON.stringify(
          {
            validation_run_id: result.runId,
            country: result.country_name,
            country_code: result.country_code,
            years: YEARS,
            generated_at: new Date().toISOString(),
            duration_ms: result.duration_ms,
            summary: result.summary,
            source_counts: result.source_counts,
            health_score: result.health_score,
            results: result.results,
          },
          null,
          2
        )
      );

      // Console summary
      console.log(`\n   📊 ${country.name} summary:`);
      console.log(`      Sources: DB ${result.source_counts.db}${result.source_counts.db_locked > 0 ? ` (${result.source_counts.db_locked} locked)` : ''}, Wiki ${result.source_counts.wikipedia}, Nager ${result.source_counts.nager}`);
      console.log(`      ✅ verified_high:  ${result.summary.verified_high}`);
      console.log(`      ✅ verified_mid:   ${result.summary.verified_mid}`);
      console.log(`      ⚠️  single_source: ${result.summary.single_source}`);
      console.log(`      ⚠️  conflict:      ${result.summary.conflict}`);
      console.log(`      🚨 missing_in_db:  ${result.summary.missing_in_db}`);
      console.log(`      Health score: ${result.health_score}%  (${(result.duration_ms / 1000).toFixed(1)}s)`);
    } else {
      console.log(`\n   ❌ ${country.name} FAILED: ${result.error}`);
    }

    // Small pause between countries (respect Gemini rate limits even on paid tier)
    if (i < targets.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // ==========================================================
  // Combined summary report
  // ==========================================================
  const summaryDate = new Date().toISOString().slice(0, 10);
  const summaryPath = path.join(reportDir, `all-countries-summary-${summaryDate}.json`);

  // Sort by health_score ascending (worst first = most urgent)
  const sorted = [...allResults].sort((a, b) => {
    if (!a.success) return -1;
    if (!b.success) return 1;
    return a.health_score - b.health_score;
  });

  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_duration_ms: Date.now() - startTime,
        years: YEARS,
        countries_count: allResults.length,
        successful: allResults.filter((r) => r.success).length,
        failed: allResults.filter((r) => !r.success).length,
        countries: sorted.map((r) => ({
          country_code: r.country_code,
          country_name: r.country_name,
          success: r.success,
          error: r.error || null,
          health_score: r.health_score || 0,
          summary: r.summary || null,
          source_counts: r.source_counts || null,
          runId: r.runId || null,
        })),
      },
      null,
      2
    )
  );

  // ==========================================================
  // Final console summary
  // ==========================================================
  console.log('\n' + '═'.repeat(60));
  console.log('🌍  ALL COUNTRIES SUMMARY');
  console.log('═'.repeat(60) + '\n');

  console.log('  Country        Health  V.High  V.Mid  Single  Conflict  Missing');
  console.log('  ' + '─'.repeat(68));

  for (const r of sorted) {
    if (!r.success) {
      console.log(`  ${r.country_code.padEnd(14)}  FAILED  ${r.error.slice(0, 50)}`);
      continue;
    }
    const s = r.summary;
    const healthStr = `${r.health_score}%`.padStart(5);
    console.log(
      `  ${r.country_name.slice(0, 14).padEnd(14)}  ${healthStr}  ${String(s.verified_high).padStart(6)}  ${String(s.verified_mid).padStart(5)}  ${String(s.single_source).padStart(6)}  ${String(s.conflict).padStart(8)}  ${String(s.missing_in_db).padStart(7)}`
    );
  }

  const totalMissing = allResults.reduce((acc, r) => acc + (r.summary?.missing_in_db || 0), 0);
  const totalConflict = allResults.reduce((acc, r) => acc + (r.summary?.conflict || 0), 0);
  const avgHealth = allResults.filter((r) => r.success).reduce((a, r) => a + r.health_score, 0) / (allResults.filter((r) => r.success).length || 1);

  console.log('\n' + '═'.repeat(60));
  console.log(`  📊 OVERALL`);
  console.log(`  ─────────`);
  console.log(`  Avg health:         ${avgHealth.toFixed(1)}%`);
  console.log(`  Total missing_in_db: ${totalMissing}`);
  console.log(`  Total conflicts:     ${totalConflict}`);
  console.log(`  Total duration:      ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} min`);
  console.log('═'.repeat(60));

  console.log(`\n💾 Combined summary: ${summaryPath}`);
  console.log(`💾 Per-country reports: ${reportDir}/validation-{CODE}-${summaryDate}.json`);
  console.log('\n💡 To apply any single-country report to DB:');
  console.log('   node scripts/apply-validation.js validation-{CODE}-YYYY-MM-DD.json');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});