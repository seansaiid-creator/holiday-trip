// ==========================================================
// test-calendarific-extended.js
//
// Tests 6 additional countries beyond the initial 5:
//   VN, TH, IN, FR, DE, SG (structural diversity)
//
// Focuses on:
//   - Non-Nager countries (TH)
//   - Lunar holidays (VN Tet)
//   - Religious diversity (IN: Hindu/Muslim/Sikh/Christian)
//   - Regional holidays (FR overseas, DE state-level)
//   - Multi-ethnic country (SG)
//   - Future-year completeness (2027 patterns)
//
// USAGE:
//   node scripts/test-calendarific-extended.js
//
// COST: 18 API calls (6 countries × 3 years)
// ==========================================================

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');

const TARGETS = [
  { code: 'VN', name: 'Vietnam',     focus: 'Lunar New Year (Tet) multi-day handling' },
  { code: 'TH', name: 'Thailand',    focus: 'Buddhist holidays, Nager unsupported country' },
  { code: 'IN', name: 'India',       focus: 'Religious diversity, regional variations' },
  { code: 'FR', name: 'France',      focus: 'Overseas territories (DOM-TOM)' },
  { code: 'DE', name: 'Germany',     focus: '16 state-level variations' },
  { code: 'SG', name: 'Singapore',   focus: 'Multi-ethnic (Chinese/Malay/Indian/Western)' },
];
const YEARS = [2025, 2026, 2027];

async function fetchCalendarific(countryCode, year) {
  const apiKey = process.env.CALENDARIFIC_API_KEY;
  if (!apiKey) throw new Error('CALENDARIFIC_API_KEY not set');

  const url = new URL('https://calendarific.com/api/v2/holidays');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('country', countryCode);
  url.searchParams.set('year', String(year));

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.meta?.code !== 200) throw new Error(`API code ${data.meta?.code}`);
  return data.response?.holidays || [];
}

// Categorize holidays by their type
function categorizeByType(holidays) {
  const stats = {
    total: holidays.length,
    by_primary_type: {},
    by_type_combination: {},
    national_only: 0,        // type contains "National holiday"
    public_only: 0,           // primary_type === "Public Holiday"
    has_locations_all: 0,     // locations === "All" (truly national)
    has_states_all: 0,        // states === "All"
    has_specific_states: 0,   // states is a specific list
  };

  for (const h of holidays) {
    // primary_type distribution
    const pt = h.primary_type || 'unknown';
    stats.by_primary_type[pt] = (stats.by_primary_type[pt] || 0) + 1;

    // type combination
    const tc = Array.isArray(h.type) ? h.type.sort().join(' + ') : String(h.type);
    stats.by_type_combination[tc] = (stats.by_type_combination[tc] || 0) + 1;

    // Filter checks
    if (Array.isArray(h.type) && h.type.includes('National holiday')) stats.national_only++;
    if (h.primary_type === 'Public Holiday') stats.public_only++;
    if (h.locations === 'All') stats.has_locations_all++;
    if (h.states === 'All') stats.has_states_all++;
    if (h.states && h.states !== 'All') stats.has_specific_states++;
  }

  return stats;
}

// Check for future-year completeness pattern
function analyzeFuturePattern(byYear) {
  const counts = Object.values(byYear).map((arr) => Array.isArray(arr) ? arr.length : 0);
  const [y2025, y2026, y2027] = counts;
  return {
    counts: { 2025: y2025, 2026: y2026, 2027: y2027 },
    drop_2027: y2027 < y2025 ? y2025 - y2027 : 0,
    drop_pct: y2025 > 0 ? (((y2025 - y2027) / y2025) * 100).toFixed(1) : '0',
    looks_complete: y2027 >= y2025 * 0.85,  // 85% of 2025 = "complete enough"
  };
}

