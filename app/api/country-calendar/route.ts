import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || 'US').toUpperCase();

  // 1. 국가 정보
  const { data: country } = await supabase
    .from('countries')
    .select('id, code, name, currency_code, voltage, plug_types')
    .eq('code', code)
    .maybeSingle();

  if (!country) {
    return NextResponse.json({ error: 'Country not found' }, { status: 404 });
  }

  const countryId = country.id;

  // 2. 공휴일 (이번 달부터 1년치)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);

  const { data: holidays } = await supabase
    .from('holidays')
    .select('id, date, name, name_local, holiday_category, is_substitute')
    .eq('country_id', countryId)
    .gte('date', startOfMonth)
    .lte('date', nextYear)
    .order('date', { ascending: true });

  // 3. Travel Tips (DB에서 해당 국가 것 전부 가져오기)
  const { data: tips } = await supabase
    .from('travel_tips')
    .select('holiday_id, what_is_it, traveler_impact, cautions, recommendations, practical_tips, tips, source_urls')
    .eq('country_id', countryId)
    .eq('moderation_status', 'approved');

  // country에서 id 제거 후 반환 (불필요한 내부 정보 노출 방지)
  const { id: _id, ...countryWithoutId } = country;

  return NextResponse.json({
    country: countryWithoutId,
    holidays: holidays || [],
    tips: tips || [],
  });
}
