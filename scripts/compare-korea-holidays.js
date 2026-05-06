// scripts/compare-korea-holidays.js
// 한국 공휴일: 정부 공식 데이터 vs 기존 DB(Nager.Date) 비교 분석
// 사용법: node scripts/compare-korea-holidays.js
// ⚠️ 이 스크립트는 DB를 변경하지 않습니다. 분석/보고만 합니다.

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

// 제외할 공휴일 (실제로는 공휴일 아님)
const EXCLUDED_NAMES = ['제헌절'];

// ========== Supabase 초기화 ==========
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ========== 유틸 함수 ==========

// "20260925" → "2026-09-25"
function formatDate(yyyymmdd) {
  const s = String(yyyymmdd);
  return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
}

// 정부 API: 특정 연도의 공휴일 가져오기
async function fetchOfficialHolidays(year) {
  const url = `${BASE_URL}/getHoliDeInfo?ServiceKey=${encodeURIComponent(API_KEY)}&solYear=${year}&numOfRows=100&_type=json`;
  const response = await fetch(url);
  const data = await response.json();
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  // 제헌절 등 제외 + isHoliday=Y만
  return list
    .filter(h => h.isHoliday === 'Y')
    .filter(h => !EXCLUDED_NAMES.includes(h.dateName))
    .map(h => ({
      date: formatDate(h.locdate),
      name: h.dateName,
    }));
}

// 음양력 API: 양력 → 음력 변환
async function getLunarDate(solarDate) {
  // solarDate: "2026-09-25" → solYear=2026, solMonth=09, solDay=25
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

// 공휴일 분류 (eve/regular/day_after/substitute)
function classifyHoliday(holiday, lunarInfo, allHolidays) {
  // 대체공휴일 판별 (이름에 "대체공휴일" 포함)
  if (holiday.name.includes('대체공휴일')) {
    return {
      category: 'substitute',
      isSubstitute: true,
      // 어떤 공휴일의 대체인지 추출: "대체공휴일(삼일절)" → "삼일절"
      substituteForName: holiday.name.match(/\(([^)]+)\)/)?.[1] || null,
    };
  }

  // 음력 기반 명절 처리 (설날, 추석)
  if (lunarInfo) {
    // 설날: 음력 1월 1일이면 당일
    if (holiday.name === '설날') {
      if (lunarInfo.lunMonth === 1 && lunarInfo.lunDay === 1) {
        return { category: 'regular', isSubstitute: false }; // 당일
      }
      // 음력 12월 30일 (또는 12월 마지막 날) = 설날 전날
      if (lunarInfo.lunMonth === 12) {
        return { category: 'eve', isSubstitute: false };
      }
      // 음력 1월 2일 = 설날 다음날
      if (lunarInfo.lunMonth === 1 && lunarInfo.lunDay === 2) {
        return { category: 'day_after', isSubstitute: false };
      }
    }

    // 추석: 음력 8월 15일이면 당일
    if (holiday.name === '추석') {
      if (lunarInfo.lunMonth === 8 && lunarInfo.lunDay === 15) {
        return { category: 'regular', isSubstitute: false }; // 당일
      }
      if (lunarInfo.lunMonth === 8 && lunarInfo.lunDay === 14) {
        return { category: 'eve', isSubstitute: false };
      }
      if (lunarInfo.lunMonth === 8 && lunarInfo.lunDay === 16) {
        return { category: 'day_after', isSubstitute: false };
      }
    }
  }

  // 임시공휴일 판별 (선거일 등)
  if (holiday.name.includes('선거')) {
    return { category: 'temporary', isSubstitute: false };
  }

  // 기본: 정규 공휴일
  return { category: 'regular', isSubstitute: false };
}

