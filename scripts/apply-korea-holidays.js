// scripts/apply-korea-holidays.js
// 한국 공휴일을 정부 공식 데이터로 갱신
//
// 사용법:
//   node scripts/apply-korea-holidays.js          # Dry-run
//   node scripts/apply-korea-holidays.js --apply  # 실제 적용
//
// v2 변경사항:
// - 한영 매핑 테이블로 정확한 매칭
// - 같은 날짜에 여러 공휴일 있어도 올바르게 처리
// - name(영어) 보존, name_local(한글)만 정부 공식으로 갱신

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ========== 설정 ==========
const KOREA_COUNTRY_CODE = 'KR';
const TARGET_YEARS = [2025, 2026, 2027];
const API_KEY = process.env.KOREA_HOLIDAY_API_KEY;
const BASE_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
const LUNAR_BASE_URL = 'http://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService';

const EXCLUDED_NAMES = ['제헌절'];
const APPLY_MODE = process.argv.includes('--apply');

// 한국 공휴일 한영 매핑 (정부 API 한글 → 영어)
const KOREAN_TO_ENGLISH = {
  '1월1일': "New Year's Day",
  '설날': 'Lunar New Year',
  '삼일절': 'Independence Movement Day',
  '어린이날': "Children's Day",
  '부처님오신날': "Buddha's Birthday",
  '노동절': 'Labor Day',
  '현충일': 'Memorial Day',
  '광복절': 'Liberation Day',
  '추석': 'Chuseok',
  '개천절': 'National Foundation Day',
  '한글날': 'Hangul Day',
  '기독탄신일': 'Christmas Day',
};

// 대체공휴일/임시공휴일 영문 변환
function getEnglishName(koreanName) {
  // 대체공휴일
  if (koreanName.includes('대체공휴일')) {
    const match = koreanName.match(/대체공휴일\(([^)]+)\)/);
    if (match) {
      const originalEng = KOREAN_TO_ENGLISH[match[1]] || match[1];
      return `Substitute Holiday (${originalEng})`;
    }
    return 'Substitute Holiday';
  }
  // 임시공휴일
  if (koreanName.includes('임시공휴일')) {
    if (koreanName.includes('선거')) {
      return `Temporary Holiday (Presidential Election)`;
    }
    return 'Temporary Public Holiday';
  }
  // 선거
  if (koreanName.includes('전국동시지방선거')) {
    return 'Local Elections Day';
  }
  // 기본 매핑
  return KOREAN_TO_ENGLISH[koreanName] || koreanName;
}

// ========== Supabase 초기화 ==========
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ========== 유틸 함수 ==========
function formatDate(yyyymmdd) {
  const s = String(yyyymmdd);
  return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
}

const dayNames = ['일','월','화','수','목','금','토'];
function getDayName(dateStr) {
  return dayNames[new Date(dateStr).getDay()];
}

// ========== API 호출 ==========
async function fetchOfficialHolidays(year) {
  const url = `${BASE_URL}/getHoliDeInfo?ServiceKey=${encodeURIComponent(API_KEY)}&solYear=${year}&numOfRows=100&_type=json`;
  const response = await fetch(url);
  const data = await response.json();
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list
    .filter(h => h.isHoliday === 'Y')
    .filter(h => !EXCLUDED_NAMES.includes(h.dateName))
    .map(h => ({
      date: formatDate(h.locdate),
      nameKorean: h.dateName,
      nameEnglish: getEnglishName(h.dateName),
    }));
}

async function getLunarDate(solarDate) {
  const [y, m, d] = solarDate.split('-');
  const url = `${LUNAR_BASE_URL}/getLunCalInfo?ServiceKey=${encodeURIComponent(API_KEY)}&solYear=${y}&solMonth=${m}&solDay=${d}&_type=json`;
  const response = await fetch(url);
  const data = await response.json();
  const item = data?.response?.body?.items?.item;
  if (!item) return null;
  return {
    lunYear: parseInt(item.lunYear),
    lunMonth: parseInt(item.lunMonth),
    lunDay: parseInt(item.lunDay),
  };
}

