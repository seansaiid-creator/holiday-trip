import React from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CountryHolidayView from './CountryHolidayView';

export const revalidate = 3600;

type Country = {
  id: number;
  code: string;
  name: string;
  name_local: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  voltage: string | null;
  plug_types: string | null;
  timezone: string | null;
  emoji_flag: string | null;
  description: string | null;
};

type Holiday = {
  id: number;
  country_id: number;
  date: string;
  name: string;
  name_local: string | null;
  type: string | null;
  is_public: boolean | null;
  year: number;
  holiday_category: string | null;
  is_substitute: boolean | null;
  substitute_for_id: number | null;
  substitute_reason: string | null;
  related_holiday_id: number | null;
  note: string | null;
  data_source: string | null;
  verification_status: string | null;
  verification_sources: { db?: boolean; wikipedia?: boolean; nager?: boolean } | null;
  verification_note: string | null;
  manual_locked: boolean | null;
  verified_at: string | null;
};

type TravelTip = {
  id: number;
  country_id: number;
  holiday_id: number;
  title: string | null;
  what_is_it: string | null;
  traveler_impact: string | null;
  cautions: string | null;
  recommendations: string | null;
  tips: string | null;
  practical_tips: string | null;
  source_urls: string[] | null;
  language: string | null;
  ai_model: string | null;
  moderation_status: string | null;
};

type ExchangeRate = {
  rate: number;
  fetched_at: string;
};

type PriceItem = {
  id: number;
  key: string;
  category: string;
  name_en: string;
  sort_order: number;
};

type CountryPrice = {
  id: number;
  price_item_id: number | null;
  price_usd_min: number | null;
  price_usd_max: number | null;
  price_local_min: number | null;
  price_local_max: number | null;
  currency_code: string | null;
  local_brand: string | null;
  transport_tips: string | null;
  notes: string | null;
};

type TravelAdvisory = {
  alarm_level: number;
  alarm_level_name: string;
  alarm_message: string | null;
  issued_at: string | null;
  source: string;
};

// Country metadata: ISO codes, calling codes, and capital city for time display.
// Add a row here when you onboard a new country page.
type CountryMeta = {
  iso2: string;       // e.g., "KR"
  iso3: string;       // e.g., "KOR"
  callingCode: string; // e.g., "+82"
  capital: string;    // e.g., "Seoul" — used for "Current time in {capital}" line
  singleTimezone: boolean; // true if all regions share one timezone
};

const COUNTRY_META: Record<string, CountryMeta> = {
  KR: { iso2: 'KR', iso3: 'KOR', callingCode: '+82', capital: 'Seoul', singleTimezone: true },
  JP: { iso2: 'JP', iso3: 'JPN', callingCode: '+81', capital: 'Tokyo', singleTimezone: true },
  US: { iso2: 'US', iso3: 'USA', callingCode: '+1', capital: 'Washington, D.C.', singleTimezone: false },
  TH: { iso2: 'TH', iso3: 'THA', callingCode: '+66', capital: 'Bangkok', singleTimezone: true },
  FR: { iso2: 'FR', iso3: 'FRA', callingCode: '+33', capital: 'Paris', singleTimezone: false },
  GB: { iso2: 'GB', iso3: 'GBR', callingCode: '+44', capital: 'London', singleTimezone: true },
  DE: { iso2: 'DE', iso3: 'DEU', callingCode: '+49', capital: 'Berlin', singleTimezone: true },
  CN: { iso2: 'CN', iso3: 'CHN', callingCode: '+86', capital: 'Beijing', singleTimezone: true },
  IT: { iso2: 'IT', iso3: 'ITA', callingCode: '+39', capital: 'Rome', singleTimezone: true },
  ES: { iso2: 'ES', iso3: 'ESP', callingCode: '+34', capital: 'Madrid', singleTimezone: false },
  CA: { iso2: 'CA', iso3: 'CAN', callingCode: '+1', capital: 'Ottawa', singleTimezone: false },
  AU: { iso2: 'AU', iso3: 'AUS', callingCode: '+61', capital: 'Canberra', singleTimezone: false },
  VN: { iso2: 'VN', iso3: 'VNM', callingCode: '+84', capital: 'Hanoi', singleTimezone: true },
  SG: { iso2: 'SG', iso3: 'SGP', callingCode: '+65', capital: 'Singapore', singleTimezone: true },
  IN: { iso2: 'IN', iso3: 'IND', callingCode: '+91', capital: 'New Delhi', singleTimezone: true },
};

