require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.KOREA_HOLIDAY_API_KEY;
const BASE_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

async function fetchAPI(endpoint, year) {
  // 한 번에 30개까지만 받으니 numOfRows를 100으로
  const url = `${BASE_URL}/${endpoint}?ServiceKey=${encodeURIComponent(API_KEY)}&solYear=${year}&numOfRows=100&_type=json`;
  const response = await fetch(url);
  const data = await response.json();
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

async function compare() {
  const year = 2026;
  console.log(`🇰🇷 ${year}년 두 API 비교\n`);

  console.log('1️⃣  getHoliDeInfo (공휴일정보) 호출 중...');
  const holidays = await fetchAPI('getHoliDeInfo', year);
  console.log(`   → ${holidays.length}개 발견\n`);

  console.log('2️⃣  getRestDeInfo (국경일+공휴일) 호출 중...');
  const restDays = await fetchAPI('getRestDeInfo', year);
  console.log(`   → ${restDays.length}개 발견\n`);

  // 정렬
  holidays.sort((a, b) => a.locdate - b.locdate);
  restDays.sort((a, b) => a.locdate - b.locdate);

  console.log('━'.repeat(60));
  console.log('📋 getHoliDeInfo 결과 (공휴일만):');
  console.log('━'.repeat(60));
  holidays.forEach(h => {
    console.log(`  ${h.locdate} - ${h.dateName.padEnd(15)} (isHoliday=${h.isHoliday})`);
  });

  console.log('\n━'.repeat(60));
  console.log('📋 getRestDeInfo 결과 (국경일+공휴일):');
  console.log('━'.repeat(60));
  restDays.forEach(h => {
    console.log(`  ${h.locdate} - ${h.dateName.padEnd(15)} (isHoliday=${h.isHoliday})`);
  });

  // 차이점 찾기
  const holidayDates = new Set(holidays.map(h => h.locdate));
  const restDayDates = new Set(restDays.map(h => h.locdate));

  const onlyInRest = restDays.filter(h => !holidayDates.has(h.locdate));
  const onlyInHoliday = holidays.filter(h => !restDayDates.has(h.locdate));

  console.log('\n━'.repeat(60));
  console.log('🔍 차이점 분석:');
  console.log('━'.repeat(60));
  
  if (onlyInRest.length > 0) {
    console.log('\n📌 getRestDeInfo에만 있고 getHoliDeInfo에는 없는 항목:');
    onlyInRest.forEach(h => console.log(`  ${h.locdate} - ${h.dateName} (isHoliday=${h.isHoliday})`));
  }

  if (onlyInHoliday.length > 0) {
    console.log('\n📌 getHoliDeInfo에만 있고 getRestDeInfo에는 없는 항목:');
    onlyInHoliday.forEach(h => console.log(`  ${h.locdate} - ${h.dateName} (isHoliday=${h.isHoliday})`));
  }

  if (onlyInRest.length === 0 && onlyInHoliday.length === 0) {
    console.log('\n✅ 두 API 결과 동일! 완전히 같은 데이터.');
  }

  console.log('\n━'.repeat(60));
  console.log('💡 결론:');
  console.log(`  - 공휴일만: ${holidays.length}개`);
  console.log(`  - 국경일+공휴일: ${restDays.length}개`);
  console.log(`  - 차이: ${restDays.length - holidays.length}개`);
}

compare();