// 정부 공식 데이터 수집 + 분류
async function buildOfficialDataset() {
  console.log('━'.repeat(70));
  console.log('1️⃣  정부 공식 데이터 수집 시작');
  console.log('━'.repeat(70));

  const all = [];

  for (const year of TARGET_YEARS) {
    console.log(`\n📅 ${year}년 공휴일 수집 중...`);
    const holidays = await fetchOfficialHolidays(year);
    console.log(`   → ${holidays.length}개 발견`);

    for (const h of holidays) {
      // 설날/추석만 음력 변환 (API 호출 절약)
      let lunarInfo = null;
      if (h.name === '설날' || h.name === '추석') {
        process.stdout.write(`   ⏳ ${h.date} (${h.name}) 음력 변환 중...`);
        lunarInfo = await getLunarDate(h.date);
        if (lunarInfo) {
          process.stdout.write(` 음력 ${lunarInfo.lunMonth}/${lunarInfo.lunDay}\n`);
        } else {
          process.stdout.write(` 실패\n`);
        }
        // API 부하 방지
        await new Promise(r => setTimeout(r, 200));
      }

      const classification = classifyHoliday(h, lunarInfo, holidays);
      all.push({
        date: h.date,
        name: h.name,
        year: parseInt(h.date.substring(0, 4)),
        ...classification,
        lunarInfo,
      });
    }
  }

  console.log(`\n✅ 총 ${all.length}개 정부 공식 공휴일 수집 완료`);
  return all;
}

// 기존 DB 데이터 조회
async function fetchExistingDB() {
  console.log('\n━'.repeat(70));
  console.log('2️⃣  기존 DB(Nager.Date) 데이터 조회');
  console.log('━'.repeat(70));

  const { data: country } = await supabase
    .from('countries')
    .select('id, code, name')
    .eq('code', KOREA_COUNTRY_CODE)
    .single();

  if (!country) throw new Error('한국 country 데이터 없음');

  const { data: holidays } = await supabase
    .from('holidays')
    .select('id, date, name, name_local, type, year, holiday_category, is_substitute, data_source')
    .eq('country_id', country.id)
    .in('year', TARGET_YEARS)
    .order('date');

  console.log(`✅ 기존 DB에서 ${holidays.length}개 공휴일 조회 완료`);
  return { country, dbHolidays: holidays };
}

// 비교 분석
function analyzeDiff(officialList, dbList) {
  console.log('\n━'.repeat(70));
  console.log('3️⃣  비교 분석 시작');
  console.log('━'.repeat(70));

  const officialByDate = new Map(officialList.map(h => [h.date, h]));
  const dbByDate = new Map(dbList.map(h => [h.date, h]));

  // 케이스 1: 정부에 있는데 DB에 없음 → 추가 필요
  const toAdd = [];
  for (const o of officialList) {
    if (!dbByDate.has(o.date)) {
      toAdd.push(o);
    }
  }

  // 케이스 2: DB에 있는데 정부에 없음 → 제거 필요
  const toRemove = [];
  for (const d of dbList) {
    if (!officialByDate.has(d.date)) {
      toRemove.push(d);
    }
  }

  // 케이스 3: 둘 다 있는데 분류 정보 보강 필요
  const toEnhance = [];
  for (const o of officialList) {
    const d = dbByDate.get(o.date);
    if (!d) continue;

    const needsUpdate =
      d.holiday_category !== o.category ||
      d.is_substitute !== o.isSubstitute ||
      d.data_source !== 'korea_official';

    if (needsUpdate) {
      toEnhance.push({
        dbId: d.id,
        date: o.date,
        currentName: d.name,
        officialName: o.name,
        currentCategory: d.holiday_category,
        newCategory: o.category,
        currentIsSubstitute: d.is_substitute,
        newIsSubstitute: o.isSubstitute,
        substituteForName: o.substituteForName || null,
      });
    }
  }

  return { toAdd, toRemove, toEnhance };
}