async function getCountry(code: string): Promise<Country | null> {
  const { data } = await supabase
    .from('countries')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  return data as Country | null;
}

async function getHolidays(countryId: number): Promise<Holiday[]> {
  const { data } = await supabase
    .from('holidays')
    .select('*')
    .eq('country_id', countryId)
    .order('date', { ascending: true });
  return (data as Holiday[]) || [];
}

async function getTravelTips(countryId: number): Promise<TravelTip[]> {
  // For now, show all tips (including pending) since admin approval flow
  // is not yet built. Once moderation UI exists, filter by moderation_status='approved'.
  const { data } = await supabase
    .from('travel_tips')
    .select('*')
    .eq('country_id', countryId);
  return (data as TravelTip[]) || [];
}

// Fetch USD → target currency rate from exchange_rates table.
// Returns null if the currency isn't in the table yet (first deploy before
// the cron has run) or if the country has no currency_code.
async function getExchangeRate(
  currencyCode: string | null
): Promise<ExchangeRate | null> {
  if (!currencyCode) return null;
  // USD itself needs no conversion
  if (currencyCode === 'USD') return { rate: 1, fetched_at: new Date().toISOString() };

  const { data } = await supabase
    .from('exchange_rates')
    .select('rate, fetched_at')
    .eq('base_currency', 'USD')
    .eq('target_currency', currencyCode)
    .maybeSingle();

  return data as ExchangeRate | null;
}

async function getPriceData(countryId: number): Promise<{
  items: PriceItem[];
  prices: CountryPrice[];
}> {
  const [itemsRes, pricesRes] = await Promise.all([
    supabase.from('price_items').select('*').order('sort_order'),
    supabase
      .from('country_prices')
      .select('*')
      .eq('country_id', countryId),
  ]);
  return {
    items: (itemsRes.data as PriceItem[]) || [],
    prices: (pricesRes.data as CountryPrice[]) || [],
  };
}

async function getSafetyAdvisory(
  countryCode: string
): Promise<TravelAdvisory | null> {
  const { data } = await supabase
    .from('travel_advisories')
    .select('alarm_level, alarm_level_name, alarm_message, issued_at, source')
    .eq('country_code', countryCode)
    .maybeSingle();
  return data as TravelAdvisory | null;
}

