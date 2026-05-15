require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.KOREA_HOLIDAY_API_KEY;
const BASE_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

async function testKoreaHolidayAPI() {
  console.log('🇰🇷 한국천문연구원 특일 정보 API 테스트\n');

  if (!API_KEY) {
    console.error('❌ KOREA_HOLIDAY_API_KEY가 .env.local에 없습니다.');
    process.exit(1);
  }

  console.log(`✓ API 키 로드 완료 (${API_KEY.length}자)\n`);

  // 2026년 9월 공휴일 조회 (추석 포함된 달)
  const year = 2026;
  const month = '09';

  const url = `${BASE_URL}/getRestDeInfo?ServiceKey=${encodeURIComponent(API_KEY)}&solYear=${year}&solMonth=${month}&_type=json`;

  console.log(`📍 요청: ${year}년 ${month}월 공휴일\n`);

  try {
    const response = await fetch(url);
    const text = await response.text();

    console.log('📦 원본 응답 (처음 500자):');
    console.log(text.substring(0, 500));
    console.log('\n---\n');

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ JSON 파싱 실패. 응답이 XML일 가능성:');
      console.error(text.substring(0, 1000));
      return;
    }

    // 응답 구조 확인
    console.log('📊 파싱된 응답 구조:');
    console.log(JSON.stringify(data, null, 2));

    // 공휴일 추출
    const items = data?.response?.body?.items?.item;
    if (items) {
      const holidays = Array.isArray(items) ? items : [items];
      console.log(`\n✅ ${holidays.length}개 공휴일 발견:\n`);
      holidays.forEach((h, i) => {
        console.log(`${i + 1}. ${h.locdate} - ${h.dateName} (${h.isHoliday === 'Y' ? '공휴일' : '비공휴일'})`);
      });
    }

  } catch (error) {
    console.error('❌ 에러:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('→ 네트워크 연결 확인 필요');
    }
  }
}

testKoreaHolidayAPI();