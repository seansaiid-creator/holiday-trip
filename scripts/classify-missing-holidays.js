// ==========================================================
// classify-missing-holidays.js
//
// Reads all per-country validation reports from tmp/, extracts
// missing_in_db findings, and classifies each as:
//   - national:   nationwide public holiday (DB candidate)
//   - regional:   only applies to specific region/territory
//   - observance: not an actual public holiday (cultural/religious)
//   - uncertain:  Gemini can't tell — needs manual review
//
// Per-country batched calls to Gemini Flash. Results saved to a
// single JSON file for review.
//
// MODE: Diagnostic only. DOES NOT modify the DB.
//
// USAGE:
//   node scripts/classify-missing-holidays.js
//   node scripts/classify-missing-holidays.js --date 2026-04-24
//     (uses validation reports from that date; defaults to today)
// ==========================================================

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Parse --date CLI flag
function parseDate() {
  const idx = process.argv.indexOf('--date');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return new Date().toISOString().slice(0, 10);
}

// Country codes we have validation reports for (from tmp/)
function findValidationReports(reportDir, dateStr) {
  if (!fs.existsSync(reportDir)) return [];
  const files = fs.readdirSync(reportDir);
  const matching = files.filter((f) =>
    /^validation-[A-Z]{2}-/.test(f) && f.endsWith(`-${dateStr}.json`)
  );
  return matching.map((f) => path.join(reportDir, f));
}