// ---------------------------------------------------------------
// Dynamic metadata for SEO — title, description, Open Graph
// Each country page gets a unique, keyword-rich title and description
// that reflects both the holiday calendar and the practical travel info.
// ---------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  const { data: country } = await supabase
    .from('countries')
    .select('name, name_local, currency_code, plug_types, timezone, emoji_flag')
    .eq('code', code)
    .maybeSingle();

  if (!country) {
    return { title: 'Country not found | HolidayTrip' };
  }

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const title = `${country.name} Public Holidays ${currentYear}–${nextYear} | Travel Guide & Tips`;

  const description = [
    `Check official public holidays in ${country.name} for ${currentYear} and ${nextYear}.`,
    `Includes travel tips, what to expect during major holidays,`,
    country.currency_code ? `currency (${country.currency_code}),` : '',
    country.plug_types ? `plug type ${country.plug_types},` : '',
    `local prices, exchange rate, and transport costs.`,
    `Plan your trip to ${country.name} with confidence.`,
  ].filter(Boolean).join(' ');

  const url = `https://www.holiday-trip.com/country/${code.toLowerCase()}`;
  const ogImage = `https://www.holiday-trip.com/og-country.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'HolidayTrip',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${country.name} travel guide` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const country = await getCountry(code);

  if (!country) {
    notFound();
  }

  const [holidays, travelTips, exchangeRate, priceData, safetyAdvisory] = await Promise.all([
    getHolidays(country.id),
    getTravelTips(country.id),
    getExchangeRate(country.currency_code),
    getPriceData(country.id),
    getSafetyAdvisory(code),
  ]);

  const meta: CountryMeta = COUNTRY_META[code] || {
    iso2: code,
    iso3: code,
    callingCode: '',
    capital: country.name,
    singleTimezone: false,
  };

  // --- JSON-LD Structured Data ---
  // BreadcrumbList: helps Google show "Home > South Korea" in search results.
  // ItemList: lists upcoming public holidays so Google can surface them
  // directly in search results (e.g., "Korea holidays 2026").
  const siteUrl = 'https://www.holiday-trip.com';
  const currentYear = new Date().getFullYear();

  const upcomingHolidays = holidays
    .filter((h) => h.date >= new Date().toISOString().slice(0, 10))
    .filter((h) => h.holiday_category === 'regular')
    .slice(0, 10);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: `${country.name} Public Holidays`,
        item: `${siteUrl}/country/${code.toLowerCase()}`,
      },
    ],
  };

  const holidayListJsonLd = upcomingHolidays.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${country.name} Public Holidays ${currentYear}`,
    description: `Official public holidays in ${country.name} for ${currentYear}.`,
    itemListElement: upcomingHolidays.map((h, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: h.name,
        startDate: h.date,
        endDate: h.date,
        eventStatus: 'https://schema.org/EventScheduled',
        location: {
          '@type': 'Country',
          name: country.name,
          address: { '@type': 'PostalAddress', addressCountry: code },
        },
        description: h.name_local ? `${h.name} (${h.name_local})` : h.name,
      },
    })),
  } : null;

  return (
    <>
      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {holidayListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(holidayListJsonLd) }}
        />
      )}

    <div className="min-h-screen bg-[#faf8f5]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span className="text-gray-900">{country.name}</span>
        </nav>

        {/* Hero section */}
        <div className="mb-8">
          <div className="flex items-start gap-5 mb-5">
            {country.emoji_flag && (
              <div className="text-6xl leading-none">{country.emoji_flag}</div>
            )}
            <div className="flex-1 pt-1">
              <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                {country.name}
              </h1>
              {country.name_local && country.name_local !== country.name && (
                <div className="text-lg text-gray-500 mt-1">
                  {country.name_local}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                  {meta.iso2}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                  {meta.iso3}
                </span>
                {meta.callingCode && (
                  <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                    {meta.callingCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick info cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CurrencyCard
              currencyCode={country.currency_code}
              currencySymbol={country.currency_symbol}
              exchangeRate={exchangeRate}
            />
            <InfoCard label="Voltage" value={country.voltage || '—'} />
            <PlugTypeCard plugTypes={country.plug_types} />
            <InfoCard label="Timezone" value={shortTimezone(country.timezone)} />
          </div>

          {/* Safety advisory card — full width */}
          <div className="mt-3">
            <SafetyCard advisory={safetyAdvisory} />
          </div>
        </div>

        {/* Interactive view (calendar + list) */}
        <CountryHolidayView
          country={country}
          holidays={holidays}
          travelTips={travelTips}
          meta={meta}
          priceItems={priceData.items}
          countryPrices={priceData.prices}
          currencyCode={country.currency_code}
          currencySymbol={country.currency_symbol}
        />

        {/* Data source note */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-500">
          <p>
            Holiday and country information is provided for general guidance
            only. Official holiday schedules can change; verify with an
            official government source before making travel plans. Currency,
            voltage, plug, and timezone information may be inaccurate or
            outdated.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}

// Compatibility groups — plug types that fit the same socket.
// When a country lists multiple types that are in the same group,
// we show a note: "Both fit the same socket."
const PLUG_COMPAT_GROUPS: string[][] = [
  ['C', 'E', 'F'],   // Continental European round-pin family
  ['A', 'B'],         // North American flat-pin family (B socket accepts A)
  ['D', 'M'],         // Indian round-pin family (some sockets accept both)
];

function getCompatNote(types: string[]): string | null {
  if (types.length < 2) return null;
  for (const group of PLUG_COMPAT_GROUPS) {
    const matched = types.filter((t) => group.includes(t));
    if (matched.length >= 2) {
      return 'Both fit the same socket — one adapter works for both.';
    }
  }
  return null;
}

// SVG plug socket illustrations for each IEC type (A–N).
// Design principle: show pin shape only, no grounding clips.
// Travelers only need to know "what shape adapter do I need?" —
// grounding details are irrelevant for adapter selection.
const PLUG_SVG: Record<string, React.ReactElement> = {
  A: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <rect x="4" y="4" width="48" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="18" y="14" width="7" height="18" rx="3" fill="currentColor"/>
      <rect x="31" y="14" width="7" height="18" rx="3" fill="currentColor"/>
    </svg>
  ),
  B: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <rect x="4" y="4" width="48" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="18" y="11" width="7" height="17" rx="3" fill="currentColor"/>
      <rect x="31" y="11" width="7" height="17" rx="3" fill="currentColor"/>
      <circle cx="28" cy="40" r="4" fill="currentColor"/>
    </svg>
  ),
  C: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="21" cy="27" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="35" cy="27" rx="3.5" ry="5" fill="currentColor"/>
    </svg>
  ),
  D: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="21" cy="22" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="35" cy="22" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="28" cy="38" rx="3.5" ry="5" fill="currentColor"/>
    </svg>
  ),
  E: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="21" cy="27" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="35" cy="27" rx="3.5" ry="5" fill="currentColor"/>
    </svg>
  ),
  F: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="21" cy="27" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="35" cy="27" rx="3.5" ry="5" fill="currentColor"/>
    </svg>
  ),
  G: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <rect x="4" y="4" width="48" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="17" y="11" width="8" height="17" rx="2" fill="currentColor"/>
      <rect x="31" y="11" width="8" height="17" rx="2" fill="currentColor"/>
      <rect x="22" y="34" width="12" height="7" rx="2" fill="currentColor"/>
    </svg>
  ),
  H: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="20" cy="19" rx="3" ry="5" transform="rotate(-30 20 19)" fill="currentColor"/>
      <ellipse cx="36" cy="19" rx="3" ry="5" transform="rotate(30 36 19)" fill="currentColor"/>
      <ellipse cx="28" cy="38" rx="3" ry="5" fill="currentColor"/>
    </svg>
  ),
  I: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="21" cy="22" rx="3" ry="5" transform="rotate(-30 21 22)" fill="currentColor"/>
      <ellipse cx="35" cy="22" rx="3" ry="5" transform="rotate(30 35 22)" fill="currentColor"/>
      <ellipse cx="28" cy="38" rx="3" ry="5" fill="currentColor"/>
    </svg>
  ),
  J: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="22" cy="22" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="34" cy="22" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="28" cy="37" rx="3.5" ry="5" fill="currentColor"/>
    </svg>
  ),
  K: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="21" cy="23" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="35" cy="23" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="28" cy="38" rx="3.5" ry="5" fill="currentColor"/>
    </svg>
  ),
  L: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <rect x="4" y="4" width="48" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="22" cy="23" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="34" cy="23" rx="3.5" ry="5" fill="currentColor"/>
      <circle cx="28" cy="38" r="4" fill="currentColor"/>
    </svg>
  ),
  M: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <rect x="4" y="4" width="48" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="20" cy="21" rx="4" ry="4" fill="currentColor"/>
      <ellipse cx="36" cy="21" rx="4" ry="4" fill="currentColor"/>
      <ellipse cx="28" cy="37" rx="4" ry="4" fill="currentColor"/>
    </svg>
  ),
  N: (
    <svg width="40" height="40" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="21" cy="23" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="35" cy="23" rx="3.5" ry="5" fill="currentColor"/>
      <ellipse cx="28" cy="37" rx="3.5" ry="5" fill="currentColor"/>
    </svg>
  ),
};

function PlugTypeCard({ plugTypes }: { plugTypes: string | null }) {
  const types = plugTypes
    ? plugTypes.split(/[\s,/]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)
    : [];

  const compatNote = getCompatNote(types);

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 mb-2">Plug type</div>
      {types.length === 0 ? (
        <div className="text-base font-semibold text-gray-900">—</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            {types.map((t) => (
              <div key={t} className="flex flex-col items-center gap-1">
                <div className="text-gray-700">
                  {PLUG_SVG[t] ?? (
                    <div className="w-10 h-10 flex items-center justify-center text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg">
                      {t}
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-700">{t}</span>
              </div>
            ))}
          </div>
          {compatNote && (
            <p className="text-[10px] text-gray-400 mt-2 leading-snug">{compatNote}</p>
          )}
        </>
      )}
    </div>
  );
}

function CurrencyCard({
  currencyCode,
  currencySymbol,
  exchangeRate,
}: {
  currencyCode: string | null;
  currencySymbol: string | null;
  exchangeRate: ExchangeRate | null;
}) {
  const codeStr = currencyCode
    ? `${currencyCode}${currencySymbol ? ' ' + currencySymbol : ''}`
    : '—';

  // Format the rate line: "USD 1 = ₩ 1,384"
  let rateLine: string | null = null;
  let updatedLine: string | null = null;

  if (exchangeRate && currencyCode && currencyCode !== 'USD') {
    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: exchangeRate.rate >= 10 ? 0 : 4,
      minimumFractionDigits: 0,
    }).format(exchangeRate.rate);

    const sym = currencySymbol ? ` ${currencySymbol}` : ` ${currencyCode}`;
    rateLine = `$1 =${sym} ${formatted}`;

    // Format date: "Apr 28, 2026"
    try {
      updatedLine = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(exchangeRate.fetched_at));
    } catch {
      updatedLine = null;
    }
  } else if (currencyCode === 'USD') {
    rateLine = 'Base currency';
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">Currency</div>
      <div className="text-base font-semibold text-gray-900">{codeStr}</div>
      {rateLine && (
        <div className="text-xs text-gray-600 mt-1 font-medium">{rateLine}</div>
      )}
      {updatedLine && (
        <div className="text-[10px] text-gray-400 mt-0.5">{updatedLine}</div>
      )}
      {!rateLine && currencyCode && currencyCode !== 'USD' && (
        <div className="text-[10px] text-gray-400 mt-1">Rate unavailable</div>
      )}
    </div>
  );
}

function shortTimezone(tz: string | null): string {
  if (!tz) return '—';
  // Common pretty-print mappings. Falls back to the IANA name.
  const map: Record<string, string> = {
    'Asia/Seoul': 'KST (UTC+9)',
    'Asia/Tokyo': 'JST (UTC+9)',
    'Asia/Bangkok': 'ICT (UTC+7)',
    'Asia/Shanghai': 'CST (UTC+8)',
    'Asia/Singapore': 'SGT (UTC+8)',
    'Asia/Ho_Chi_Minh': 'ICT (UTC+7)',
    'Asia/Kolkata': 'IST (UTC+5:30)',
    'America/New_York': 'ET (UTC-5/-4)',
    'America/Los_Angeles': 'PT (UTC-8/-7)',
    'America/Chicago': 'CT (UTC-6/-5)',
    'Europe/Paris': 'CET (UTC+1/+2)',
    'Europe/London': 'GMT (UTC+0/+1)',
    'Europe/Berlin': 'CET (UTC+1/+2)',
    'Europe/Rome': 'CET (UTC+1/+2)',
    'Europe/Madrid': 'CET (UTC+1/+2)',
    'Australia/Sydney': 'AEST (UTC+10/+11)',
  };
  return map[tz] || tz;
}

// ── SafetyCard ──────────────────────────────────────────────────────────────
// Displays Korean Ministry of Foreign Affairs travel advisory level.
// Level 0 = no advisory (safe), 1-4 = increasing risk.

const ADVISORY_CONFIG: Record<number, {
  color: string; bg: string; border: string; icon: string; label: string;
}> = {
  0: { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', icon: '✅', label: 'Safe to Travel' },
  1: { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  icon: '🔵', label: 'Exercise Caution' },
  2: { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200',icon: '⚠️', label: 'Restrict Travel' },
  3: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200',icon: '🔴', label: 'Advise Departure' },
  4: { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   icon: '🚫', label: 'Do Not Travel' },
};

function SafetyCard({ advisory }: { advisory: TravelAdvisory | null }) {
  // No data yet (cron hasn't run) — show neutral state
  if (!advisory) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-lg">🛡️</span>
        <div>
          <div className="text-xs text-gray-500">Travel Advisory</div>
          <div className="text-sm font-medium text-gray-400">Data loading…</div>
        </div>
      </div>
    );
  }

  const level = advisory.alarm_level ?? 0;
  const cfg = ADVISORY_CONFIG[level] || ADVISORY_CONFIG[0];

  const issuedLabel = advisory.issued_at
    ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        .format(new Date(advisory.issued_at))
    : null;

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl px-4 py-3`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-lg flex-shrink-0">{cfg.icon}</span>
          <div>
            <div className="text-[11px] text-gray-500 mb-0.5">
              Travel Advisory
              {advisory.alarm_level_name && level > 0 && (
                <span className="ml-1 text-gray-400">· {advisory.alarm_level_name}</span>
              )}
            </div>
            <div className={`text-sm font-semibold ${cfg.color}`}>
              {level === 0 ? 'No Advisory' : `Level ${level} — ${cfg.label}`}
            </div>
            {advisory.alarm_message && level > 0 && (
              <div className="text-[11px] text-gray-600 mt-1 leading-snug line-clamp-2">
                {advisory.alarm_message}
              </div>
            )}
          </div>
        </div>
        {issuedLabel && level > 0 && (
          <div className="text-[10px] text-gray-400 flex-shrink-0 text-right">
            {issuedLabel}
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          Source: {advisory.source}
        </span>
        <a
          href="https://0404.go.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
        >
          0404.go.kr →
        </a>
      </div>
    </div>
  );
}
