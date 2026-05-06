// ==========================================================
// analyze-calendarific-fields.js
//
// Deep analysis of existing Calendarific data — NO new API calls.
// Reads tmp/calendarific-test-*.json + tmp/calendarific-extended-*.json
// and answers:
//   1. What types/categories exist? Distribution?
//   2. How well does type filtering work?
//   3. What are "Local holiday" vs "Observance" entries?
//   4. Substitute holidays — how marked?
//   5. Description field — how rich?
//
// USAGE:
//   node scripts/analyze-calendarific-fields.js
//
// COST: 0 API calls (uses cached JSON)
// ==========================================================

const fs = require('fs');
const path = require('path');

const tmpDir = path.join(__dirname, '..', 'tmp');

function loadLatest(prefix) {
  if (!fs.existsSync(tmpDir)) return null;
  const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith(prefix) && f.endsWith('.json'));
  if (files.length === 0) return null;
  files.sort().reverse();
  const filePath = path.join(tmpDir, files[0]);
  console.log(`   📂 Loading: ${files[0]}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function flattenHolidays(rawData) {
  const all = [];
  for (const [code, data] of Object.entries(rawData)) {
    for (const [year, list] of Object.entries(data.byYear)) {
      if (!Array.isArray(list)) continue;
      for (const h of list) {
        all.push({ ...h, _country_code: code, _year: parseInt(year, 10) });
      }
    }
  }
  return all;
}

function pct(n, total) {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

function main() {
  console.log('🔬 Calendarific deep field analysis');
  console.log('━'.repeat(60) + '\n');

  // Load both test datasets
  const test1 = loadLatest('calendarific-test-');
  const test2 = loadLatest('calendarific-extended-');

  const combined = [];
  if (test1?.raw_data) combined.push(...flattenHolidays(test1.raw_data));
  if (test2?.raw_data) combined.push(...flattenHolidays(test2.raw_data));

  console.log(`\n   Total holiday entries analyzed: ${combined.length}\n`);
  if (combined.length === 0) {
    console.error('❌ No data loaded. Run test-calendarific.js first.');
    process.exit(1);
  }

  // ----- 1. Type analysis -----
  console.log('━'.repeat(60));
  console.log('1️⃣  TYPE ANALYSIS');
  console.log('━'.repeat(60) + '\n');

  // primary_type distribution
  const primaryTypes = {};
  for (const h of combined) {
    const pt = h.primary_type || 'unknown';
    primaryTypes[pt] = (primaryTypes[pt] || 0) + 1;
  }
  console.log('  primary_type distribution:');
  for (const [pt, c] of Object.entries(primaryTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pt.padEnd(40)} ${String(c).padStart(5)}  (${pct(c, combined.length)})`);
  }
  console.log('');

  // type[] combinations (top 15)
  const typeCombos = {};
  for (const h of combined) {
    const tc = Array.isArray(h.type) ? h.type.sort().join(' + ') : String(h.type);
    typeCombos[tc] = (typeCombos[tc] || 0) + 1;
  }
  const topCombos = Object.entries(typeCombos).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('  Top 15 type[] combinations:');
  for (const [tc, c] of topCombos) {
    console.log(`    ${tc.padEnd(50)} ${String(c).padStart(5)}`);
  }
  console.log('');

  // ----- 2. Filter effectiveness -----
  console.log('━'.repeat(60));
  console.log('2️⃣  FILTER EFFECTIVENESS');
  console.log('━'.repeat(60) + '\n');

  const total = combined.length;
  const filters = {
    'type contains "National holiday"': combined.filter((h) => Array.isArray(h.type) && h.type.includes('National holiday')).length,
    'primary_type === "Public Holiday"': combined.filter((h) => h.primary_type === 'Public Holiday').length,
    'locations === "All"': combined.filter((h) => h.locations === 'All').length,
    'states === "All"': combined.filter((h) => h.states === 'All').length,
    'BOTH National + locations=All': combined.filter((h) =>
      Array.isArray(h.type) && h.type.includes('National holiday') && h.locations === 'All'
    ).length,
    'BOTH National + Public Holiday': combined.filter((h) =>
      Array.isArray(h.type) && h.type.includes('National holiday') && h.primary_type === 'Public Holiday'
    ).length,
  };

  console.log('  Filter results (out of ' + total + ' total):');
  for (const [name, count] of Object.entries(filters)) {
    console.log(`    ${name.padEnd(45)} ${String(count).padStart(5)}  (${pct(count, total)})`);
  }
  console.log('');

  // ----- 3. National holiday counts per country -----
  console.log('━'.repeat(60));
  console.log('3️⃣  NATIONAL HOLIDAY COUNT PER COUNTRY (after filter)');
  console.log('━'.repeat(60) + '\n');

  const byCountry = {};
  for (const h of combined) {
    const code = h._country_code;
    if (!byCountry[code]) byCountry[code] = { total: 0, national: 0, by_year: {} };
    byCountry[code].total++;
    if (Array.isArray(h.type) && h.type.includes('National holiday')) {
      byCountry[code].national++;
      const year = h._year;
      byCountry[code].by_year[year] = (byCountry[code].by_year[year] || 0) + 1;
    }
  }

  console.log('  Country  Total entries  National-only  2025  2026  2027  Drop %');
  console.log('  ' + '─'.repeat(64));
  const countryCodes = Object.keys(byCountry).sort();
  for (const code of countryCodes) {
    const b = byCountry[code];
    const y2025 = b.by_year[2025] || 0;
    const y2026 = b.by_year[2026] || 0;
    const y2027 = b.by_year[2027] || 0;
    const drop = y2025 > 0 ? (((y2025 - y2027) / y2025) * 100).toFixed(0) : '0';
    console.log(
      `  ${code.padEnd(7)}  ${String(b.total).padStart(13)}  ${String(b.national).padStart(13)}  ${String(y2025).padStart(4)}  ${String(y2026).padStart(4)}  ${String(y2027).padStart(4)}  ${(drop + '%').padStart(6)}`
    );
  }
  console.log('');

  // ----- 4. Substitute holiday detection -----
  console.log('━'.repeat(60));
  console.log('4️⃣  SUBSTITUTE HOLIDAY DETECTION');
  console.log('━'.repeat(60) + '\n');

  // Search for substitute markers in name
  const substitutePatterns = [
    /\bsubstitute\b/i,
    /\bobserved\b/i,
    /day off for/i,
    /\bin lieu of\b/i,
    /대체/,
  ];
  const substitutes = combined.filter((h) =>
    substitutePatterns.some((p) => p.test(h.name || ''))
  );

  console.log(`  Holidays matching substitute patterns: ${substitutes.length}`);
  console.log(`  By country:`);
  const subByCountry = {};
  for (const s of substitutes) {
    subByCountry[s._country_code] = (subByCountry[s._country_code] || 0) + 1;
  }
  for (const [code, c] of Object.entries(subByCountry).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${code}: ${c}`);
  }
  console.log(`\n  Sample substitute entries (first 8):`);
  for (const s of substitutes.slice(0, 8)) {
    const types = Array.isArray(s.type) ? s.type.join(', ') : s.type;
    console.log(`    ${s._country_code}  ${s.date?.iso?.slice(0, 10)}  "${s.name}"  [${types}]`);
  }
  console.log('');

  // ----- 5. Description field richness -----
  console.log('━'.repeat(60));
  console.log('5️⃣  DESCRIPTION FIELD');
  console.log('━'.repeat(60) + '\n');

  const withDesc = combined.filter((h) => h.description && h.description.length > 0);
  const descLengths = withDesc.map((h) => h.description.length);
  const avgLen = descLengths.length > 0 ? Math.round(descLengths.reduce((a, b) => a + b, 0) / descLengths.length) : 0;
  const maxLen = descLengths.length > 0 ? Math.max(...descLengths) : 0;

  console.log(`  Entries with description: ${withDesc.length} / ${total} (${pct(withDesc.length, total)})`);
  console.log(`  Average description length: ${avgLen} chars`);
  console.log(`  Max description length: ${maxLen} chars`);
  if (withDesc[0]) {
    console.log(`\n  Sample description (KR):`);
    console.log(`    "${withDesc[0].description}"`);
  }
  console.log('');

  // ----- 6. Locations / states / locale -----
  console.log('━'.repeat(60));
  console.log('6️⃣  LOCATIONS & STATES & LANGUAGE');
  console.log('━'.repeat(60) + '\n');

  const locationsAll = combined.filter((h) => h.locations === 'All').length;
  const locationsSpecific = combined.filter((h) => h.locations && h.locations !== 'All').length;
  const statesAll = combined.filter((h) => h.states === 'All').length;
  const statesSpecific = combined.filter((h) => h.states && h.states !== 'All').length;

  console.log(`  locations=All:      ${locationsAll}  (${pct(locationsAll, total)})`);
  console.log(`  locations specific: ${locationsSpecific}  (${pct(locationsSpecific, total)})`);
  console.log(`  states=All:         ${statesAll}  (${pct(statesAll, total)})`);
  console.log(`  states specific:    ${statesSpecific}  (${pct(statesSpecific, total)})`);

  // Sample specific locations
  const specificLocations = combined.filter((h) => h.locations && h.locations !== 'All').slice(0, 5);
  if (specificLocations.length > 0) {
    console.log('\n  Sample entries with specific locations:');
    for (const h of specificLocations) {
      console.log(`    ${h._country_code}  "${h.name}"  locations="${h.locations}"`);
    }
  }
  console.log('');

  // ----- 7. Final verdict -----
  console.log('━'.repeat(60));
  console.log('🎯 KEY INSIGHTS');
  console.log('━'.repeat(60) + '\n');

  const insights = [];
  const nationalCount = filters['type contains "National holiday"'];
  insights.push(`✓ Filter "National holiday" reduces to ${pct(nationalCount, total)} of total`);

  const subSafe = substitutes.filter((s) => Array.isArray(s.type) && s.type.includes('National holiday')).length;
  insights.push(`✓ ${subSafe}/${substitutes.length} substitute holidays are also marked "National holiday"`);

  const usEntries = byCountry.US?.total || 0;
  if (usEntries > 200) insights.push(`⚠️ US has ${usEntries} total entries — heavy regional/observance data, MUST filter`);

  const incompleteCountries = Object.entries(byCountry)
    .filter(([code, b]) => {
      const y2025 = b.by_year[2025] || 0;
      const y2027 = b.by_year[2027] || 0;
      return y2025 > 0 && y2027 < y2025 * 0.85;
    })
    .map(([code]) => code);
  if (incompleteCountries.length > 0) {
    insights.push(`⚠️ Countries with incomplete 2027 data: ${incompleteCountries.join(', ')}`);
  }

  for (const i of insights) console.log(`  ${i}`);
  console.log('');
}

main();
