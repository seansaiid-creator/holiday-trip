// ==========================================================
// apply-validation.js
//
// Reads a validation report JSON (produced by cross-validate-holidays.js)
// and applies the results to the database:
//
//   1. UPDATE holidays SET verification_status, verification_sources,
//      verification_note for each result with a db_id
//   2. UPSERT into validation_findings for missing_in_db / conflict cases
//      that don't correspond to a DB row
//
// Skips manual_locked rows (already filtered by the diagnostic script,
// but defensively re-checked here).
//
// USAGE:
//   node scripts/apply-validation.js validation-KR-2026-04-20.json
//   (path is relative to ./tmp/ )
//
// MODE: Always asks for confirmation before writing.
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

// ==========================================================
// Helpers
// ==========================================================
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function loadReport(reportName) {
  const reportPath = path.isAbsolute(reportName)
    ? reportName
    : path.join(__dirname, '..', 'tmp', reportName);

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report file not found: ${reportPath}`);
  }

  const raw = fs.readFileSync(reportPath, 'utf-8');
  return { report: JSON.parse(raw), reportPath };
}

async function getCountryId(code) {
  const { data, error } = await supabase
    .from('countries')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Country ${code} not found`);
  return data.id;
}

// ==========================================================
// Plan: separate results into UPDATE vs FINDING categories
// ==========================================================
function planChanges(report) {
  const updates = [];     // holidays UPDATE plan
  const findings = [];    // validation_findings UPSERT plan
  const skipped = [];     // results we won't act on (e.g. all-empty groups)

  for (const r of report.results) {
    const dbEntries = r.group?.db || [];
    const status = r.verification_status;

    // sources object — what each source had
    const sources = {
      db: dbEntries.length > 0,
      wikipedia: (r.group?.wikipedia || []).length > 0,
      nager: (r.group?.nager || []).length > 0,
    };

    // note for the UPDATE
    const noteParts = [];
    if (r.note) noteParts.push(r.note);
    if (r.issue) noteParts.push(`Issue: ${r.issue}`);
    if (r.recommended_name_en && status === 'conflict') {
      noteParts.push(`Recommended name: ${r.recommended_name_en}`);
    }
    const note = noteParts.join(' | ') || null;

    // --- Case A: UPDATE existing DB rows ---
    // For each DB row on this date, plan an UPDATE with the verification result.
    if (dbEntries.length > 0) {
      for (const dbEntry of dbEntries) {
        updates.push({
          db_id: dbEntry.db_id,
          date: r.date,
          name: dbEntry.name_en,
          verification_status: status,
          verification_sources: sources,
          verification_note: note,
        });
      }
    }

    // --- Case B: FINDINGS for missing_in_db (no DB row to update) ---
    if (status === 'missing_in_db' && dbEntries.length === 0) {
      findings.push({
        finding_date: r.date,
        finding_type: 'missing_in_db',
        sources_data: r.group,
        recommended_name_en: r.recommended_name_en || null,
        recommended_action: r.action || 'manual_review',
        issue_description: r.issue || null,
      });
      continue;
    }

    // --- Case C: FINDINGS for true conflicts (DB row exists but disagrees badly) ---
    if (status === 'conflict' && r.action === 'manual_review' && dbEntries.length > 0) {
      findings.push({
        finding_date: r.date,
        finding_type: 'conflict',
        sources_data: r.group,
        recommended_name_en: r.recommended_name_en || null,
        recommended_action: r.action,
        issue_description: r.issue || 'Sources disagree on this date',
      });
    }

    // --- Case D: nothing to do ---
    if (dbEntries.length === 0 && status !== 'missing_in_db') {
      skipped.push({ date: r.date, status, reason: 'no DB row and not missing_in_db' });
    }
  }

  return { updates, findings, skipped };
}

// ==========================================================
// Apply the plan to the DB
// ==========================================================
async function applyUpdates(updates) {
  let success = 0;
  let failed = 0;

  for (const u of updates) {
    const { error } = await supabase
      .from('holidays')
      .update({
        verification_status: u.verification_status,
        verification_sources: u.verification_sources,
        verification_note: u.verification_note,
      })
      .eq('id', u.db_id)
      .eq('manual_locked', false); // defensive: never overwrite locked rows

    if (error) {
      console.error(`   ❌ Failed UPDATE id=${u.db_id} (${u.date} ${u.name}): ${error.message}`);
      failed++;
    } else {
      success++;
    }
  }

  return { success, failed };
}

