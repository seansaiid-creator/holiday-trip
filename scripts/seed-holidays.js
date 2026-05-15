const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Nager.Date API에서 지원하는 국가
const NAGER_COUNTRIES = ['KR', 'JP', 'US', 'FR'];
const YEARS = [2025, 2026, 2027];

// Thailand는 수동 데이터 (Nager.Date 미지원)
const THAILAND_HOLIDAYS = {
  2025: [
    { date: '2025-01-01', name: "New Year's Day", localName: 'วันขึ้นปีใหม่' },
    { date: '2025-02-12', name: 'Makha Bucha Day', localName: 'วันมาฆบูชา' },
    { date: '2025-04-06', name: 'Chakri Memorial Day', localName: 'วันจักรี' },
    { date: '2025-04-13', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2025-04-14', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2025-04-15', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2025-05-01', name: 'Labour Day', localName: 'วันแรงงาน' },
    { date: '2025-05-05', name: 'Coronation Day', localName: 'วันฉัตรมงคล' },
    { date: '2025-05-12', name: 'Visakha Bucha Day', localName: 'วันวิสาขบูชา' },
    { date: '2025-06-03', name: "Queen Suthida's Birthday", localName: 'วันเฉลิมพระชนมพรรษาพระราชินี' },
    { date: '2025-07-10', name: 'Asalha Bucha Day', localName: 'วันอาสาฬหบูชา' },
    { date: '2025-07-28', name: "King Vajiralongkorn's Birthday", localName: 'วันเฉลิมพระชนมพรรษา' },
    { date: '2025-08-12', name: "Queen Mother's Birthday", localName: 'วันแม่แห่งชาติ' },
    { date: '2025-10-13', name: "King Bhumibol Memorial Day", localName: 'วันคล้ายวันสวรรคต' },
    { date: '2025-10-23', name: 'Chulalongkorn Day', localName: 'วันปิยมหาราช' },
    { date: '2025-12-05', name: "King Bhumibol's Birthday", localName: 'วันพ่อแห่งชาติ' },
    { date: '2025-12-10', name: 'Constitution Day', localName: 'วันรัฐธรรมนูญ' },
    { date: '2025-12-31', name: "New Year's Eve", localName: 'วันสิ้นปี' }
  ],
  2026: [
    { date: '2026-01-01', name: "New Year's Day", localName: 'วันขึ้นปีใหม่' },
    { date: '2026-03-03', name: 'Makha Bucha Day', localName: 'วันมาฆบูชา' },
    { date: '2026-04-06', name: 'Chakri Memorial Day', localName: 'วันจักรี' },
    { date: '2026-04-13', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2026-04-14', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2026-04-15', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2026-05-01', name: 'Labour Day', localName: 'วันแรงงาน' },
    { date: '2026-05-05', name: 'Coronation Day', localName: 'วันฉัตรมงคล' },
    { date: '2026-05-31', name: 'Visakha Bucha Day', localName: 'วันวิสาขบูชา' },
    { date: '2026-06-03', name: "Queen Suthida's Birthday", localName: 'วันเฉลิมพระชนมพรรษาพระราชินี' },
    { date: '2026-07-29', name: 'Asalha Bucha Day', localName: 'วันอาสาฬหบูชา' },
    { date: '2026-07-28', name: "King Vajiralongkorn's Birthday", localName: 'วันเฉลิมพระชนมพรรษา' },
    { date: '2026-08-12', name: "Queen Mother's Birthday", localName: 'วันแม่แห่งชาติ' },
    { date: '2026-10-13', name: "King Bhumibol Memorial Day", localName: 'วันคล้ายวันสวรรคต' },
    { date: '2026-10-23', name: 'Chulalongkorn Day', localName: 'วันปิยมหาราช' },
    { date: '2026-12-05', name: "King Bhumibol's Birthday", localName: 'วันพ่อแห่งชาติ' },
    { date: '2026-12-10', name: 'Constitution Day', localName: 'วันรัฐธรรมนูญ' },
    { date: '2026-12-31', name: "New Year's Eve", localName: 'วันสิ้นปี' }
  ],
  2027: [
    { date: '2027-01-01', name: "New Year's Day", localName: 'วันขึ้นปีใหม่' },
    { date: '2027-02-20', name: 'Makha Bucha Day', localName: 'วันมาฆบูชา' },
    { date: '2027-04-06', name: 'Chakri Memorial Day', localName: 'วันจักรี' },
    { date: '2027-04-13', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2027-04-14', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2027-04-15', name: 'Songkran Festival', localName: 'วันสงกรานต์' },
    { date: '2027-05-01', name: 'Labour Day', localName: 'วันแรงงาน' },
    { date: '2027-05-05', name: 'Coronation Day', localName: 'วันฉัตรมงคล' },
    { date: '2027-05-20', name: 'Visakha Bucha Day', localName: 'วันวิสาขบูชา' },
    { date: '2027-06-03', name: "Queen Suthida's Birthday", localName: 'วันเฉลิมพระชนมพรรษาพระราชินี' },
    { date: '2027-07-19', name: 'Asalha Bucha Day', localName: 'วันอาสาฬหบูชา' },
    { date: '2027-07-28', name: "King Vajiralongkorn's Birthday", localName: 'วันเฉลิมพระชนมพรรษา' },
    { date: '2027-08-12', name: "Queen Mother's Birthday", localName: 'วันแม่แห่งชาติ' },
    { date: '2027-10-13', name: "King Bhumibol Memorial Day", localName: 'วันคล้ายวันสวรรคต' },
    { date: '2027-10-23', name: 'Chulalongkorn Day', localName: 'วันปิยมหาราช' },
    { date: '2027-12-06', name: "King Bhumibol's Birthday", localName: 'วันพ่อแห่งชาติ' },
    { date: '2027-12-10', name: 'Constitution Day', localName: 'วันรัฐธรรมนูญ' },
    { date: '2027-12-31', name: "New Year's Eve", localName: 'วันสิ้นปี' }
  ]
};

async function fetchHolidaysFromAPI(countryCode, year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map(h => ({
      date: h.date,
      name: h.name,
      localName: h.localName,
      type: h.types?.[0] || 'Public'
    }));
  } catch (e) {
    return [];
  }
}

async function seedHolidays() {
  console.log('Starting holiday seed...\n');

  // 먼저 기존 데이터 삭제 (중복 방지)
  console.log('Clearing existing holidays...');
  await supabase.from('holidays').delete().neq('id', 0);

  // 모든 국가 조회
  const { data: countries } = await supabase.from('countries').select('id, code');

  for (const country of countries) {
    for (const year of YEARS) {
      let holidays = [];

      if (country.code === 'TH') {
        holidays = THAILAND_HOLIDAYS[year].map(h => ({ ...h, type: 'Public' }));
      } else {
        holidays = await fetchHolidaysFromAPI(country.code, year);
      }

      if (holidays.length === 0) {
        console.log(`✗ No data for ${country.code} ${year}`);
        continue;
      }

      const records = holidays.map(h => ({
        country_id: country.id,
        date: h.date,
        name: h.name,
        name_local: h.localName,
        type: h.type || 'Public',
        is_public: true,
        year: year
      }));

      const { error } = await supabase.from('holidays').insert(records);
      if (error) {
        console.error(`✗ ${country.code} ${year}: ${error.message}`);
      } else {
        console.log(`✓ ${country.code} ${year}: ${records.length} holidays`);
      }
    }
  }

  console.log('\nDone!');
}

seedHolidays();