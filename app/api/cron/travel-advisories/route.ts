/**
 * app/api/cron/travel-advisories/route.ts
 *
 * Vercel Cron job — runs daily at 07:00 UTC.
 * Fetches travel advisories from Korean Ministry of Foreign Affairs (외교부)
 * Public Data Portal API, then upserts into Supabase travel_advisories table.
 *
 * Source: 외교부 해외안전여행 (https://0404.go.kr)
 * API: 공공데이터포털 - 외교부_국가·지역별 여행경보
 *
 * Travel advisory levels:
 *   0 = 경보없음 (No advisory)
 *   1 = 여행유의 (Exercise caution)
 *   2 = 여행자제 (Restrict travel)
 *   3 = 출국권고 (Advise departure)
 *   4 = 여행금지 (Do not travel)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MOFA_API_KEY = process.env.MOFA_API_KEY!;
const MOFA_BASE_URL = 'http://apis.data.go.kr/1262000/TravelAlarmService2/getTravelAlarmList2';

// Korean MOFA uses its own country codes — map to ISO 2-letter codes
// Only countries in our DB are included
const COUNTRY_ISO_MAP: Record<string, string> = {
  '일본': 'JP', '한국': 'KR', '미국': 'US', '태국': 'TH', '베트남': 'VN',
  '싱가포르': 'SG', '홍콩': 'HK', '대만': 'TW', '중국': 'CN', '인도': 'IN',
  '인도네시아': 'ID', '말레이시아': 'MY', '필리핀': 'PH', '호주': 'AU',
  '뉴질랜드': 'NZ', '영국': 'GB', '프랑스': 'FR', '독일': 'DE', '이탈리아': 'IT',
  '스페인': 'ES', '포르투갈': 'PT', '네덜란드': 'NL', '벨기에': 'BE',
  '스위스': 'CH', '오스트리아': 'AT', '스웨덴': 'SE', '노르웨이': 'NO',
  '덴마크': 'DK', '핀란드': 'FI', '그리스': 'GR', '폴란드': 'PL',
  '체코': 'CZ', '헝가리': 'HU', '아이슬란드': 'IS', '아일랜드': 'IE',
  '캐나다': 'CA', '멕시코': 'MX', '브라질': 'BR', '아르헨티나': 'AR',
  '칠레': 'CL', '콜롬비아': 'CO', '페루': 'PE', '남아프리카공화국': 'ZA',
  '이집트': 'EG', '모로코': 'MA', '이스라엘': 'IL', '사우디아라비아': 'SA',
  '아랍에미리트': 'AE', '러시아': 'RU', '튀르키예': 'TR', '터키': 'TR',
};

const LEVEL_NAMES: Record<number, string> = {
  0: 'No Advisory',
  1: 'Exercise Caution',
  2: 'Restrict Travel',
  3: 'Advise Departure',
  4: 'Do Not Travel',
};

const LEVEL_NAMES_KO: Record<number, string> = {
  0: '경보없음',
  1: '여행유의',
  2: '여행자제',
  3: '출국권고',
  4: '여행금지',
};

type MofaItem = {
  countryName?: string;
  isoAlpha2?: string;
  alarmLevel?: string | number;
  alarmLevelName?: string;
  alarmMessage?: string;
  writtenDt?: string;
};

async function fetchAllAdvisories(): Promise<MofaItem[]> {
  const items: MofaItem[] = [];
  let pageNo = 1;
  const numOfRows = 100;

  while (true) {
    const url = `${MOFA_BASE_URL}?serviceKey=${MOFA_API_KEY}&returnType=JSON&numOfRows=${numOfRows}&pageNo=${pageNo}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`MOFA API error: ${res.status}`);

    const data = await res.json();
    const body = data?.response?.body;
    const newItems: MofaItem[] = body?.items?.item || [];

    if (!Array.isArray(newItems) || newItems.length === 0) break;
    items.push(...newItems);

    const total = parseInt(body?.totalCount || '0', 10);
    if (items.length >= total) break;
    pageNo++;
  }

  return items;
}

export async function GET(request: Request) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const items = await fetchAllAdvisories();
    const now = new Date().toISOString();
    const rows: {
      country_code: string;
      country_name_ko: string | null;
      country_name_en: string | null;
      alarm_level: number;
      alarm_level_name: string;
      alarm_message: string | null;
      issued_at: string | null;
      source: string;
      fetched_at: string;
      updated_at: string;
    }[] = [];
    const skipped: (string | undefined)[] = [];

    for (const item of items) {
      // Try ISO code from API first, then from our name map
      const isoCode =
        item.isoAlpha2?.toUpperCase() ||
        COUNTRY_ISO_MAP[item.countryName || ''];

      if (!isoCode) {
        skipped.push(item.countryName);
        continue;
      }

      const level = parseInt(String(item.alarmLevel || '0'), 10);

      rows.push({
        country_code:    isoCode,
        country_name_ko: item.countryName || null,
        country_name_en: LEVEL_NAMES[level] ? isoCode : null,
        alarm_level:     level,
        alarm_level_name: LEVEL_NAMES_KO[level] || item.alarmLevelName || '경보없음',
        alarm_message:   item.alarmMessage || null,
        issued_at:       item.writtenDt || null,
        source:          '외교부 해외안전여행 (0404.go.kr)',
        fetched_at:      now,
        updated_at:      now,
      });
    }

    // First: set all countries to level 0 (no advisory) as default
    // Then upsert actual advisories on top
    const { data: countries } = await supabase
      .from('countries')
      .select('code, name');

    const defaultRows = (countries || [])
      .filter((c: { code: string; name: string }) =>
        !rows.find((r) => r.country_code === c.code)
      )
      .map((c: { code: string; name: string }) => ({
        country_code:    c.code,
        country_name_en: c.name,
        alarm_level:     0,
        alarm_level_name: '경보없음',
        alarm_message:   null,
        issued_at:       null,
        source:          '외교부 해외안전여행 (0404.go.kr)',
        fetched_at:      now,
        updated_at:      now,
      }));

    const allRows = [...rows, ...defaultRows];

    const { error } = await supabase
      .from('travel_advisories')
      .upsert(allRows, { onConflict: 'country_code' });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      fetched: items.length,
      upserted: allRows.length,
      with_advisory: rows.length,
      no_advisory: defaultRows.length,
      skipped: skipped.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/travel-advisories]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