// ========== 분류 함수 ==========
function classifyHoliday(holiday, lunarInfo) {
  if (holiday.nameKorean.includes('대체공휴일')) {
    return {
      category: 'substitute',
      isSubstitute: true,
      substituteForName: holiday.nameKorean.match(/\(([^)]+)\)/)?.[1] || null,
    };
  }

  if (lunarInfo) {
    if (holiday.nameKorean === '설날') {
      if (lunarInfo.lunMonth === 1 && lunarInfo.lunDay === 1) return { category: 'regular', isSubstitute: false };
      if (lunarInfo.lunMonth === 12) return { category: 'eve', isSubstitute: false };
      if (lunarInfo.lunMonth === 1 && lunarInfo.lunDay === 2) return { category: 'day_after', isSubstitute: false };
    }
    if (holiday.nameKorean === '추석') {
      if (lunarInfo.lunMonth === 8 && lunarInfo.lunDay === 15) return { category: 'regular', isSubstitute: false };
      if (lunarInfo.lunMonth === 8 && lunarInfo.lunDay === 14) return { category: 'eve', isSubstitute: false };
      if (lunarInfo.lunMonth === 8 && lunarInfo.lunDay === 16) return { category: 'day_after', isSubstitute: false };
    }
  }

  if (holiday.nameKorean.includes('임시공휴일') || holiday.nameKorean.includes('선거')) {
    return { category: 'temporary', isSubstitute: false };
  }

  return { category: 'regular', isSubstitute: false };
}

function generateNote(holiday, classification, lunarInfo) {
  if (classification.isSubstitute && classification.substituteForName) {
    return `원래 공휴일(${classification.substituteForName})이 주말 또는 다른 공휴일과 겹쳐 지정된 대체공휴일`;
  }

  if (holiday.nameKorean === '노동절') {
    return '노동절. 2026년 법 개정으로 법정공휴일 승격 (이전 명칭: 근로자의 날). 모든 관공서, 학교, 은행, 기업 휴무.';
  }

  if (classification.category === 'temporary') {
    if (holiday.nameKorean.includes('선거')) {
      return `${holiday.nameKorean} - 공직선거법에 따른 법정 임시공휴일`;
    }
    return `${holiday.nameKorean} - 정부 지정 임시공휴일`;
  }

  if (lunarInfo && (holiday.nameKorean === '설날' || holiday.nameKorean === '추석')) {
    if (classification.category === 'eve') return `${holiday.nameKorean} 전날 (음력 ${lunarInfo.lunMonth}/${lunarInfo.lunDay})`;
    if (classification.category === 'day_after') return `${holiday.nameKorean} 다음날 (음력 ${lunarInfo.lunMonth}/${lunarInfo.lunDay})`;
    if (classification.category === 'regular') return `${holiday.nameKorean} 당일 (음력 ${lunarInfo.lunMonth}/${lunarInfo.lunDay})`;
  }

  return null;
}

// ========== 데이터 수집 ==========
async function buildOfficialDataset() {
  console.log('━'.repeat(70));
  console.log('1️⃣  정부 공식 데이터 수집');
  console.log('━'.repeat(70));

  const all = [];
  for (const year of TARGET_YEARS) {
    console.log(`\n📅 ${year}년 공휴일 수집 중...`);
    const holidays = await fetchOfficialHolidays(year);
    console.log(`   → ${holidays.length}개 발견`);

    for (const h of holidays) {
      let lunarInfo = null;
      if (h.nameKorean === '설날' || h.nameKorean === '추석') {
        lunarInfo = await getLunarDate(h.date);
        await new Promise(r => setTimeout(r, 200));
      }

      const classification = classifyHoliday(h, lunarInfo);
      const note = generateNote(h, classification, lunarInfo);

      all.push({
        date: h.date,
        nameKorean: h.nameKorean,
        nameEnglish: h.nameEnglish,
        year: parseInt(h.date.substring(0, 4)),
        category: classification.category,
        isSubstitute: classification.isSubstitute,
        substituteForName: classification.substituteForName || null,
        note,
        lunarInfo,
      });
    }
  }

  console.log(`\n✅ 정부 공식 데이터 ${all.length}개 수집 완료`);
  return all;
}

// ========== 기존 DB 조회 ==========
async function fetchExistingDB() {
  console.log('\n━'.repeat(70));
  console.log('2️⃣  기존 DB 데이터 조회');
  console.log('━'.repeat(70));

  const { data: country } = await supabase
    .from('countries').select('id, code, name')
    .eq('code', KOREA_COUNTRY_CODE).single();

  if (!country) throw new Error('한국 country 데이터 없음');

  const { data: holidays } = await supabase
    .from('holidays').select('*')
    .eq('country_id', country.id)
    .in('year', TARGET_YEARS)
    .order('date');

  console.log(`✅ 기존 DB ${holidays.length}개 조회 완료`);
  return { country, dbHolidays: holidays };
}