// ==========================================================
// Gemini classification — per country
// ==========================================================
async function classifyCountryMissing(countryCode, countryName, missingItems) {
  if (missingItems.length === 0) {
    return { country_code: countryCode, country_name: countryName, classifications: [] };
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Compact representation for the prompt
  const items = missingItems.map((m, idx) => {
    const wiki = m.group?.wikipedia?.[0] || {};
    return {
      id: idx,
      date: m.date,
      name_en: wiki.name_en || m.recommended_name_en || 'unknown',
      name_local: wiki.name_local || null,
      category: wiki.category || 'regular',
      is_substitute_for: wiki.is_substitute_for || null,
    };
  });

  const prompt = `You are classifying potential public holidays for ${countryName} (country code: ${countryCode}).

Each item below was found on Wikipedia's "Public holidays in ${countryName}" page but is MISSING from our database. Your job is to decide whether each one belongs in a travel-information database aimed at general travelers.

For EACH item, classify into ONE of:

1. "national" — The holiday applies nationwide. All citizens get the day off, government and most businesses close, ordinary travelers will be affected (closed shops, transit changes, no banks). Includes substitute holidays for nationwide holidays.

2. "regional" — The holiday only applies to a specific region, state, province, overseas territory, or autonomous area within the country. For example: French overseas departments (Réunion, Guadeloupe, Martinique, etc.), Alsace-Moselle special holidays, US state-only holidays, German state-only holidays, Chinese autonomous region holidays.

3. "observance" — Not a legal public holiday at all. Cultural, religious, or commemorative day where work and school continue normally. Example: Mother's Day, Earth Day, name days, traditional festivals that aren't legal holidays.

4. "uncertain" — You genuinely cannot determine which category applies based on available information.

KEY RULES:
- Bias toward "national" for items where the eve/day_after/substitute category clearly chains with a major national holiday (e.g. Chinese Spring Festival eve → national, since the entire holiday is national).
- Connecting/bridge days (e.g. Chinese May Day extended weekend, Spring Festival 7-day Golden Week) are still "national" — they are official national holidays.
- For ${countryName} specifically, consider the legal/official status, not just cultural prominence.
- Be conservative: if uncertain, prefer "uncertain" over guessing.

Output ONLY valid JSON. No markdown, no code fences, no commentary:
{
  "classifications": [
    {
      "id": 0,
      "category": "national" | "regional" | "observance" | "uncertain",
      "reason": "brief one-sentence explanation",
      "region_name": "specific region if category is regional, else null",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

ITEMS TO CLASSIFY:
${JSON.stringify(items, null, 2)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error(`   ❌ Parse error for ${countryCode}: ${err.message}`);
    console.error('   First 500 chars of response:', cleaned.slice(0, 500));
    throw err;
  }

  // Merge classifications back into the original items
  const enriched = missingItems.map((m, idx) => {
    const wiki = m.group?.wikipedia?.[0] || {};
    const c = parsed.classifications.find((x) => x.id === idx);
    return {
      date: m.date,
      name_en: wiki.name_en || m.recommended_name_en,
      name_local: wiki.name_local || null,
      wiki_category: wiki.category || 'regular',
      // Gemini classification
      classification: c ? c.category : 'uncertain',
      reason: c ? c.reason : 'No classification returned',
      region_name: c ? c.region_name : null,
      confidence: c ? c.confidence : 'low',
    };
  });

  return {
    country_code: countryCode,
    country_name: countryName,
    total_missing: missingItems.length,
    classifications: enriched,
  };
}

// ==========================================================
// MAIN
// ==========================================================
async function main() {
  const startTime = Date.now();
  const dateStr = parseDate();

  console.log(`🏷️  Classifying missing_in_db findings`);
  console.log(`   Source date: ${dateStr}`);
  console.log(`   Mode: DIAGNOSTIC ONLY (no DB changes)\n`);

  // 1. Find all validation reports
  const reportDir = path.join(__dirname, '..', 'tmp');
  const reportPaths = findValidationReports(reportDir, dateStr);

  if (reportPaths.length === 0) {
    console.error(`❌ No validation reports found for date ${dateStr} in ${reportDir}`);
    console.error('   Run "node scripts/validate-all-countries.js" first.');
    process.exit(1);
  }

  console.log(`📂 Found ${reportPaths.length} validation reports:`);
  reportPaths.forEach((p) => console.log(`   - ${path.basename(p)}`));

  // 2. Load each report and extract missing_in_db
  const countryMissing = [];
  for (const rp of reportPaths) {
    const report = JSON.parse(fs.readFileSync(rp, 'utf-8'));
    const missing = report.results.filter((r) => r.verification_status === 'missing_in_db');
    if (missing.length > 0) {
      countryMissing.push({
        country_code: report.country_code,
        country_name: report.country,
        missing,
      });
    }
  }

  const totalMissing = countryMissing.reduce((acc, c) => acc + c.missing.length, 0);
  console.log(`\n📊 ${totalMissing} missing items across ${countryMissing.length} countries:`);
  countryMissing.forEach((c) => console.log(`   ${c.country_code}: ${c.missing.length}`));
  console.log('');

  // 3. Classify each country sequentially
  const allClassifications = [];

  for (let i = 0; i < countryMissing.length; i++) {
    const c = countryMissing[i];
    console.log('━'.repeat(60));
    console.log(`[${i + 1}/${countryMissing.length}]  🏁  ${c.country_name} (${c.country_code}) — ${c.missing.length} items`);
    console.log('━'.repeat(60));

    try {
      const t0 = Date.now();
      const result = await classifyCountryMissing(c.country_code, c.country_name, c.missing);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      // Per-country breakdown
      const breakdown = { national: 0, regional: 0, observance: 0, uncertain: 0 };
      for (const cls of result.classifications) {
        if (cls.classification in breakdown) breakdown[cls.classification]++;
      }

      console.log(`   ✓ Classified in ${elapsed}s`);
      console.log(`     national:   ${breakdown.national}`);
      console.log(`     regional:   ${breakdown.regional}`);
      console.log(`     observance: ${breakdown.observance}`);
      console.log(`     uncertain:  ${breakdown.uncertain}`);

      allClassifications.push(result);
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      allClassifications.push({
        country_code: c.country_code,
        country_name: c.country_name,
        total_missing: c.missing.length,
        error: err.message,
        classifications: [],
      });
    }

    // Pace between countries
    if (i < countryMissing.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
    console.log('');
  }

  // 4. Combined summary
  console.log('═'.repeat(60));
  console.log('🌍  CLASSIFICATION SUMMARY');
  console.log('═'.repeat(60) + '\n');

  const totalBreakdown = { national: 0, regional: 0, observance: 0, uncertain: 0 };
  console.log('  Country         Total  National  Regional  Observance  Uncertain');
  console.log('  ' + '─'.repeat(65));

  for (const c of allClassifications) {
    if (c.error) {
      console.log(`  ${c.country_code.padEnd(15)}  FAILED: ${c.error.slice(0, 40)}`);
      continue;
    }
    const breakdown = { national: 0, regional: 0, observance: 0, uncertain: 0 };
    for (const cls of c.classifications) {
      if (cls.classification in breakdown) {
        breakdown[cls.classification]++;
        totalBreakdown[cls.classification]++;
      }
    }
    console.log(
      `  ${c.country_name.slice(0, 15).padEnd(15)}  ${String(c.total_missing).padStart(5)}  ${String(breakdown.national).padStart(8)}  ${String(breakdown.regional).padStart(8)}  ${String(breakdown.observance).padStart(10)}  ${String(breakdown.uncertain).padStart(9)}`
    );
  }

  console.log('  ' + '─'.repeat(65));
  console.log(
    `  TOTAL            ${String(totalMissing).padStart(5)}  ${String(totalBreakdown.national).padStart(8)}  ${String(totalBreakdown.regional).padStart(8)}  ${String(totalBreakdown.observance).padStart(10)}  ${String(totalBreakdown.uncertain).padStart(9)}`
  );

  // 5. Save combined JSON
  const outPath = path.join(reportDir, `missing-classification-${dateStr}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source_date: dateStr,
        duration_ms: Date.now() - startTime,
        total_missing: totalMissing,
        breakdown: totalBreakdown,
        countries: allClassifications,
      },
      null,
      2
    )
  );

  // 6. Highlights — print interesting findings
  console.log('\n' + '═'.repeat(60));
  console.log('🔍 HIGHLIGHTS');
  console.log('═'.repeat(60) + '\n');

  // National holidays we should consider adding
  console.log('🇨 NATIONAL holidays (DB add candidates):\n');
  let nationalShown = 0;
  for (const c of allClassifications) {
    const nationals = (c.classifications || []).filter((x) => x.classification === 'national');
    if (nationals.length === 0) continue;
    console.log(`  ${c.country_name} (${nationals.length}):`);
    for (const n of nationals.slice(0, 5)) {
      console.log(`    ${n.date}  ${n.name_en}`);
      nationalShown++;
    }
    if (nationals.length > 5) console.log(`    ... +${nationals.length - 5} more`);
    console.log('');
  }

  // Uncertain — needs manual review
  const allUncertain = allClassifications.flatMap((c) =>
    (c.classifications || []).filter((x) => x.classification === 'uncertain')
      .map((x) => ({ ...x, country: c.country_name }))
  );
  if (allUncertain.length > 0) {
    console.log('❓ UNCERTAIN (needs manual review):\n');
    for (const u of allUncertain.slice(0, 10)) {
      console.log(`  ${u.country.padEnd(15)} ${u.date}  ${u.name_en}`);
      console.log(`    💬 ${u.reason}`);
    }
    if (allUncertain.length > 10) console.log(`  ... +${allUncertain.length - 10} more`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`💾 Detailed report: ${outPath}`);
  console.log(`⏱️  Total duration: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} min`);
  console.log('\n✅ Classification complete. No DB changes were made.');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
