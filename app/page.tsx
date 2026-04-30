import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Metadata } from 'next';

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
  { country_name: string; country_code: string; emoji_flag: string | null; date: string; name: string }[]
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
    .limit(12);

  if (!holidays || holidays.length === 0) return [];

  const countryIds = [...new Set((holidays as Holiday[]).map((h) => h.country_id))];
  const { data: countries } = await supabase
    .from('countries')
    .select('id, name, code, emoji_flag')
    .in('id', countryIds);

  const countryMap = new Map(
    ((countries as { id: number; name: string; code: string; emoji_flag: string | null }[]) || []).map(
      (c) => [c.id, c]
    )
  );

  return (holidays as Holiday[])
    .map((h) => {
      const c = countryMap.get(h.country_id);
      if (!c) return null;
      return {
        country_name: c.name,
        country_code: c.code,
        emoji_flag: c.emoji_flag,
        date: h.date,
        name: h.name,
      };
    })
    .filter(Boolean) as { country_name: string; country_code: string; emoji_flag: string | null; date: string; name: string }[];
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso + 'T00:00:00'));
}

// JSON-LD for the homepage
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'HolidayTrip',
  url: 'https://www.holiday-trip.com',
  description:
    'Public holidays, travel tips, local prices, exchange rates, plug types, and what to expect during major holidays in 50+ countries.',
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

// Featured countries — highest travel demand
const FEATURED = ['JP', 'KR', 'TH', 'US', 'FR', 'GB', 'AU', 'VN', 'SG', 'IT', 'DE', 'ES'];

export default async function HomePage() {
  const [countries, upcoming] = await Promise.all([
    getCountries(),
    getUpcomingHolidays(),
  ]);

  const featuredCountries = FEATURED.map((code) =>
    countries.find((c) => c.code === code)
  ).filter(Boolean) as Country[];

  const otherCountries = countries.filter((c) => !FEATURED.includes(c.code));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <div className="min-h-screen bg-[#faf8f5]">

        {/* ── Hero ── */}
        <section className="max-w-5xl mx-auto px-4 pt-14 pb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 tracking-tight leading-tight mb-4">
            Public Holidays & Travel Information<br className="hidden sm:block" /> for 50+ Countries
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Planning a trip abroad? HolidayTrip helps you check official public holidays,
            understand how they affect travel, and see local prices, exchange rates,
            plug types, and transport costs — all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6 text-sm text-gray-500">
            {['🗓 2025–2027 Calendars', '💡 Travel Tips per Holiday', '💱 Live Exchange Rates',
              '🔌 Plug & Voltage Info', '🚇 Local Transport Costs', '🛒 Price Comparisons'].map((f) => (
              <span key={f} className="px-3 py-1.5 bg-white border border-gray-200 rounded-full">{f}</span>
            ))}
          </div>
        </section>

        {/* ── Why use HolidayTrip ── */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Why travelers use HolidayTrip</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: '🏪',
                title: "Know what's open",
                body: 'Find out if restaurants, shops, and attractions will be open during your visit. Many countries have widespread closures on major public holidays.',
              },
              {
                icon: '🚆',
                title: 'Avoid transport chaos',
                body: 'Major holidays like Chuseok in Korea, Golden Week in Japan, or Tet in Vietnam can make trains and buses impossible to book without advance planning.',
              },
              {
                icon: '💰',
                title: 'Budget accurately',
                body: 'Check real local prices — subway fares, taxi base rates, bottled water, beer — plus the latest exchange rate, so there are no surprises when you arrive.',
              },
            ].map((card) => (
              <div key={card.title} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Upcoming holidays ── */}
        {upcoming.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 pb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Upcoming public holidays</h2>
            <p className="text-sm text-gray-500 mb-5">Public holidays around the world in the next 30 days.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {upcoming.map((h, i) => (
                <Link
                  key={i}
                  href={`/country/${h.country_code.toLowerCase()}`}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 transition-colors"
                >
                  <div className="text-xs text-gray-400 mb-1">{formatDate(h.date)}</div>
                  <div className="text-sm font-semibold text-gray-900 truncate">{h.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {h.emoji_flag} {h.country_name}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Featured countries ── */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Popular travel destinations</h2>
          <p className="text-sm text-gray-500 mb-5">
            Click any country to see its public holiday calendar, travel tips, local prices, and essential info.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredCountries.map((c) => (
              <Link
                key={c.code}
                href={`/country/${c.code.toLowerCase()}`}
                className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-400 hover:shadow-sm transition-all group"
              >
                <div className="text-3xl mb-2">{c.emoji_flag}</div>
                <div className="text-base font-semibold text-gray-900 group-hover:text-gray-700">
                  {c.name}
                </div>
                {c.name_local && c.name_local !== c.name && (
                  <div className="text-xs text-gray-400 mt-0.5">{c.name_local}</div>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
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
                {c.description && (
                  <p className="text-xs text-gray-500 mt-2 leading-snug line-clamp-2">{c.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* ── What you get per country ── */}
        <section className="bg-white border-y border-gray-200 py-12 mb-12">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
              What you get for every country
            </h2>
            <p className="text-sm text-gray-500 text-center mb-8 max-w-xl mx-auto">
              Every country page on HolidayTrip is a complete pre-trip checklist — not just a list of dates.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { icon: '🗓', label: 'Holiday calendar', desc: '2025–2027 dates with official names' },
                { icon: '💡', label: 'Travel tips', desc: 'What to expect, what to avoid' },
                { icon: '🏪', label: 'Opening hours', desc: 'Are shops and restaurants open?' },
                { icon: '🚇', label: 'Transport costs', desc: 'Subway, bus, and taxi base fares' },
                { icon: '💱', label: 'Exchange rate', desc: 'Live USD rate updated daily' },
                { icon: '🔌', label: 'Plug & voltage', desc: 'Visual plug type guide' },
                { icon: '🛒', label: 'Local prices', desc: 'Water, Coke, Big Mac, beer prices' },
                { icon: '📱', label: 'SIM card info', desc: '7-day tourist SIM cost estimate' },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 items-start">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-snug">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── All countries ── */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">All countries</h2>
          <p className="text-sm text-gray-500 mb-5">
            HolidayTrip covers {countries.length} countries with public holiday data, travel tips, and local information.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {otherCountries.map((c) => (
              <Link
                key={c.code}
                href={`/country/${c.code.toLowerCase()}`}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 transition-colors flex items-center gap-3"
              >
                <span className="text-2xl flex-shrink-0">{c.emoji_flag}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                  {c.currency_code && (
                    <div className="text-[10px] text-gray-400">{c.currency_code} · {c.plug_types ? `Plug ${c.plug_types}` : ''}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

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
