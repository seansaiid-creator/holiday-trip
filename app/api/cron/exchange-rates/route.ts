/**
 * app/api/cron/exchange-rates/route.ts
 *
 * Vercel Cron job — runs daily at 06:00 UTC.
 * Fetches all exchange rates from Frankfurter (ECB data, base=USD),
 * then upserts into Supabase exchange_rates table.
 *
 * Frankfurter API: https://www.frankfurter.app/docs
 * - No API key required
 * - Data sourced from European Central Bank
 * - Updated every business day ~16:00 CET
 *
 * Security: Vercel automatically sends CRON_SECRET in Authorization header.
 * We verify it to prevent unauthorized calls.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=USD';

export async function GET(request: Request) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch from Frankfurter
    const res = await fetch(FRANKFURTER_URL, {
      next: { revalidate: 0 }, // always fresh
    });

    if (!res.ok) {
      throw new Error(`Frankfurter returned ${res.status}`);
    }

    const data = await res.json();

    // data.rates = { "AED": 3.6725, "ARS": 123.45, ... "KRW": 1384.5, ... }
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

    // Upsert — one row per currency pair, always overwrite
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
