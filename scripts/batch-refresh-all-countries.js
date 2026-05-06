/**
 * batch-refresh-all-countries.js
 *
 * Runs refresh-holidays-from-nager.js logic for ALL non-KR countries
 * in the DB, applying the global=true OR counties>=15 filter.
 *
 * USAGE
 *   node scripts/batch-refresh-all-countries.js              # dry-run all
 *   node scripts/batch-refresh-all-countries.js --apply      # apply all
 *   node scripts/batch-refresh-all-countries.js --apply --skip=CN,GB  # skip specific
 *
 * SAFETY
 *   - KR is ALWAYS skipped (manual_locked data)
 *   - Any country where >80% rows would be deleted is skipped with a warning
 *   - All deletions are backed up to backups/batch_TIMESTAMP.json
 *   - If one country fails, others continue (error is logged, not fatal)
 *   - Dry-run by default — requires --apply to touch DB
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Countries always excluded from batch refresh
const ALWAYS_SKIP = new Set(['KR']); // Korea has official gov data + manual_locked

const YEARS = [2025, 2026, 2027];
const REGIONAL_THRESHOLD = 15;

// ---------- ARGS ----------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { apply: false, skip: new Set(ALWAYS_SKIP) };
  for (const a of args) {
    if (a === '--apply') opts.apply = true;
    else if (a.startsWith('--skip=')) {
      for (const code of a.split('=')[1].split(',')) {
        opts.skip.add(code.trim().toUpperCase());
      }
    }
  }
  return opts;
}

// ---------- NAGER ----------
async function fetchFromNager(countryCode, year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
  const r = await fetch(url);
  if (r.status === 404) return null; // country not supported by Nager
  if (!r.ok) throw new Error(`Nager ${r.status} for ${countryCode}/${year}`);
  const data = await r.json();
  return Array.isArray(data) ? data : null;
}

function filterToNational(holidays, threshold = REGIONAL_THRESHOLD) {
  // Deduplicate same date+name — keep Public over Observance, wider coverage wins
  const seen = new Map();
  for (const h of holidays) {
    const typesArr = Array.isArray(h.types) ? h.types : [];
    if (!typesArr.includes('Public')) continue;
    const key = `${h.date}|${h.name}`;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, h);
    } else {
      const prevC = Array.isArray(prev.counties) ? prev.counties.length : 0;
      const thisC = Array.isArray(h.counties) ? h.counties.length : 0;
      if (h.global || thisC > prevC) seen.set(key, h);
    }
  }
  return Array.from(seen.values()).filter((h) => {
    if (h.global === true) return true;
    const c = Array.isArray(h.counties) ? h.counties.length : 0;
    return c >= threshold;
  });
}

// ---------- DB ----------
async function getAllCountries() {
  const { data, error } = await supabase
    .from('countries')
    .select('id, code, name')
    .order('code');
  if (error) throw error;
  return data || [];
}

async function getDbHolidays(countryId, years) {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, date, name, year, data_source, manual_locked, holiday_category')
    .eq('country_id', countryId)
    .in('year', years);
  if (error) throw error;
  return data || [];
}

function computeDiff(dbRows, nagerKept) {
  const dbByKey = new Map(dbRows.map((r) => [`${r.date}|${r.name}`, r]));
  const nagerByKey = new Map(nagerKept.map((n) => [`${n.date}|${n.name}`, n]));

  const toInsert = [];
  const toDelete = [];
  const skippedLocked = [];
  const skippedOtherSource = [];

  for (const [key, n] of nagerByKey) {
    if (!dbByKey.has(key)) toInsert.push(n);
  }
  for (const [key, r] of dbByKey) {
    if (nagerByKey.has(key)) continue;
    if (r.manual_locked) { skippedLocked.push(r); continue; }
    if (r.data_source && r.data_source !== 'nager.date') {
      skippedOtherSource.push(r); continue;
    }
    toDelete.push(r);
  }
  return { toInsert, toDelete, skippedLocked, skippedOtherSource };
}

async function applyDiff(countryId, diff, allDeleteRows, batchBackup) {
  // Add to batch backup
  for (const r of diff.toDelete) batchBackup.push(r);

  // Delete
  if (diff.toDelete.length > 0) {
    const ids = diff.toDelete.map((r) => r.id);
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const { error } = await supabase.from('holidays').delete().in('id', ids.slice(i, i + batchSize));
      if (error) throw error;
    }
  }

  // Insert
  if (diff.toInsert.length > 0) {
    const rows = diff.toInsert.map((n) => ({
      country_id: countryId,
      date: n.date,
      name: n.name,
      name_local: n.localName || null,
      year: Number(n.date.slice(0, 4)),
      is_public: true,
      type: 'Public',
      holiday_category: 'regular',
      data_source: 'nager.date',
      verification_status: 'pending',
      data_verified: false,
    }));
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const { error } = await supabase.from('holidays').insert(rows.slice(i, i + batchSize));
      if (error) throw error;
    }
  }
}

// ---------- MAIN ----------
async function main() {
  const opts = parseArgs();
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  console.log(`batch-refresh-all-countries.js`);
  console.log(`  apply:     ${opts.apply}`);
  console.log(`  skip:      ${[...opts.skip].join(', ')}`);
  console.log(`  years:     ${YEARS.join(', ')}`);
  console.log(`  threshold: ${REGIONAL_THRESHOLD} counties`);
  console.log('');

  const countries = await getAllCountries();
  const toProcess = countries.filter((c) => !opts.skip.has(c.code));
  console.log(`Countries in DB: ${countries.length} | To process: ${toProcess.length} | Skipped: ${opts.skip.size}`);
  console.log('');

  const batchBackup = []; // all rows that will be deleted (for backup file)
  const summary = [];

  for (const country of toProcess) {
    process.stdout.write(`[${country.code}] ${country.name.padEnd(25)} `);

    try {
      // Fetch from Nager for all years
      const allNager = [];
      let nagerUnsupported = false;
      for (const year of YEARS) {
        const data = await fetchFromNager(country.code, year);
        if (data === null) { nagerUnsupported = true; break; }
        allNager.push(...data);
        // Small delay to be polite to Nager API
        await new Promise((r) => setTimeout(r, 120));
      }

      if (nagerUnsupported) {
        console.log(`⚠️  Not supported by Nager — skipped`);
        summary.push({ code: country.code, result: 'nager_unsupported' });
        continue;
      }

      const nagerKept = filterToNational(allNager);
      const dbRows = await getDbHolidays(country.id, YEARS);
      const diff = computeDiff(dbRows, nagerKept);

      // Sanity guard: refuse if >80% of rows would be deleted
      const delRatio = dbRows.length === 0 ? 0 : diff.toDelete.length / dbRows.length;
      if (delRatio > 0.8 && diff.toDelete.length > 5) {
        console.log(`🛑 SANITY GUARD: ${diff.toDelete.length}/${dbRows.length} rows (${(delRatio*100).toFixed(0)}%) would be deleted — skipped`);
        summary.push({ code: country.code, result: 'sanity_guard', del: diff.toDelete.length, total: dbRows.length });
        continue;
      }

      const msg = `kept=${nagerKept.length} del=${diff.toDelete.length} ins=${diff.toInsert.length} skip_locked=${diff.skippedLocked.length} skip_other=${diff.skippedOtherSource.length}`;

      if (!opts.apply) {
        console.log(`🔍 ${msg}`);
        summary.push({ code: country.code, result: 'dry_run', kept: nagerKept.length, del: diff.toDelete.length, ins: diff.toInsert.length });
      } else {
        await applyDiff(country.id, diff, dbRows, batchBackup);
        console.log(`✅ ${msg}`);
        summary.push({ code: country.code, result: 'applied', kept: nagerKept.length, del: diff.toDelete.length, ins: diff.toInsert.length });
      }

    } catch (e) {
      console.log(`❌ ERROR: ${e.message}`);
      summary.push({ code: country.code, result: 'error', error: e.message });
    }
  }

  // Save backup
  if (opts.apply && batchBackup.length > 0) {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `batch_backup_${ts}.json`);
    fs.writeFileSync(file, JSON.stringify(batchBackup, null, 2));
    console.log(`\n💾 Backed up ${batchBackup.length} deleted rows → ${file}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const applied   = summary.filter((s) => s.result === 'applied');
  const dryRun    = summary.filter((s) => s.result === 'dry_run');
  const errors    = summary.filter((s) => s.result === 'error');
  const guards    = summary.filter((s) => s.result === 'sanity_guard');
  const unsupported = summary.filter((s) => s.result === 'nager_unsupported');

  const totalDel = [...applied, ...dryRun].reduce((a, s) => a + (s.del || 0), 0);
  const totalIns = [...applied, ...dryRun].reduce((a, s) => a + (s.ins || 0), 0);
  const totalKept = [...applied, ...dryRun].reduce((a, s) => a + (s.kept || 0), 0);

  console.log(`  ${opts.apply ? 'Applied' : 'Dry-run'}: ${(applied.length || dryRun.length)} countries`);
  console.log(`  Total deleted:  ${totalDel} rows`);
  console.log(`  Total inserted: ${totalIns} rows`);
  console.log(`  Total kept:     ${totalKept} rows`);
  if (errors.length)      console.log(`  Errors:         ${errors.length} (${errors.map((s) => s.code).join(', ')})`);
  if (guards.length)      console.log(`  Sanity guards:  ${guards.length} (${guards.map((s) => `${s.code}(${s.del}/${s.total})`).join(', ')})`);
  if (unsupported.length) console.log(`  Not in Nager:   ${unsupported.length} (${unsupported.map((s) => s.code).join(', ')})`);

  if (errors.length > 0) {
    console.log('\nFailed countries:');
    for (const s of errors) console.log(`  ${s.code}: ${s.error}`);
  }
  if (guards.length > 0) {
    console.log('\nSanity-guarded (review manually):');
    for (const s of guards) {
      console.log(`  ${s.code}: ${s.del}/${s.total} rows would be deleted`);
      console.log(`    → Run: node scripts/refresh-holidays-from-nager.js --country=${s.code} --years=2025-2027`);
    }
  }

  if (!opts.apply) {
    console.log('\n--- DRY RUN --- Re-run with --apply to apply changes.');
  } else {
    console.log('\nDone. Verify with:');
    console.log('  SELECT c.code, COUNT(*) FROM holidays h JOIN countries c ON c.id=h.country_id GROUP BY c.code ORDER BY c.code;');
  }
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