// 결과 출력
function printReport(diff, country) {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('📊 비교 분석 결과 보고서');
  console.log('═'.repeat(70));

  // ━━━ 추가 필요 ━━━
  console.log(`\n🟢 [추가 필요] 정부 공식에 있지만 DB에 없음: ${diff.toAdd.length}개`);
  if (diff.toAdd.length > 0) {
    console.log('─'.repeat(70));
    diff.toAdd.forEach(h => {
      const cat = h.category.padEnd(10);
      const sub = h.isSubstitute ? ' [대체공휴일]' : '';
      console.log(`  ${h.date}  ${cat}  ${h.name}${sub}`);
    });
  }

  // ━━━ 제거 필요 ━━━
  console.log(`\n🔴 [제거 필요] DB에 있지만 정부 공식에 없음: ${diff.toRemove.length}개`);
  if (diff.toRemove.length > 0) {
    console.log('─'.repeat(70));
    diff.toRemove.forEach(h => {
      console.log(`  ${h.date}  ${h.name}  (DB id=${h.id})`);
    });
    console.log('  ⚠️  주의: 이 공휴일들이 travel_tips 등 다른 테이블에서 참조되고 있을 수 있음');
  }

  // ━━━ 보강 필요 ━━━
  console.log(`\n🟡 [보강 필요] 분류 정보가 다른 항목: ${diff.toEnhance.length}개`);
  if (diff.toEnhance.length > 0) {
    console.log('─'.repeat(70));
    diff.toEnhance.forEach(h => {
      const before = `${h.currentCategory || '없음'} / sub=${h.currentIsSubstitute || false}`;
      const after = `${h.newCategory} / sub=${h.newIsSubstitute}`;
      console.log(`  ${h.date}  ${h.officialName}`);
      console.log(`     변경: ${before}  →  ${after}`);
      if (h.substituteForName) {
        console.log(`     대체대상: ${h.substituteForName}`);
      }
    });
  }

  // ━━━ 요약 ━━━
  console.log('\n' + '═'.repeat(70));
  console.log('📈 요약');
  console.log('═'.repeat(70));
  console.log(`  추가 필요: ${diff.toAdd.length}개`);
  console.log(`  제거 필요: ${diff.toRemove.length}개`);
  console.log(`  보강 필요: ${diff.toEnhance.length}개`);
  console.log(`  변경 총합: ${diff.toAdd.length + diff.toRemove.length + diff.toEnhance.length}개`);

  if (diff.toAdd.length + diff.toRemove.length + diff.toEnhance.length === 0) {
    console.log('\n✅ DB가 이미 정부 공식 데이터와 일치합니다!');
  } else {
    console.log('\n⚠️  DB 변경이 필요합니다. 결과를 검토 후 다음 스크립트(apply-korea-holidays.js)로 적용하세요.');
  }
}

// JSON 파일 저장
function saveReport(diff, officialList) {
  const outDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'korea-holidays-diff.json');
  const report = {
    generated_at: new Date().toISOString(),
    target_years: TARGET_YEARS,
    summary: {
      official_total: officialList.length,
      to_add: diff.toAdd.length,
      to_remove: diff.toRemove.length,
      to_enhance: diff.toEnhance.length,
    },
    official_data: officialList,
    diff,
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 상세 보고서 저장: ${outPath}`);
}

// ========== 메인 함수 ==========
async function main() {
  console.log('\n🇰🇷 한국 공휴일 데이터 비교 분석 시작');
  console.log(`대상 연도: ${TARGET_YEARS.join(', ')}`);
  console.log(`⚠️  이 스크립트는 DB를 변경하지 않습니다. 분석만 수행합니다.\n`);

  if (!API_KEY) {
    console.error('❌ KOREA_HOLIDAY_API_KEY가 .env.local에 없습니다.');
    process.exit(1);
  }

  try {
    const officialList = await buildOfficialDataset();
    const { country, dbHolidays } = await fetchExistingDB();
    const diff = analyzeDiff(officialList, dbHolidays);
    printReport(diff, country);
    saveReport(diff, officialList);

    console.log('\n✅ 분석 완료\n');
  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
