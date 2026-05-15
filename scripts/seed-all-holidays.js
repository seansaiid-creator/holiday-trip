require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const YEARS = [2025, 2026, 2027];

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

async function seedAllHolidays() {
  console.log('Starting to seed holidays for all countries...\n');

  // 기존 데이터가 없는 국가만 처리
  const { data: countries } = await supabase
    .from('countries')
    .select('id, code, name')
    .eq('is_active', true);

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const country of countries) {
    // 이미 데이터가 있는지 확인
    const { data: existing } = await supabase
      .from('holidays')
      .select('id')
      .eq('country_id', country.id)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`○ ${country.code} already has holidays, skipping`);
      totalSkipped++;
      continue;
    }

    let countryAdded = 0;
    for (const year of YEARS) {
      const holidays = await fetchHolidaysFromAPI(country.code, year);

      if (holidays.length === 0) {
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
      if (!error) {
        countryAdded += records.length;
      }
    }

    if (countryAdded > 0) {
      console.log(`✓ ${country.code} (${country.name}): ${countryAdded} holidays`);
      totalAdded += countryAdded;
    } else {
      console.log(`✗ ${country.code} (${country.name}): No data available`);
    }
  }

  console.log(`\nDone! Total added: ${totalAdded}, Skipped (already had data): ${totalSkipped}`);
}

seedAllHolidays();