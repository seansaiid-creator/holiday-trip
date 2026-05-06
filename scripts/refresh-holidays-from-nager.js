/**
 * refresh-holidays-from-nager.js
 *
 * Re-imports holidays for one country from Nager.Date, keeping ONLY
 * national public holidays (global=true AND types includes 'Public').
 * This eliminates regional holidays (e.g., Swiss canton-specific days,
 * US state holidays) and observances (Mother's Day, etc.) that aren't
 * useful for travelers visiting major cities.
 *
 * USAGE
 *   node scripts/refresh-holidays-from-nager.js --country=CH --years=2025-2027
 *   node scripts/refresh-holidays-from-nager.js --country=CH --years=2025-2027 --apply
 *
 *   Without --apply: dry run. Fetches Nager data, computes diff vs DB,
 *                    prints what would change. Does NOT touch the DB.
 *   With --apply:    creates a backup table, deletes obsolete rows,
 *                    inserts new rows. Skips manual_locked rows.
 *
 * SAFETY
 *   - Never touches manual_locked=true rows (Korea is safe).
 *   - Never touches data_source != 'nager.date' rows by default
 *     (so Wikipedia-classified additions are preserved). Add --aggressive
 *     to override that.
 *   - Backs up everything that will be deleted into a timestamped table.
 *   - Refuses to apply if more than 80% of a country's rows would be
 *     deleted (sanity guard against bugs).
 *
 * PHILOSOPHY
 *   - Nager.Date's `global` field is the source of truth for "is this a
 *     national holiday?" It's a curated boolean — counties are listed
 *     when global=false.
 *   - We also require types to include 'Public'. Bank/School/Optional/
 *     Observance/Authorities are filtered out — they're not days when
 *     the country shuts down.
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

// ---------- ARGS ----------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { apply: false, aggressive: false, threshold: null };
  for (const a of args) {
    if (a === '--apply') opts.apply = true;
    else if (a === '--aggressive') opts.aggressive = true;
    else if (a.startsWith('--country=')) opts.country = a.split('=')[1].toUpperCase();
    else if (a.startsWith('--threshold=')) opts.threshold = Number(a.split('=')[1]);
    else if (a.startsWith('--years=')) {
      const [from, to] = a.split('=')[1].split('-').map(Number);
      opts.years = [];
      for (let y = from; y <= to; y++) opts.years.push(y);
    }
  }
  if (!opts.country || !opts.years) {
    console.error('Usage: node scripts/refresh-holidays-from-nager.js --country=CH --years=2025-2027 [--apply] [--aggressive] [--threshold=N]');
    process.exit(1);
  }
  return opts;
}

// ---------- NAGER FETCH ----------
async function fetchFromNager(countryCode, year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`Nager returned ${r.status} for ${countryCode}/${year}`);
  }
  const data = await r.json();
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected Nager response for ${countryCode}/${year}: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

// Apply our filter: national public holidays only.
// Returns the subset that should end up in our DB.
//
// A holiday qualifies if ANY of these is true:
//   1. global === true AND types includes 'Public'
//      → definitive national holiday
//   2. global === false AND counties.length >= REGIONAL_THRESHOLD AND types includes 'Public'
//      → widely-observed regional holiday (e.g., Good Friday in 24/26
//        Swiss cantons, Easter Monday in 17/26). Not technically national
//        but affects enough of the country that a traveler to a major
//        city is very likely to encounter it.
//
// Observance-only entries are always excluded regardless of county count.
// (Observances are commemorative — businesses stay open.)
const REGIONAL_THRESHOLD = 15; // default — override with --threshold=N

function filterToNational(holidays, threshold = REGIONAL_THRESHOLD) {
  // Deduplicate: Nager sometimes returns the same holiday twice for the same
  // date+name (once as Public, once as Observance, with different counties).
  // We want the Public one if it exists.
  const seen = new Map(); // key: date|name → best entry so far

  for (const h of holidays) {
    const key = `${h.date}|${h.name}`;
    const typesArr = Array.isArray(h.types) ? h.types : [];
    const isPublic = typesArr.includes('Public');
    if (!isPublic) continue; // observance-only → skip entirely

    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, h);
    } else {
      // Prefer the entry with more counties (wider coverage) or global=true
      const prevCounties = Array.isArray(prev.counties) ? prev.counties.length : 0;
      const thisCounties = Array.isArray(h.counties) ? h.counties.length : 0;
      if (h.global || thisCounties > prevCounties) {
        seen.set(key, h);
      }
    }
  }

  // Now apply national / widely-regional filter
  return Array.from(seen.values()).filter((h) => {
    if (h.global === true) return true; // definitive national

    const countiesArr = Array.isArray(h.counties) ? h.counties : [];
    if (countiesArr.length >= threshold) return true; // widely regional

    return false;
  });
}

// ---------- DB HELPERS ----------
async function getCountryId(code) {
  const { data, error } = await supabase
    .from('countries')
    .select('id, name, code')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Country '${code}' not found in countries table`);
  return data;
}

async function getCurrentDbHolidays(countryId, years) {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, date, name, name_local, year, data_source, manual_locked, holiday_category, type')
    .eq('country_id', countryId)
    .in('year', years)
    .order('date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- DIFF ----------
// Match by date+name (primary) so we don't break composite-day cases.
// Returns { toInsert, toDelete, toKeep }
function computeDiff(dbRows, nagerKept, opts) {
  const dbByKey = new Map();
  for (const r of dbRows) {
    const key = `${r.date}|${r.name}`;
    dbByKey.set(key, r);
  }
  const nagerByKey = new Map();
  for (const n of nagerKept) {
    const key = `${n.date}|${n.name}`;
    nagerByKey.set(key, n);
  }

  const toInsert = [];
  const toDelete = [];
  const toKeep = [];
  const skippedLocked = [];
  const skippedOtherSource = [];

  // Anything in Nager but not in DB → INSERT
  for (const [key, n] of nagerByKey) {
    if (!dbByKey.has(key)) toInsert.push(n);
    else toKeep.push(dbByKey.get(key));
  }

  // Anything in DB but not in Nager-kept → DELETE candidate (subject to safety)
  for (const [key, r] of dbByKey) {
    if (nagerByKey.has(key)) continue; // already in toKeep
    // Safety: skip manual_locked
    if (r.manual_locked) {
      skippedLocked.push(r);
      continue;
    }
    // Safety: skip non-nager sources unless --aggressive
    if (r.data_source && r.data_source !== 'nager.date' && !opts.aggressive) {
      skippedOtherSource.push(r);
      continue;
    }
    toDelete.push(r);
  }

  return { toInsert, toDelete, toKeep, skippedLocked, skippedOtherSource };
}

// ---------- BACKUP + APPLY ----------
async function backupRows(rows) {
  if (rows.length === 0) return null;
  const ts = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
  const tableName = `holidays_backup_${ts}`;
  // Supabase JS client can't CREATE TABLE — emit SQL the user runs once.
  // Instead we just record the JSON to a local backup file.
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${tableName}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  console.log(`  💾 Backed up ${rows.length} rows to ${file}`);
  return file;
}

async function applyDelete(ids) {
  if (ids.length === 0) return;
  // Delete in batches to be safe
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase.from('holidays').delete().in('id', batch);
    if (error) throw error;
  }
}

async function applyInsert(countryId, nagerRows) {
  if (nagerRows.length === 0) return 0;
  const rows = nagerRows.map((n) => ({
    country_id: countryId,
    date: n.date,
    name: n.name,
    name_local: n.localName,
    year: Number(n.date.slice(0, 4)),
    is_public: true,
    type: 'Public',
    holiday_category: 'regular',
    data_source: 'nager.date',
    verification_status: 'pending',
    data_verified: false,
  }));
  // Insert in batches
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase.from('holidays').insert(batch).select('id');
    if (error) throw error;
    inserted += data.length;
  }
  return inserted;
}

// ---------- PRESENTATION ----------
function printRow(r, prefix = '') {
  const src = r.data_source || '?';
  const cat = r.holiday_category || '?';
  const lockedMark = r.manual_locked ? ' 🔒' : '';
  console.log(`  ${prefix}${r.date}  ${r.name.padEnd(45)}  [${cat}, ${src}]${lockedMark}`);
}

function printNagerRow(n, prefix = '') {
  console.log(`  ${prefix}${n.date}  ${n.name.padEnd(45)}  [global=${n.global}, types=${(n.types || []).join(',')}]`);
}

// ---------- MAIN ----------
async function main() {
  const opts = parseArgs();
  console.log(`refresh-holidays-from-nager.js`);
  console.log(`  country: ${opts.country}`);
  console.log(`  years:   ${opts.years[0]}–${opts.years[opts.years.length - 1]}`);
  console.log(`  apply:   ${opts.apply}`);
  console.log(`  aggressive: ${opts.aggressive}`);
  console.log('');

  const country = await getCountryId(opts.country);
  console.log(`Resolved country: id=${country.id}, name=${country.name}`);

  // Fetch Nager for each year
  console.log(`\nFetching from Nager.Date...`);
  const allNager = [];
  for (const year of opts.years) {
    const data = await fetchFromNager(opts.country, year);
    console.log(`  ${year}: ${data.length} rows from Nager (raw)`);
    allNager.push(...data);
  }

  // Override threshold if passed as CLI arg
  if (opts.threshold !== null) {
    // Monkey-patch the module-level constant (simple approach)
    // eslint-disable-next-line no-global-assign
    global.__THRESHOLD_OVERRIDE = opts.threshold;
  }
  const threshold = opts.threshold ?? REGIONAL_THRESHOLD;

  const nagerKept = filterToNational(allNager, threshold);
  const nagerDropped = allNager.length - nagerKept.length;
  console.log(`\nFiltered to national/widely-observed public holidays:`);
  console.log(`  Kept:    ${nagerKept.length} (global=true OR counties>=${threshold}, type=Public)`);
  console.log(`  Dropped: ${nagerDropped} (regional<${threshold} counties or non-Public)`);

  // Show sample of dropped Nager entries so user can sanity-check the filter
  const droppedByFilter = allNager.filter((h) => {
    const typesArr = Array.isArray(h.types) ? h.types : [];
    if (!typesArr.includes('Public')) return true;
    if (h.global) return false;
    const c = Array.isArray(h.counties) ? h.counties.length : 0;
    return c < threshold;
  });
  const droppedSample = droppedByFilter.slice(0, 12);
  if (droppedSample.length > 0) {
    console.log(`\nSample of Nager entries dropped by filter:`);
    for (const h of droppedSample) {
      const typesArr = Array.isArray(h.types) ? h.types : [];
      const isPublic = typesArr.includes('Public');
      const countiesN = Array.isArray(h.counties) ? h.counties.length : 0;
      const reasons = [];
      if (!isPublic) reasons.push(`types=${JSON.stringify(h.types)}`);
      else if (!h.global) reasons.push(`regional (${countiesN}/${threshold} threshold, counties=${JSON.stringify(h.counties)})`);
      console.log(`  ✗ ${h.date}  ${h.name.padEnd(40)}  → ${reasons.join(', ')}`);
    }
    if (droppedByFilter.length > 12) {
      console.log(`  ... and ${droppedByFilter.length - 12} more`);
    }
  }

  // Load DB
  console.log(`\nLoading current DB rows...`);
  const dbRows = await getCurrentDbHolidays(country.id, opts.years);
  console.log(`  ${dbRows.length} rows currently in DB for these years`);

  // Compute diff
  const diff = computeDiff(dbRows, nagerKept, opts);

  console.log(`\n=== DIFF ===`);
  console.log(`  Keep:               ${diff.toKeep.length}`);
  console.log(`  Insert (new):       ${diff.toInsert.length}`);
  console.log(`  Delete:             ${diff.toDelete.length}`);
  console.log(`  Skip (locked):      ${diff.skippedLocked.length}`);
  console.log(`  Skip (other src):   ${diff.skippedOtherSource.length}`);

  if (diff.toInsert.length > 0) {
    console.log(`\n→ Would INSERT ${diff.toInsert.length}:`);
    for (const n of diff.toInsert) printNagerRow(n, '+ ');
  }
  if (diff.toDelete.length > 0) {
    console.log(`\n→ Would DELETE ${diff.toDelete.length}:`);
    for (const r of diff.toDelete) printRow(r, '- ');
  }
  if (diff.skippedLocked.length > 0) {
    console.log(`\n→ Skipped (manual_locked) ${diff.skippedLocked.length}:`);
    for (const r of diff.skippedLocked) printRow(r, '🔒 ');
  }
  if (diff.skippedOtherSource.length > 0) {
    console.log(`\n→ Skipped (data_source != nager.date — pass --aggressive to override) ${diff.skippedOtherSource.length}:`);
    for (const r of diff.skippedOtherSource) printRow(r, '~ ');
  }

  // Sanity guard: refuse to delete more than 80% of country's rows
  const deletePctRatio = dbRows.length === 0 ? 0 : diff.toDelete.length / dbRows.length;
  if (deletePctRatio > 0.8) {
    console.log(`\n⚠️  SANITY GUARD: ${(deletePctRatio * 100).toFixed(1)}% of DB rows would be deleted (>80%).`);
    console.log(`   This usually means a bug or wrong country code. Refusing to apply.`);
    if (opts.apply) {
      console.log(`   Override by editing the script if you're sure.`);
      process.exit(1);
    }
  }

  if (!opts.apply) {
    console.log(`\n--- DRY RUN ---  Re-run with --apply to actually change the database.`);
    return;
  }

  // APPLY MODE
  console.log(`\n=== APPLYING CHANGES ===`);

  // 1. Backup deletes
  if (diff.toDelete.length > 0) {
    await backupRows(diff.toDelete);
  }

  // 2. Delete
  if (diff.toDelete.length > 0) {
    console.log(`Deleting ${diff.toDelete.length} rows...`);
    await applyDelete(diff.toDelete.map((r) => r.id));
    console.log(`  ✅ Deleted`);
  }

  // 3. Insert
  if (diff.toInsert.length > 0) {
    console.log(`Inserting ${diff.toInsert.length} rows...`);
    const n = await applyInsert(country.id, diff.toInsert);
    console.log(`  ✅ Inserted ${n} rows`);
  }

  // 4. Verify
  const after = await getCurrentDbHolidays(country.id, opts.years);
  console.log(`\nFinal DB state for ${country.name} (${opts.years[0]}–${opts.years[opts.years.length - 1]}):`);
  console.log(`  Total rows:     ${after.length}`);
  console.log(`  Manual locked:  ${after.filter((r) => r.manual_locked).length}`);
  const bySource = {};
  for (const r of after) {
    bySource[r.data_source || 'null'] = (bySource[r.data_source || 'null'] || 0) + 1;
  }
  for (const [src, cnt] of Object.entries(bySource)) {
    console.log(`    ${src}: ${cnt}`);
  }

  console.log(`\nDone.`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
