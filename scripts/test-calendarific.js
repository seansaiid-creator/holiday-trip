// ==========================================================
// test-calendarific.js
//
// Tests Calendarific API quality for HolidayTrip's needs:
//   - Substitute holiday accuracy (Korea 2025-10-08, 2026-08-17, 2027-07-19)
//   - Sunday-falling holidays (Japan 2025-02-23, 2025-05-04)
//   - Multi-day holidays (China Spring Festival, Golden Week)
//   - Temporary holidays (Korea 2025-01-27, 2025-06-03)
//   - Recently restored holidays (Korea Constitution Day 2026)
//
// USAGE:
//   1. Sign up: https://calendarific.com/signup (free 500 calls/month)
//   2. Add to .env.local: CALENDARIFIC_API_KEY=your_key_here
//   3. Run: node scripts/test-calendarific.js
//
// COST: 15 API calls (5 countries × 3 years), within 500/month free tier.
// ==========================================================

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ----- Config -----
const TARGETS = [
  { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
];
const YEARS = [2025, 2026, 2027];

// Critical test cases — what we KNOW the answer to
const CRITICAL_CASES = [
  // Korea — substitute holidays
  { code: 'KR', date: '2025-10-08', expect: 'Chuseok substitute', critical: true, note: '추석 대체공휴일 (id=154 in our DB)' },
  { code: 'KR', date: '2026-08-17', expect: 'Liberation Day substitute', critical: true, note: '광복절 대체공휴일' },
  { code: 'KR', date: '2027-08-16', expect: 'Liberation Day substitute', critical: true, note: '광복절 대체공휴일' },
  { code: 'KR', date: '2026-07-17', expect: 'Constitution Day', critical: true, note: '제헌절 부활 (2026 법 개정)' },
  { code: 'KR', date: '2027-07-19', expect: 'Constitution Day substitute', critical: true, note: '제헌절 대체공휴일 (토요일→월요일)' },
  { code: 'KR', date: '2025-01-27', expect: 'Temporary holiday', critical: true, note: '임시공휴일' },
  { code: 'KR', date: '2025-06-03', expect: 'Presidential election', critical: true, note: '대통령 선거일 (임시공휴일)' },
  { code: 'KR', date: '2027-02-09', expect: 'Lunar New Year substitute', critical: true, note: '설날 대체공휴일' },

  // Japan — Sunday-falling holidays
  { code: 'JP', date: '2025-02-23', expect: "Emperor's Birthday", critical: true, note: '일요일 본일 (Nager 누락 케이스)' },
  { code: 'JP', date: '2025-02-24', expect: "Emperor's Birthday substitute", critical: true, note: '대체공휴일' },
  { code: 'JP', date: '2025-05-04', expect: 'Greenery Day', critical: true, note: '일요일 본일' },
  { code: 'JP', date: '2025-11-23', expect: 'Labor Thanksgiving Day', critical: true, note: '일요일 본일' },
  { code: 'JP', date: '2025-11-24', expect: 'Labor Thanksgiving Day substitute', critical: true, note: '대체공휴일' },
  { code: 'JP', date: '2026-05-03', expect: 'Constitution Memorial Day', critical: true, note: '일요일 본일 (DB 구조 문제)' },
  { code: 'JP', date: '2026-05-06', expect: 'Substitute / Citizens Holiday', critical: true, note: '대체 또는 국민의 휴일' },

  // China — Multi-day holidays
  { code: 'CN', date: '2025-01-28', expect: 'Spring Festival eve', critical: true, note: '춘절 전날' },
  { code: 'CN', date: '2025-01-30', expect: 'Spring Festival', critical: true, note: '춘절 연휴 일부' },
  { code: 'CN', date: '2025-10-02', expect: 'National Day', critical: true, note: '국경절 연휴 일부' },
  { code: 'CN', date: '2025-10-03', expect: 'National Day', critical: true, note: '국경절 연휴 일부' },
  { code: 'CN', date: '2025-04-04', expect: 'Tomb-Sweeping Day', critical: true, note: '청명절' },

  // US/UK — sanity checks
  { code: 'US', date: '2026-07-04', expect: 'Independence Day', critical: false, note: 'sanity check' },
  { code: 'US', date: '2027-12-25', expect: 'Christmas Day', critical: false, note: 'sanity check' },
  { code: 'GB', date: '2027-01-04', expect: 'New Year substitute', critical: false, note: '대체 (1/1 = 금요일이라 자연스레 평일이지만 확인용)' },
  { code: 'GB', date: '2027-12-25', expect: 'Christmas Day', critical: false, note: 'sanity check' },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==========================================================
// Calendarific API call
// ==========================================================
async function fetchCalendarific(countryCode, year) {
  const apiKey = process.env.CALENDARIFIC_API_KEY;
  if (!apiKey) throw new Error('CALENDARIFIC_API_KEY not set in .env.local');

  // Documented endpoint: https://calendarific.com/api/v2/holidays
  const url = new URL('https://calendarific.com/api/v2/holidays');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('country', countryCode);
  url.searchParams.set('year', String(year));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Calendarific error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.meta?.code !== 200) {
    throw new Error(`API returned code ${data.meta?.code}: ${data.meta?.error_detail || 'unknown'}`);
  }
  return data.response?.holidays || [];
}

// ==========================================================
// Compare with critical cases
// ==========================================================
function findMatchingHoliday(holidays, date) {
  return holidays.filter((h) => {
    const hDate = h.date?.iso?.slice(0, 10);
    return hDate === date;
  });
}

function summarizeHolidayEntry(h) {
  return {
    name: h.name,
    description: h.description?.slice(0, 80),
    date: h.date?.iso,
    type: h.type,            // ["National holiday", "Local holiday", ...]
    primary_type: h.primary_type,
    canonical_url: h.canonical_url,
    urlid: h.urlid,
    locations: h.locations,
    states: h.states,
  };
}

// ==========================================================
// Compare with our DB
// ==========================================================
async function fetchOurDbHolidays(countryCode) {
  const { data: country } = await supabase
    .from('countries')
    .select('id')
    .eq('code', countryCode)
    .maybeSingle();
  if (!country) return [];

  const { data, error } = await supabase
    .from('holidays')
    .select('date, name, name_local, holiday_category, is_substitute')
    .eq('country_id', country.id)
    .in('year', YEARS)
    .order('date');
  if (error) throw error;
  return data || [];
}

// ==========================================================
// MAIN
// ==========================================================
async function main() {
  if (!process.env.CALENDARIFIC_API_KEY) {
    console.error('❌ CALENDARIFIC_API_KEY not set in .env.local');
    console.error('');
    console.error('   Get a free key at: https://calendarific.com/signup');
    console.error('   Then add to .env.local:');
    console.error('     CALENDARIFIC_API_KEY=your_key_here');
    process.exit(1);
  }

  const startTime = Date.now();
  console.log('🧪 Testing Calendarific API (free tier)');
  console.log(`   Countries: ${TARGETS.map((t) => t.code).join(', ')}`);
  console.log(`   Years:     ${YEARS.join(', ')}`);
  console.log(`   Total API calls: ${TARGETS.length * YEARS.length} (free tier limit: 500/month)\n`);

  const allData = {};
  let callsUsed = 0;

  // ----- Step 1: Fetch all data -----
  console.log('━'.repeat(60));
  console.log('1️⃣  Fetching data from Calendarific');
  console.log('━'.repeat(60));

  for (const target of TARGETS) {
    allData[target.code] = { country: target, byYear: {} };
    for (const year of YEARS) {
      try {
        process.stdout.write(`   ${target.code} ${year}... `);
        const holidays = await fetchCalendarific(target.code, year);
        allData[target.code].byYear[year] = holidays;
        callsUsed++;
        console.log(`${holidays.length} holidays`);
      } catch (err) {
        console.log(`❌ ${err.message}`);
        allData[target.code].byYear[year] = { error: err.message };
      }
      // Pace ourselves (free tier rate limit unknown, be conservative)
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n   ✓ ${callsUsed} calls used (${500 - callsUsed} remaining this month)\n`);

  // ----- Step 2: Inspect response structure -----
  console.log('━'.repeat(60));
  console.log('2️⃣  API response structure (using KR 2026 as sample)');
  console.log('━'.repeat(60) + '\n');

  const sample = allData.KR?.byYear[2026];
  if (Array.isArray(sample) && sample.length > 0) {
    console.log('Sample holiday object keys:');
    console.log('  ' + Object.keys(sample[0]).join(', '));
    console.log('\nFirst holiday full structure:');
    console.log(JSON.stringify(sample[0], null, 2).split('\n').map((l) => '  ' + l).join('\n'));
  } else {
    console.log('   ⚠️ No KR 2026 data — cannot show structure');
  }

  // ----- Step 3: Critical case verification -----
  console.log('\n' + '━'.repeat(60));
  console.log('3️⃣  Critical case verification');
  console.log('━'.repeat(60) + '\n');

  const results = [];
  for (const c of CRITICAL_CASES) {
    const year = parseInt(c.date.slice(0, 4), 10);
    const dataForYear = allData[c.code]?.byYear[year];
    if (!Array.isArray(dataForYear)) {
      console.log(`   ⚠️  ${c.code} ${c.date}  — no data fetched (skipped)`);
      results.push({ ...c, status: 'no_data', matches: [] });
      continue;
    }

    const matches = findMatchingHoliday(dataForYear, c.date);
    const status = matches.length > 0 ? 'found' : 'missing';
    const flag = c.critical ? '🚨' : '  ';

    if (status === 'found') {
      console.log(`   ${flag} ${status === 'found' ? '✅' : '❌'} ${c.code} ${c.date}  ${c.expect}`);
      for (const m of matches) {
        const types = Array.isArray(m.type) ? m.type.join(', ') : m.type || '?';
        console.log(`        → "${m.name}"  [type: ${types}]`);
      }
    } else {
      console.log(`   ${flag} ❌ ${c.code} ${c.date}  ${c.expect}  — NOT FOUND`);
      console.log(`        💬 ${c.note}`);
    }

    results.push({
      ...c,
      status,
      matches: matches.map(summarizeHolidayEntry),
    });
  }

  // ----- Step 4: Compare with our DB -----
  console.log('\n' + '━'.repeat(60));
  console.log('4️⃣  Compare with our DB (Korea only — most well-known)');
  console.log('━'.repeat(60) + '\n');

  const ourKR = await fetchOurDbHolidays('KR');
  const calendarificKR = [
    ...(allData.KR?.byYear[2025] || []),
    ...(allData.KR?.byYear[2026] || []),
    ...(allData.KR?.byYear[2027] || []),
  ];

  // Build date sets
  const ourDates = new Set(ourKR.map((h) => h.date));
  const calDates = new Set(
    calendarificKR
      .filter((h) => Array.isArray(h.type) ? h.type.includes('National holiday') : true)
      .map((h) => h.date?.iso?.slice(0, 10))
      .filter(Boolean)
  );

  const onlyInDb = [...ourDates].filter((d) => !calDates.has(d)).sort();
  const onlyInCal = [...calDates].filter((d) => !ourDates.has(d)).sort();
  const inBoth = [...ourDates].filter((d) => calDates.has(d)).sort();

  console.log(`   📊 Korea (national holidays only):`);
  console.log(`      In both:           ${inBoth.length}`);
  console.log(`      Only in our DB:    ${onlyInDb.length}`);
  console.log(`      Only in Calendar.: ${onlyInCal.length}`);

  if (onlyInDb.length > 0) {
    console.log(`\n   📌 Dates in our DB but missing from Calendarific (top 10):`);
    for (const d of onlyInDb.slice(0, 10)) {
      const ours = ourKR.find((h) => h.date === d);
      console.log(`      ${d}  ${ours.name} / ${ours.name_local}  [${ours.holiday_category}]`);
    }
  }
  if (onlyInCal.length > 0) {
    console.log(`\n   📌 Dates in Calendarific but missing from our DB (top 10):`);
    for (const d of onlyInCal.slice(0, 10)) {
      const cal = calendarificKR.find((h) => h.date?.iso?.slice(0, 10) === d);
      const types = Array.isArray(cal.type) ? cal.type.join(', ') : cal.type;
      console.log(`      ${d}  ${cal.name}  [${types}]`);
    }
  }

  // ----- Step 5: Save raw data + summary -----
  const outDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `calendarific-test-${dateStr}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        api_calls_used: callsUsed,
        api_calls_remaining_this_month: 500 - callsUsed,
        targets: TARGETS,
        years: YEARS,
        critical_cases: results,
        comparison_korea: {
          in_both: inBoth.length,
          only_in_our_db: onlyInDb.length,
          only_in_calendarific: onlyInCal.length,
          only_in_db_dates: onlyInDb,
          only_in_cal_dates: onlyInCal,
        },
        raw_data: allData,
      },
      null,
      2
    )
  );

  // ----- Verdict guidance -----
  console.log('\n' + '━'.repeat(60));
  console.log('🎯 VERDICT GUIDANCE');
  console.log('━'.repeat(60));

  const criticalFound = results.filter((r) => r.critical && r.status === 'found').length;
  const criticalTotal = results.filter((r) => r.critical).length;
  const criticalRate = ((criticalFound / criticalTotal) * 100).toFixed(0);

  console.log(`\n   Critical cases found: ${criticalFound}/${criticalTotal} (${criticalRate}%)\n`);

  if (criticalRate >= 90) {
    console.log('   ✅ EXCELLENT — Calendarific covers our needs well.');
    console.log('   → Recommend Starter plan ($100/year) for production.');
  } else if (criticalRate >= 70) {
    console.log('   ⚠️ ACCEPTABLE — Most cases covered but some gaps.');
    console.log('   → Consider Starter plan + manual fixes for edge cases.');
  } else if (criticalRate >= 50) {
    console.log('   ⚠️ MEDIOCRE — Significant gaps.');
    console.log('   → Test other APIs (HolidayDB, HolidayAPI.com) before deciding.');
  } else {
    console.log('   ❌ POOR — Calendarific is not sufficient.');
    console.log('   → Look for other solutions.');
  }

  console.log(`\n💾 Raw data + report: ${outPath}`);
  console.log(`⏱️  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