async function applyFindings(findings, countryId, runId) {
  let success = 0;
  let failed = 0;

  for (const f of findings) {
    // UPSERT on (country_id, finding_date, finding_type)
    const { error } = await supabase
      .from('validation_findings')
      .upsert(
        {
          country_id: countryId,
          finding_date: f.finding_date,
          finding_type: f.finding_type,
          status: 'open',
          sources_data: f.sources_data,
          recommended_name_en: f.recommended_name_en,
          recommended_action: f.recommended_action,
          issue_description: f.issue_description,
          validation_run_id: runId,
          detected_at: new Date().toISOString(),
        },
        { onConflict: 'country_id,finding_date,finding_type' }
      );

    if (error) {
      console.error(`   ❌ Failed finding ${f.finding_date} ${f.finding_type}: ${error.message}`);
      failed++;
    } else {
      success++;
    }
  }

  return { success, failed };
}

// ==========================================================
// MAIN
// ==========================================================
async function main() {
  const reportName = process.argv[2];
  if (!reportName) {
    console.error('❌ Usage: node scripts/apply-validation.js <report-filename>');
    console.error('   e.g.  node scripts/apply-validation.js validation-KR-2026-04-20.json');
    process.exit(1);
  }

  console.log(`📂 Loading report: ${reportName}`);
  const { report, reportPath } = loadReport(reportName);

  const countryCode = report.country_code;
  const runId = report.validation_run_id || `${countryCode}-${new Date().toISOString().slice(0, 10)}`;

  console.log(`   Country: ${report.country} (${countryCode})`);
  console.log(`   Run ID:  ${runId}`);
  console.log(`   Years:   ${report.years.join(', ')}`);
  console.log(`   Generated: ${report.generated_at}`);
  console.log(`   Total results: ${report.results.length}\n`);

  // --- Plan ---
  console.log('━'.repeat(60));
  console.log('1️⃣  Planning changes');
  console.log('━'.repeat(60));
  const plan = planChanges(report);

  console.log(`\n   📝 holidays UPDATEs: ${plan.updates.length}`);
  console.log(`   📌 validation_findings UPSERTs: ${plan.findings.length}`);
  console.log(`   ⏭️  Skipped: ${plan.skipped.length}`);

  // Status breakdown for updates
  const statusBreakdown = {};
  for (const u of plan.updates) {
    statusBreakdown[u.verification_status] = (statusBreakdown[u.verification_status] || 0) + 1;
  }
  console.log('\n   Status breakdown for UPDATEs:');
  for (const [status, count] of Object.entries(statusBreakdown)) {
    console.log(`      ${status.padEnd(20)} ${count}`);
  }

  if (plan.findings.length > 0) {
    console.log('\n   Findings to record:');
    for (const f of plan.findings) {
      const dbCount = (f.sources_data?.db || []).length;
      const wikiCount = (f.sources_data?.wikipedia || []).length;
      const nagerCount = (f.sources_data?.nager || []).length;
      console.log(`      ${f.finding_date}  ${f.finding_type.padEnd(15)}  DB:${dbCount} Wiki:${wikiCount} Nager:${nagerCount}`);
      if (f.issue_description) console.log(`         💬 ${f.issue_description.slice(0, 80)}`);
    }
  }

  // --- Confirm ---
  console.log('\n' + '━'.repeat(60));
  const answer = await ask('\n❓ Apply these changes to the DB? (y/N): ');
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\n🚫 Cancelled. No changes made.');
    process.exit(0);
  }

  // --- Apply ---
  console.log('\n' + '━'.repeat(60));
  console.log('2️⃣  Applying to DB');
  console.log('━'.repeat(60) + '\n');

  const countryId = await getCountryId(countryCode);

  console.log(`   Updating ${plan.updates.length} holidays rows...`);
  const updateResult = await applyUpdates(plan.updates);
  console.log(`   ✓ UPDATEs: ${updateResult.success} succeeded, ${updateResult.failed} failed`);

  if (plan.findings.length > 0) {
    console.log(`\n   Upserting ${plan.findings.length} validation_findings rows...`);
    const findingResult = await applyFindings(plan.findings, countryId, runId);
    console.log(`   ✓ FINDINGS: ${findingResult.success} succeeded, ${findingResult.failed} failed`);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ Apply complete.');
  console.log('━'.repeat(60));
  console.log(`\n💡 To review findings later, query:`);
  console.log(`   SELECT * FROM validation_findings WHERE status = 'open' ORDER BY detected_at DESC;`);
  console.log(`\n💡 To lock a row from future re-validation:`);
  console.log(`   UPDATE holidays SET manual_locked = true, manual_locked_at = NOW(),`);
  console.log(`     manual_locked_reason = 'reason here' WHERE id = ...;`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
