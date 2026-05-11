import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Metadata } from 'next';
import CountrySearch from './CountrySearch';
import DetectedCountryCalendar from './DetectedCountryCalendar';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'HolidayTrip — Public Holidays & Travel Information for 50+ Countries',
  description:
    'Check public holidays, travel tips, local prices, exchange rates, plug types, and what to expect during major holidays in 50+ countries. Plan smarter trips with HolidayTrip.',
  openGraph: {
    title: 'HolidayTrip — Public Holidays & Travel Information',
    description:
      'Public holidays, travel tips, local prices, exchange rates, and plug types for 50+ countries. Know before you go.',
    url: 'https://www.holiday-trip.com',
    siteName: 'HolidayTrip',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HolidayTrip — Public Holidays & Travel Information',
    description:
      'Public holidays, local prices, exchange rates, and travel tips for 50+ countries.',
  },
  alternates: { canonical: 'https://www.holiday-trip.com' },
};

type Country = {
  code: string;
  name: string;
  name_local: string | null;
  currency_code: string | null;
  voltage: string | null;
  plug_types: string | null;
  emoji_flag: string | null;
  description: string | null;
};

type Holiday = {
  id: number;
  date: string;
  name: string;
  country_id: number;
};

async function getCountries(): Promise<Country[]> {
  const { data } = await supabase
    .from('countries')
    .select('code, name, name_local, currency_code, voltage, plug_types, emoji_flag, description')
    .order('name');
  return (data as Country[]) || [];
}

async function getUpcomingHolidays(): Promise<
  { country_name: string; country_code: string; date: string; name: string }[]
> {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  const { data: holidays } = await supabase
    .from('holidays')
    .select('id, date, name, country_id')
    .gte('date', today)
    .lte('date', in30)
    .eq('holiday_category', 'regular')
    .order('date', { ascending: true })
    .limit(8);

  if (!holidays || holidays.length === 0) return [];

  const countryIds = [...new Set((holidays as Holiday[]).map((h) => h.country_id))];
  const { data: countries } = await supabase
    .from('countries')
    .select('id, name, code')
    .in('id', countryIds);

  const countryMap = new Map(
    ((countries as { id: number; name: string; code: string }[]) || []).map((c) => [c.id, c])
  );

  return (holidays as Holiday[])
    .map((h) => {
      const c = countryMap.get(h.country_id);
      if (!c) return null;
      return { country_name: c.name, country_code: c.code, date: h.date, name: h.name };
    })
    .filter(Boolean) as { country_name: string; country_code: string; date: string; name: string }[];
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(iso + 'T00:00:00')
  );
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'HolidayTrip',
  url: 'https://www.holiday-trip.com',
  description: 'Public holidays, travel tips, local prices, exchange rates, plug types, and what to expect during major holidays in 50+ countries.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.holiday-trip.com/country/{country_code}',
    'query-input': 'required name=country_code',
  },
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'HolidayTrip',
  url: 'https://www.holiday-trip.com',
  description: 'Global public holiday and travel information service covering 50+ countries.',
};

const FEATURED = ['KR', 'US', 'TH', 'JP', 'FR', 'GB', 'AU', 'VN', 'SG', 'IT', 'DE', 'ES'];

