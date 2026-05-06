// ==========================================================
// add-classified-holidays.js
//
// Reads missing-classification-{date}.json and inserts holidays
// classified as "national" into the DB.
//
// Safety guards:
//   1. SKIP exclusion zones (Japan May 2026 specifically)
//   2. SKIP duplicates (existing rows with same country/date/name)
//   3. Confirmation prompt before any writes
//   4. --dry-run mode shows plan without inserting
//
// USAGE:
//   node scripts/add-classified-holidays.js
//   node scripts/add-classified-holidays.js --dry-run
//   node scripts/add-classified-holidays.js --date 2026-04-24
// ==========================================================

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Exclusion zones ---
// Items in these date ranges are skipped even if classified national.
// Use this when there's known DB data integrity work to do separately.
const EXCLUSION_ZONES = [
  {
    country_code: 'JP',
    date_from: '2026-05-03',
    date_to: '2026-05-07',
    reason: 'Japan May 2026 — DB has structural issues; handled in separate manual pass',
  },
];

// --- CLI flag parsing ---
const isDryRun = process.argv.includes('--dry-run');
function parseDate() {
  const idx = process.argv.indexOf('--date');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return new Date().toISOString().slice(0, 10);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ==========================================================
// Helpers
// ==========================================================
function isInExclusionZone(countryCode, date) {
  return EXCLUSION_ZONES.some(
    (z) =>
      z.country_code === countryCode &&
      date >= z.date_from &&
      date <= z.date_to
  );
}

function getExclusionReason(countryCode, date) {
  const zone = EXCLUSION_ZONES.find(
    (z) =>
      z.country_code === countryCode &&
      date >= z.date_from &&
      date <= z.date_to
  );
  return zone ? zone.reason : null;
}

async function getCountryIdMap() {
  const { data, error } = await supabase.from('countries').select('id, code, name');
  if (error) throw error;
  const map = {};
  for (const c of data) map[c.code] = { id: c.id, name: c.name };
  return map;
}

// Check if a row matching country+date+name already exists.
// Returns the existing row, or null.
async function findExisting(countryId, date, nameEn) {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, date, name, name_local, manual_locked')
    .eq('country_id', countryId)
    .eq('date', date)
    .ilike('name', nameEn);
  if (error) throw error;
  return (data && data.length > 0) ? data[0] : null;
}

// Check if there's ANY row on this country+date (even with different name).
// This is a softer check used for awareness, not blocking.
async function findAnyOnDate(countryId, date) {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, name, name_local')
    .eq('country_id', countryId)
    .eq('date', date);
  if (error) throw error;
  return data || [];
}

// ==========================================================
// Build the plan: what would be inserted, what's skipped, why
// ==========================================================
async function buildPlan(classification, countryMap) {
  const toInsert = [];
  const skipped = [];

  for (const country of classification.countries) {
    const countryInfo = countryMap[country.country_code];
    if (!countryInfo) {
      skipped.push({
        reason: 'country_not_in_db',
        country_code: country.country_code,
        items: country.classifications.length,
      });
      continue;
    }

    const nationals = (country.classifications || []).filter((x) => x.classification === 'national');

    for (const item of nationals) {
      // Find the original wiki entry for full data (category, name_local)
      // We saved minimal data in classification, so re-load from per-country report
      // Instead, we'll trust what we have and use sensible defaults.

      // 1. Exclusion zone check
      if (isInExclusionZone(country.country_code, item.date)) {
        skipped.push({
          reason: 'exclusion_zone',
          country_code: country.country_code,
          date: item.date,
          name: item.name_en,
          detail: getExclusionReason(country.country_code, item.date),
        });
        continue;
      }

      // 2. Duplicate check (exact name match on date)
      const existing = await findExisting(countryInfo.id, item.date, item.name_en);
      if (existing) {
        skipped.push({
          reason: 'duplicate',
          country_code: country.country_code,
          date: item.date,
          name: item.name_en,
          existing_id: existing.id,
          manual_locked: existing.manual_locked,
        });
        continue;
      }

      // 3. Soft check: ANY row on this date with different name?
      // We still insert but flag for awareness.
      const sameDate = await findAnyOnDate(countryInfo.id, item.date);
      const sameDateOtherNames = sameDate.map((r) => r.name);

      // Build the INSERT payload
      const year = parseInt(item.date.slice(0, 4), 10);
      const category = item.wiki_category || 'regular';
      const isSubstitute = category === 'substitute' || /substitute/i.test(item.name_en || '');

      toInsert.push({
        country_code: country.country_code,
        country_name: countryInfo.name,
        country_id: countryInfo.id,
        payload: {
          country_id: countryInfo.id,
          date: item.date,
          name: item.name_en,
          name_local: item.name_local || null,
          type: 'Public',
          is_public: true,
          year,
          holiday_category: category,
          is_substitute: isSubstitute,
          note: item.reason || null,
          data_source: 'wikipedia_classified',
          data_verified: true,
          verified_at: new Date().toISOString(),
          verification_status: 'verified_mid',
          verification_sources: { db: false, wikipedia: true, nager: false },
          verification_note: `Added from Wikipedia after Gemini national classification (${item.confidence} confidence). Reason: ${item.reason}`,
        },
        same_date_others: sameDateOtherNames,
        confidence: item.confidence,
      });
    }
  }

  return { toInsert, skipped };
}

// ==========================================================
// MAIN
// ==========================================================
async function main() {
  const dateStr = parseDate();
  const classifyPath = path.join(__dirname, '..', 'tmp', `missing-classification-${dateStr}.json`);

  if (!fs.existsSync(classifyPath)) {
    console.error(`❌ Classification file not found: ${classifyPath}`);
    console.error('   Run "node scripts/classify-missing-holidays.js" first.');
    process.exit(1);
  }

  console.log('🇨 Adding classified national holidays to DB');
  console.log(`   Source: ${path.basename(classifyPath)}`);
  console.log(`   Mode: ${isDryRun ? 'DRY-RUN (no changes)' : 'LIVE (will write to DB after confirmation)'}\n`);

  const classification = JSON.parse(fs.readFileSync(classifyPath, 'utf-8'));
  const countryMap = await getCountryIdMap();

  // ----- Build plan -----
  console.log('━'.repeat(60));
  console.log('1️⃣  Building insertion plan');
  console.log('━'.repeat(60));

  const { toInsert, skipped } = await buildPlan(classification, countryMap);

  console.log(`\n   📝 Will insert: ${toInsert.length}`);
  console.log(`   ⏭️  Skipped:    ${skipped.length}`);

  // Show skipped breakdown
  if (skipped.length > 0) {
    const byReason = {};
    for (const s of skipped) {
      byReason[s.reason] = (byReason[s.reason] || 0) + 1;
    }
    console.log('\n   Skipped breakdown:');
    for (const [reason, count] of Object.entries(byReason)) {
      console.log(`      ${reason.padEnd(20)} ${count}`);
    }
  }

  // ----- Show insert details by country -----
  console.log('\n' + '━'.repeat(60));
  console.log('2️⃣  Insertion details');
  console.log('━'.repeat(60) + '\n');

  const byCountry = {};
  for (const t of toInsert) {
    if (!byCountry[t.country_code]) byCountry[t.country_code] = [];
    byCountry[t.country_code].push(t);
  }

  for (const [code, items] of Object.entries(byCountry)) {
    const countryName = countryMap[code]?.name || code;
    console.log(`  ${countryName} (${code}) — ${items.length} to add:`);
    for (const t of items) {
      const flag = t.same_date_others.length > 0 ? ' ⚠️' : '';
      console.log(`    ${t.payload.date}  ${t.payload.name}${flag}`);
      if (t.same_date_others.length > 0) {
        console.log(`       └─ same date already has: ${t.same_date_others.join(', ')}`);
      }
    }
    console.log('');
  }

  // ----- Show skipped details if interesting -----
  const skippedDups = skipped.filter((s) => s.reason === 'duplicate');
  const skippedExc = skipped.filter((s) => s.reason === 'exclusion_zone');

  if (skippedDups.length > 0) {
    console.log('  📌 Already in DB (skipped):');
    for (const s of skippedDups) {
      const lockTag = s.manual_locked ? ' 🔒' : '';
      console.log(`    ${s.country_code}  ${s.date}  ${s.name}  (id: ${s.existing_id})${lockTag}`);
    }
    console.log('');
  }

  if (skippedExc.length > 0) {
    console.log('  🚧 In exclusion zone (skipped):');
    for (const s of skippedExc) {
      console.log(`    ${s.country_code}  ${s.date}  ${s.name}`);
      console.log(`       └─ ${s.detail}`);
    }
    console.log('');
  }

  // ----- Dry-run stops here -----
  if (isDryRun) {
    console.log('━'.repeat(60));
    console.log('🔍 Dry-run complete. No changes made.');
    console.log('   Re-run without --dry-run to apply.');
    return;
  }

  // ----- Confirm before applying -----
  if (toInsert.length === 0) {
    console.log('━'.repeat(60));
    console.log('✅ Nothing to insert. Exiting.');
    return;
  }

  console.log('━'.repeat(60));
  const answer = await ask(`\n❓ Insert ${toInsert.length} holidays into the DB? (y/N): `);
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\n🚫 Cancelled. No changes made.');
    return;
  }

  // ----- Insert -----
  console.log('\n' + '━'.repeat(60));
  console.log('3️⃣  Inserting');
  console.log('━'.repeat(60) + '\n');

  let success = 0;
  let failed = 0;
  const failures = [];

  for (const t of toInsert) {
    const { error } = await supabase.from('holidays').insert(t.payload);
    if (error) {
      failed++;
      failures.push({
        country_code: t.country_code,
        date: t.payload.date,
        name: t.payload.name,
        error: error.message,
      });
      console.log(`   ❌ ${t.country_code} ${t.payload.date} ${t.payload.name}: ${error.message}`);
    } else {
      success++;
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`✅ Insertion complete:`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed:  ${failed}`);
  console.log('━'.repeat(60));

  if (failures.length > 0) {
    console.log('\n❌ Failed inserts:');
    for (const f of failures) {
      console.log(`   ${f.country_code} ${f.date} ${f.name}`);
      console.log(`     → ${f.error}`);
    }
  }

  // ----- Suggest next steps -----
  console.log('\n💡 Next steps:');
  console.log('   1. Verify additions:');
  console.log(`      SELECT country_id, COUNT(*) FROM holidays`);
  console.log(`      WHERE data_source = 'wikipedia_classified' GROUP BY country_id;`);
  console.log('   2. Re-run validation to confirm health scores improved:');
  console.log('      node scripts/validate-all-countries.js');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
