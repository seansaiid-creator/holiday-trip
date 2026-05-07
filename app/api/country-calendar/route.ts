import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || 'US').toUpperCase();

  const { data: country } = await supabase
    .from('countries')
    .select('code, name, currency_code, voltage, plug_types')
    .eq('code', code)
    .maybeSingle();

  if (!country) {
    return NextResponse.json({ error: 'Country not found' }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);

  const { data: holidays } = await supabase
    .from('holidays')
    .select('id, date, name, name_local, holiday_category, is_substitute')
    .eq('country_id', (await supabase.from('countries').select('id').eq('code', code).maybeSingle()).data?.id)
    .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
    .lte('date', nextYear)
    .order('date', { ascending: true });

  return NextResponse.json({ country, holidays: holidays || [] });
}