export default async function HomePage() {
  const [countries, upcoming] = await Promise.all([getCountries(), getUpcomingHolidays()]);

  const featuredCountries = FEATURED.map((code) => countries.find((c) => c.code === code)).filter(
    Boolean
  ) as Country[];
  const otherCountries = countries.filter((c) => !FEATURED.includes(c.code));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />

      <div className="min-h-screen bg-[#faf8f5]">

        {/* ── Hero (dark) ── */}
        <section className="bg-[#1a1a2e] px-4 pt-14 pb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-tight mb-3">
            Know before you land.
          </h1>
          <p className="text-base text-[#9fa8c7] max-w-xl mx-auto mb-6 leading-relaxed">
            Public holidays, local prices & travel tips for 50+ countries
          </p>
          {/* Search bar */}
          <div className="max-w-lg mx-auto mb-6">
            <Link
              href="#all-countries"
              className="flex items-center bg-white rounded-full px-5 py-3 gap-3 hover:shadow-md transition-shadow"
            >
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm text-gray-400 flex-1 text-left">Search a country… Japan, France, Thailand</span>
            </Link>
          </div>
          {/* Quick links */}
          <div className="flex flex-wrap justify-center gap-2">
            {['KR', 'TH', 'US', 'JP', 'FR', 'GB'].map((code) => {
              const c = countries.find((x) => x.code === code);
              if (!c) return null;
              return (
                <Link
                  key={code}
                  href={`/country/${code.toLowerCase()}`}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
                >
                  <img
                    src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                    alt={c.name}
                    width={16}
                    height={12}
                    className="rounded-sm"
                    style={{ width: '16px', height: '12px', objectFit: 'cover' }}
                  />
                  {c.name}
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Feature cards ── */}
        <section className="max-w-5xl mx-auto px-4 py-10">
          <p className="text-xs text-gray-400 text-center uppercase tracking-widest mb-6">
            What travelers find most useful
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                icon: '🔌',
                label: 'Plug & voltage',
                desc: 'See which adapter you need before you pack.',
                detail: 'Type A, B, C, G and more',
              },
              {
                icon: '💰',
                label: 'Local prices',
                desc: 'Real prices — meals, beer, transport, SIM.',
                detail: 'Big Mac · Subway · Beer',
              },
              {
                icon: '💱',
                label: 'Exchange rate',
                desc: 'Live USD rate updated daily.',
                detail: 'Updated every 24 hours',
              },
              {
                icon: '🗓',
                label: 'Holiday calendar',
                desc: '2025–2027 dates with travel impact tips.',
                detail: 'With traveler tips',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-colors"
              >
                <div className="text-2xl mb-3">{card.icon}</div>
                <div className="text-sm font-semibold text-gray-900 mb-1">{card.label}</div>
                <div className="text-xs text-gray-500 leading-snug mb-2">{card.desc}</div>
                <div className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 inline-block">
                  {card.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── IP-detected country calendar ── */}
        <section className="max-w-5xl mx-auto px-4 pb-10">
          <DetectedCountryCalendar />
        </section>

        {/* ── Upcoming holidays ── */}
        {upcoming.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 pb-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Upcoming public holidays</h2>
            <p className="text-sm text-gray-400 mb-4">Around the world in the next 30 days</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {upcoming.map((h, i) => (
                <Link
                  key={i}
                  href={`/country/${h.country_code.toLowerCase()}`}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 transition-colors"
                >
                  <div className="text-xs text-gray-400 mb-1">{formatDate(h.date)}</div>
                  <div className="text-sm font-semibold text-gray-900 leading-snug mb-1.5" style={{ wordBreak: 'break-word' }}>
                    {h.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <img
                      src={`https://flagcdn.com/w40/${h.country_code.toLowerCase()}.png`}
                      alt={h.country_name}
                      width={18}
                      height={13}
                      className="rounded-sm flex-shrink-0"
                      style={{ width: '18px', height: '13px', objectFit: 'cover' }}
                    />
                    <span className="text-xs text-gray-500">{h.country_name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Popular destinations ── */}
        <section className="max-w-5xl mx-auto px-4 pb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Popular destinations</h2>
          <p className="text-sm text-gray-400 mb-4">
            Click any country to see its holiday calendar, prices, plug types & travel tips.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredCountries.map((c) => (
              <Link
                key={c.code}
                href={`/country/${c.code.toLowerCase()}`}
                className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-400 hover:shadow-sm transition-all group"
              >
                <img
                  src={`https://flagcdn.com/w80/${c.code.toLowerCase()}.png`}
                  alt={c.name}
                  width={48}
                  height={36}
                  className="rounded-sm mb-2"
                  style={{ width: '48px', height: '36px', objectFit: 'cover' }}
                />
                <div className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 mb-1">
                  {c.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.currency_code && (
                    <span className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                      {c.currency_code}
                    </span>
                  )}
                  {c.voltage && (
                    <span className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                      {c.voltage}
                    </span>
                  )}
                  {c.plug_types && (
                    <span className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                      Plug {c.plug_types}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── All countries (with search) ── */}
        <div id="all-countries">
          <CountrySearch
            countries={[...featuredCountries, ...otherCountries]}
            totalCount={countries.length}
          />
        </div>

        {/* ── About / SEO text ── */}
        <section className="bg-white border-t border-gray-200 py-12">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">About HolidayTrip</h2>
            <div className="prose prose-sm text-gray-600 space-y-3 leading-relaxed">
              <p>
                HolidayTrip is a global travel information service designed to help international
                travelers prepare for visits to any country. Most public holiday websites simply list
                dates — HolidayTrip goes further by explaining what each holiday means for travelers:
                which businesses close, how crowded transport gets, what to book in advance, and what
                to expect on the ground.
              </p>
              <p>
                Each country page includes a verified public holiday calendar for 2025, 2026, and 2027,
                alongside practical information that changes how you plan: the current exchange rate,
                voltage and plug type, one-ride transit costs, taxi base fares, and everyday prices
                like bottled water, Coca-Cola, a Big Mac, a local beer, and a 7-day tourist SIM card.
              </p>
              <p>
                Major holidays like Japan's Golden Week, Korea's Chuseok, Vietnam's Tết, Thailand's
                Songkran, and China's National Day can affect millions of travelers each year — with
                sold-out trains, closed restaurants, and surging hotel prices. HolidayTrip provides
                the context travelers need to plan around these periods, or to embrace them with the
                right expectations.
              </p>
              <p>
                Holiday data for South Korea is sourced from the Korean Astronomical Research
                Institute (official government data). Data for other countries is sourced from
                publicly available holiday APIs and cross-referenced with Wikipedia. All information
                is provided as a reference guide — verify critical dates with official government
                sources before making travel bookings.
              </p>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
