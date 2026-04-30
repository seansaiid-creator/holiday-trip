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
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MOFA_API_KEY  = process.env.MOFA_API_KEY!;
const GEMINI_KEY    = process.env.GEMINI_API_KEY!;
const MOFA_BASE_URL = 'http://apis.data.go.kr/1262000/TravelAlarmService2/getTravelAlarmList2';

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Translate Korean regional advisory text to concise English.
// Returns null if input is null/empty.
async function translateRemark(ko: string | null | undefined): Promise<string | null> {
  if (!ko || ko.trim() === '') return null;
  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Translate this Korean travel advisory regional description to concise English. Keep place names. Output only the English translation, no explanation:\n\n${ko}` }],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
    });
    const text = result.response.text().trim();
    return text || null;
  } catch {
    // If translation fails, return null rather than crashing the whole job
    return null;
  }
}

// API returns country_iso_alp2 directly — no mapping needed

const LEVEL_NAMES_KO: Record<number, string> = {
  0: 'No Advisory',
  1: '여행유의',
  2: '여행자제',
  3: '출국권고',
  4: '여행금지',
};

type MofaItem = {
  country_nm?: string;
  country_iso_alp2?: string;
  alarm_lvl?: string | number;
  remark?: string;
  written_dt?: string | null;
  country_eng_nm?: string;
};

async function fetchAllAdvisories(): Promise<MofaItem[]> {
  const items: MofaItem[] = [];
  let pageNo = 1;
  const numOfRows = 100;

  while (true) {
    const url = `${MOFA_BASE_URL}?serviceKey=${MOFA_API_KEY}&returnType=JSON&numOfRows=${numOfRows}&pageNo=${pageNo}`;
    const res = await fetch(url);
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
      // Use ISO code directly from API (country_iso_alp2)
      const isoCode = item.country_iso_alp2?.toUpperCase();

      if (!isoCode) {
        skipped.push(item.country_nm);
        continue;
      }

      const level = parseInt(String(item.alarm_lvl || '0'), 10);

      // Translate Korean regional description to English (only if remark exists)
      const remarkEn = await translateRemark(item.remark);

      rows.push({
        country_code:    isoCode,
        country_name_ko: item.country_nm || null,
        country_name_en: item.country_eng_nm || null,
        alarm_level:     level,
        alarm_level_name: LEVEL_NAMES_KO[level] || '경보없음',
        alarm_message:   remarkEn,
        issued_at:       item.written_dt || null,
        source:          'Korean Ministry of Foreign Affairs (0404.go.kr)',
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
        country_name_ko: null,
        alarm_level:     0,
        alarm_level_name: 'No Advisory',
        alarm_message:   null,
        issued_at:       null,
        source:          'Korean Ministry of Foreign Affairs (0404.go.kr)',
        fetched_at:      now,
        updated_at:      now,
      }));

    const allRows = [...rows, ...defaultRows];

    // Deduplicate by country_code — keep the row with the highest alarm_level
    // (some countries have multiple entries for different regions)
    const deduped = Object.values(
      allRows.reduce((acc, row) => {
        const existing = acc[row.country_code];
        if (!existing || row.alarm_level > existing.alarm_level) {
          acc[row.country_code] = row;
        }
        return acc;
      }, {} as Record<string, typeof allRows[0]>)
    );

    const { error } = await supabase
      .from('travel_advisories')
      .upsert(deduped, { onConflict: 'country_code' });

    if (error) {
      console.error('[cron/travel-advisories] Supabase error:', JSON.stringify(error));
      throw new Error(JSON.stringify(error));
    }

    return NextResponse.json({
      ok: true,
      fetched: items.length,
      upserted: deduped.length,
      with_advisory: rows.length,
      no_advisory: defaultRows.length,
      skipped: skipped.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[cron/travel-advisories]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