// ========== 백업 ==========
function backupExisting(dbHolidays) {
  const backupDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `korea-holidays-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    backed_up_at: new Date().toISOString(),
    country_code: KOREA_COUNTRY_CODE,
    target_years: TARGET_YEARS,
    holidays: dbHolidays,
  }, null, 2));

  console.log(`💾 백업 저장: ${backupPath}`);
  return backupPath;
}

// ========== 매칭 함수 (핵심 개선) ==========
// 정부 API 항목 → DB 행 매칭
function findMatchingDBRow(official, dbHolidaysOnSameDate, usedDBIds) {
  // 같은 날짜의 DB 행 중, 아직 사용되지 않은 것들
  const available = dbHolidaysOnSameDate.filter(d => !usedDBIds.has(d.id));

  if (available.length === 0) return null;

  // 영어 이름으로 매칭 시도
  const byEngName = available.find(d =>
    d.name && d.name.toLowerCase() === official.nameEnglish.toLowerCase()
  );
  if (byEngName) return byEngName;

  // 한글 이름으로 매칭 시도 (name_local)
  const byLocalName = available.find(d =>
    d.name_local && d.name_local.replace(/\s+/g, '') === official.nameKorean.replace(/\s+/g, '')
  );
  if (byLocalName) return byLocalName;

  // 부분 매칭 (대체공휴일 같은 경우)
  const byPartial = available.find(d => {
    if (!d.name) return false;
    const dbName = d.name.toLowerCase();
    const offName = official.nameEnglish.toLowerCase();
    return dbName.includes(offName) || offName.includes(dbName);
  });
  if (byPartial) return byPartial;

  // 그래도 없으면 사용 가능한 첫 번째 것 (같은 날짜)
  return available[0];
}

// ========== 변경 계획 ==========
function planChanges(officialList, dbHolidays, country) {
  // 날짜별로 DB 행 그룹화
  const dbByDate = new Map();
  for (const h of dbHolidays) {
    if (!dbByDate.has(h.date)) dbByDate.set(h.date, []);
    dbByDate.get(h.date).push(h);
  }

  const insertions = [];
  const updates = [];
  const usedDBIds = new Set();
  const now = new Date().toISOString();

  for (const o of officialList) {
    const dbOnSameDate = dbByDate.get(o.date) || [];
    const matched = findMatchingDBRow(o, dbOnSameDate, usedDBIds);

    if (!matched) {
      // INSERT
      insertions.push({
        country_id: country.id,
        date: o.date,
        name: o.nameEnglish,
        name_local: o.nameKorean,
        type: 'Public',
        is_public: true,
        year: o.year,
        holiday_category: o.category,
        is_substitute: o.isSubstitute,
        substitute_reason: o.isSubstitute ? `${o.substituteForName || '원래 공휴일'}이 주말과 겹침` : null,
        note: o.note,
        data_verified: true,
        data_source: 'korea_official',
        verified_at: now,
      });
    } else {
      // UPDATE - name은 보존, name_local은 한글로 갱신
      usedDBIds.add(matched.id);

      const updateData = {
        // name은 건드리지 않음 (기존 영어 보존)
        name_local: o.nameKorean,  // 정부 공식 한글로 통일
        holiday_category: o.category,
        is_substitute: o.isSubstitute,
        substitute_reason: o.isSubstitute ? `${o.substituteForName || '원래 공휴일'}이 주말과 겹침` : null,
        note: o.note,
        data_verified: true,
        data_source: 'korea_official',
        verified_at: now,
      };

      const hasChange =
        matched.name_local !== updateData.name_local ||
        matched.holiday_category !== updateData.holiday_category ||
        matched.is_substitute !== updateData.is_substitute ||
        matched.data_source !== updateData.data_source;

      if (hasChange) {
        updates.push({
          id: matched.id,
          date: o.date,
          before: {
            name: matched.name,
            name_local: matched.name_local,
            category: matched.holiday_category,
            is_substitute: matched.is_substitute,
            data_source: matched.data_source,
          },
          after: {
            name: matched.name, // 보존
            name_local: updateData.name_local,
            category: updateData.holiday_category,
            is_substitute: updateData.is_substitute,
            data_source: updateData.data_source,
          },
          updateData,
        });
      }
    }
  }

  // DB에는 있지만 정부 API에 없는 항목 (확인용)
  const orphans = [];
  for (const d of dbHolidays) {
    if (!usedDBIds.has(d.id)) {
      orphans.push(d);
    }
  }

  return { insertions, updates, orphans };
}

// ========== 출력 ==========
function printPlan(plan) {
  console.log('\n━'.repeat(70));
  console.log('3️⃣  변경 계획');
  console.log('━'.repeat(70));

  console.log(`\n🟢 INSERT: ${plan.insertions.length}개 추가`);
  if (plan.insertions.length > 0) {
    console.log('─'.repeat(70));
    plan.insertions.forEach(i => {
      const cat = i.holiday_category.padEnd(10);
      const sub = i.is_substitute ? ' [substitute]' : '';
      const dow = getDayName(i.date);
      console.log(`  + ${i.date} (${dow})  ${cat}  ${i.name} / ${i.name_local}${sub}`);
      if (i.note) console.log(`      📝 ${i.note}`);
    });
  }

  console.log(`\n🟡 UPDATE: ${plan.updates.length}개 수정`);
  if (plan.updates.length > 0) {
    console.log('─'.repeat(70));
    plan.updates.forEach(u => {
      const dow = getDayName(u.date);
      console.log(`  ~ ${u.date} (${dow})  ${u.after.name} / ${u.after.name_local}  (id=${u.id})`);
      const nameLocalChange = u.before.name_local !== u.after.name_local
        ? ` | name_local: "${u.before.name_local}" → "${u.after.name_local}"`
        : '';
      console.log(`      변경: ${u.before.category || '없음'}/sub=${u.before.is_substitute || false} → ${u.after.category}/sub=${u.after.is_substitute}${nameLocalChange}`);
    });
  }

  if (plan.orphans && plan.orphans.length > 0) {
    console.log(`\n⚠️  정부 API에 없는 DB 항목 (검토 필요): ${plan.orphans.length}개`);
    console.log('─'.repeat(70));
    plan.orphans.forEach(o => {
      console.log(`  ? ${o.date}  ${o.name} / ${o.name_local}  (id=${o.id})`);
    });
    console.log('  💡 이 항목들은 건드리지 않습니다. 수동 검토 필요.');
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`📈 총 변경: INSERT ${plan.insertions.length} + UPDATE ${plan.updates.length} = ${plan.insertions.length + plan.updates.length}개`);
  if (plan.orphans.length > 0) console.log(`⚠️  확인 필요 ${plan.orphans.length}개 (변경 없음)`);
  console.log('═'.repeat(70));
}

// ========== 실제 적용 ==========
async function applyChanges(plan) {
  console.log('\n━'.repeat(70));
  console.log('4️⃣  실제 DB 변경 실행');
  console.log('━'.repeat(70));

  let insertCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  if (plan.insertions.length > 0) {
    console.log(`\n🟢 INSERT ${plan.insertions.length}개 실행 중...`);
    const { data, error } = await supabase
      .from('holidays').insert(plan.insertions).select('id, date, name');

    if (error) {
      console.error(`   ❌ INSERT 실패:`, error.message);
      errorCount++;
    } else {
      insertCount = data.length;
      console.log(`   ✅ ${insertCount}개 추가 완료`);
    }
  }

  if (plan.updates.length > 0) {
    console.log(`\n🟡 UPDATE ${plan.updates.length}개 실행 중...`);
    for (const u of plan.updates) {
      const { error } = await supabase
        .from('holidays').update(u.updateData).eq('id', u.id);
      if (error) {
        console.error(`   ❌ UPDATE 실패 (id=${u.id}):`, error.message);
        errorCount++;
      } else {
        updateCount++;
      }
    }
    console.log(`   ✅ ${updateCount}/${plan.updates.length}개 수정 완료`);
  }

  console.log(`\n🔗 대체공휴일 ↔ 정규공휴일 연결 중...`);
  await linkSubstitutes();

  return { insertCount, updateCount, errorCount };
}

async function linkSubstitutes() {
  const { data: country } = await supabase
    .from('countries').select('id').eq('code', KOREA_COUNTRY_CODE).single();

  const { data: substitutes } = await supabase
    .from('holidays').select('id, date, name, name_local, year')
    .eq('country_id', country.id)
    .in('year', TARGET_YEARS)
    .eq('is_substitute', true);

  if (!substitutes || substitutes.length === 0) {
    console.log('   (대체공휴일 없음)');
    return;
  }

  let linkedCount = 0;
  for (const sub of substitutes) {
    // 한글 이름에서 원래 공휴일 추출: "대체공휴일(삼일절)" → "삼일절"
    const match = (sub.name_local || sub.name || '').match(/대체공휴일\(([^)]+)\)/);
    let originalKoreanName = match ? match[1] : null;

    // 만약 name_local에 "대체공휴일"만 있으면 name으로 찾기 (예: "Substitute Holiday (Chuseok)")
    if (!originalKoreanName && sub.name) {
      const engMatch = sub.name.match(/\(([^)]+)\)/);
      if (engMatch) {
        // 영어 → 한글 역매핑
        const foundKo = Object.entries(KOREAN_TO_ENGLISH)
          .find(([ko, en]) => en === engMatch[1])?.[0];
        if (foundKo) originalKoreanName = foundKo;
      }
    }

    if (!originalKoreanName) continue;

    const { data: originals } = await supabase
      .from('holidays').select('id, date, name_local')
      .eq('country_id', country.id)
      .eq('year', sub.year)
      .eq('name_local', originalKoreanName)
      .eq('is_substitute', false);

    if (originals && originals.length > 0) {
      const target = originals.sort((a, b) =>
        Math.abs(new Date(a.date) - new Date(sub.date)) - Math.abs(new Date(b.date) - new Date(sub.date))
      )[0];

      const { error } = await supabase
        .from('holidays').update({ substitute_for_id: target.id }).eq('id', sub.id);

      if (!error) linkedCount++;
    }
  }
  console.log(`   ✅ ${linkedCount}개 대체공휴일 연결 완료`);
}

async function verify() {
  console.log('\n━'.repeat(70));
  console.log('5️⃣  변경 결과 검증');
  console.log('━'.repeat(70));

  const { data: country } = await supabase
    .from('countries').select('id').eq('code', KOREA_COUNTRY_CODE).single();

  const { data: holidays } = await supabase
    .from('holidays').select('date, name, name_local, holiday_category, is_substitute, data_source, data_verified')
    .eq('country_id', country.id)
    .in('year', TARGET_YEARS)
    .order('date');

  const verifiedCount = holidays.filter(h => h.data_verified).length;
  const koreaOfficialCount = holidays.filter(h => h.data_source === 'korea_official').length;
  const substituteCount = holidays.filter(h => h.is_substitute).length;
  const eveCount = holidays.filter(h => h.holiday_category === 'eve').length;
  const dayAfterCount = holidays.filter(h => h.holiday_category === 'day_after').length;
  const tempCount = holidays.filter(h => h.holiday_category === 'temporary').length;

  console.log(`\n✅ 한국 공휴일 (${TARGET_YEARS.join(', ')}) 총 ${holidays.length}개`);
  console.log(`   - 정부 공식 검증: ${verifiedCount}개`);
  console.log(`   - data_source='korea_official': ${koreaOfficialCount}개`);
  console.log(`   - 대체공휴일: ${substituteCount}개`);
  console.log(`   - 명절 전날(eve): ${eveCount}개`);
  console.log(`   - 명절 다음날(day_after): ${dayAfterCount}개`);
  console.log(`   - 임시공휴일(temporary): ${tempCount}개`);
}

// ========== 메인 ==========
async function main() {
  console.log('\n🇰🇷 한국 공휴일 데이터 갱신 v2 (정부 공식 데이터로)');
  console.log(`📅 대상 연도: ${TARGET_YEARS.join(', ')}`);
  console.log(`🔧 모드: ${APPLY_MODE ? '⚠️  실제 적용 (--apply)' : '🔍 Dry-run (미리보기만)'}\n`);

  if (!API_KEY) {
    console.error('❌ KOREA_HOLIDAY_API_KEY가 .env.local에 없습니다.');
    process.exit(1);
  }

  try {
    const officialList = await buildOfficialDataset();
    const { country, dbHolidays } = await fetchExistingDB();
    const plan = planChanges(officialList, dbHolidays, country);
    printPlan(plan);

    if (!APPLY_MODE) {
      console.log('\n💡 위 변경사항으로 진행하시려면:');
      console.log('   node scripts/apply-korea-holidays.js --apply');
      console.log('\n⚠️  Dry-run 모드 - 실제 DB 변경 없음.');
      return;
    }

    console.log('\n⚠️  실제 DB 변경을 시작합니다...\n');
    backupExisting(dbHolidays);
    const result = await applyChanges(plan);

    if (result.errorCount > 0) {
      console.log(`\n⚠️  에러 ${result.errorCount}개 발생. 백업 파일로 복구 가능.`);
    }

    await verify();
    console.log('\n✅ 갱신 완료!\n');
  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();