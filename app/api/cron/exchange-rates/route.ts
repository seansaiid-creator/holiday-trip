import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=USD';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(FRANKFURTER_URL, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Frankfurter returned ${res.status}`);
    }

    const data = await res.json();

    if (!data.rates || typeof data.rates !== 'object') {
      throw new Error('Unexpected Frankfurter response format');
    }

    const fetchedAt = new Date().toISOString();
    const rows = Object.entries(data.rates as Record<string, number>).map(
      ([currency, rate]) => ({
        base_currency: 'USD',
        target_currency: currency,
        rate,
        fetched_at: fetchedAt,
        source: 'frankfurter',
      })
    );

    const { error } = await supabase
      .from('exchange_rates')
      .upsert(rows, { onConflict: 'base_currency,target_currency' });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      updated: rows.length,
      base: 'USD',
      fetched_at: fetchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/exchange-rates]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}