async function main() {
  if (!process.env.CALENDARIFIC_API_KEY) {
    console.error('❌ CALENDARIFIC_API_KEY not set in .env.local');
    process.exit(1);
  }

  const startTime = Date.now();
  console.log('🧪 Calendarific extended test (6 additional countries)');
  console.log(`   Countries: ${TARGETS.map((t) => t.code).join(', ')}`);
  console.log(`   API calls: ${TARGETS.length * YEARS.length} (=${TARGETS.length * YEARS.length})\n`);

  const allData = {};
  let calls = 0;

  // ----- Fetch -----
  for (const target of TARGETS) {
    console.log(`━━━ ${target.name} (${target.code}) ━━━`);
    console.log(`   Focus: ${target.focus}`);
    allData[target.code] = { country: target, byYear: {} };

    for (const year of YEARS) {
      try {
        process.stdout.write(`   ${year}... `);
        const h = await fetchCalendarific(target.code, year);
        allData[target.code].byYear[year] = h;
        calls++;
        console.log(`${h.length} holidays`);
      } catch (err) {
        console.log(`❌ ${err.message}`);
        allData[target.code].byYear[year] = { error: err.message };
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log('');
  }

  console.log(`✓ ${calls} calls used\n`);

  // ----- Per-country analysis -----
  console.log('━'.repeat(60));
  console.log('📊 Per-country analysis');
  console.log('━'.repeat(60) + '\n');

  const summary = {};

  for (const target of TARGETS) {
    const byYear = allData[target.code].byYear;
    const allHolidays = [].concat(...Object.values(byYear).filter(Array.isArray));

    // Future-year pattern
    const futurePattern = analyzeFuturePattern(byYear);

    // Type stats (combined across years)
    const typeStats = categorizeByType(allHolidays);

    summary[target.code] = { future: futurePattern, types: typeStats };

    console.log(`▶ ${target.name} (${target.code})`);
    console.log(`   Counts: 2025=${futurePattern.counts[2025]}, 2026=${futurePattern.counts[2026]}, 2027=${futurePattern.counts[2027]}`);
    console.log(`   2027 drop: ${futurePattern.drop_2027} (${futurePattern.drop_pct}%) — ${futurePattern.looks_complete ? '✅ complete' : '⚠️ incomplete'}`);
    console.log(`   Total holidays (all years): ${typeStats.total}`);
    console.log(`   National holiday filter: ${typeStats.national_only}`);
    console.log(`   primary_type=Public Holiday: ${typeStats.public_only}`);
    console.log(`   locations=All (truly national): ${typeStats.has_locations_all}`);
    console.log(`   States: All=${typeStats.has_states_all}, specific=${typeStats.has_specific_states}`);

    // Top primary_types
    const topPrimaryTypes = Object.entries(typeStats.by_primary_type)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    console.log(`   Top primary_types:`);
    for (const [t, c] of topPrimaryTypes) {
      console.log(`      ${t.padEnd(30)} ${c}`);
    }
    console.log('');
  }

  // ----- Cross-country comparison -----
  console.log('━'.repeat(60));
  console.log('🌍 Cross-country comparison');
  console.log('━'.repeat(60) + '\n');

  console.log('  Country       2025  2026  2027  Drop  Status     National-only');
  console.log('  ' + '─'.repeat(64));

  for (const target of TARGETS) {
    const s = summary[target.code];
    const fc = s.future.counts;
    const status = s.future.looks_complete ? '✅ complete' : '⚠️ partial';
    console.log(
      `  ${target.name.padEnd(12)}  ${String(fc[2025]).padStart(4)}  ${String(fc[2026]).padStart(4)}  ${String(fc[2027]).padStart(4)}  ${String(s.future.drop_pct + '%').padStart(5)}  ${status.padEnd(10)}  ${String(s.types.national_only).padStart(13)}`
    );
  }

  // ----- Save raw data -----
  const outDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `calendarific-extended-${dateStr}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        api_calls_used: calls,
        targets: TARGETS,
        years: YEARS,
        summary,
        raw_data: allData,
      },
      null,
      2
    )
  );

  console.log('\n' + '━'.repeat(60));
  console.log(`💾 Raw data: ${outPath}`);
  console.log(`⏱️  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Quick verdict
  const incomplete2027 = TARGETS.filter((t) => !summary[t.code].future.looks_complete);
  console.log('\n🎯 QUICK VERDICT');
  if (incomplete2027.length === 0) {
    console.log(`   ✅ All 6 countries have complete 2027 data — Calendarific keeps future data well`);
  } else {
    console.log(`   ⚠️ ${incomplete2027.length}/6 countries have incomplete 2027:`);
    for (const t of incomplete2027) {
      console.log(`      ${t.name}: drop ${summary[t.code].future.drop_pct}%`);
    }
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
