import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Metadata } from 'next';

// Revalidate every hour so "today" stays accurate
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  return {
    title: `Public Holidays Today — ${dateStr} | HolidayTrip`,
    description: `Which countries have a public holiday today, ${dateStr}? See all countries with official public holidays right now, plus upcoming holidays this week.`,
    openGraph: {
      title: `Public Holidays Today — ${dateStr}`,
      description: `Countries with public holidays today and this week. Updated daily.`,
      url: 'https://www.holiday-trip.com/public-holidays-today',
      siteName: 'HolidayTrip',
      type: 'website',
    },
    alternates: { canonical: 'https://www.holiday-trip.com/public-holidays-today' },
  };
}

type HolidayWithCountry = {
  date: string;
  name: string;
  name_local: string | null;
  country_name: string;
  country_code: string;
  emoji_flag: string | null;
};

async function getHolidaysForRange(from: string, to: string): Promise<HolidayWithCountry[]> {
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date, name, name_local, country_id')
    .gte('date', from)
    .lte('date', to)
    .eq('holiday_category', 'regular')
    .order('date', { ascending: true });

  if (!holidays || holidays.length === 0) return [];

  const countryIds = [...new Set(holidays.map((h: any) => h.country_id))];
  const { data: countries } = await supabase
    .from('countries')
    .select('id, name, code, emoji_flag')
    .in('id', countryIds);

  const countryMap = new Map(
    ((countries as any[]) || []).map((c) => [c.id, c])
  );

  return holidays
    .map((h: any) => {
      const c = countryMap.get(h.country_id);
      if (!c) return null;
      return {
        date: h.date,
        name: h.name,
        name_local: h.name_local,
        country_name: c.name,
        country_code: c.code,
        emoji_flag: c.emoji_flag,
      };
    })
    .filter(Boolean) as HolidayWithCountry[];
}

function getDateRange() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const monthEnd = new Date(now);
  monthEnd.setDate(now.getDate() + 30);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  return { today, weekEndStr, monthEndStr };
}

function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', options || {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(iso + 'T00:00:00'));
}

function HolidayCard({ h }: { h: HolidayWithCountry }) {
  return (
    <Link
      href={`/country/${h.country_code.toLowerCase()}`}
      className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 hover:shadow-sm transition-all group flex items-center gap-3"
    >
      <span className="text-3xl flex-shrink-0">{h.emoji_flag}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 truncate">
          {h.name}
        </div>
        {h.name_local && h.name_local !== h.name && (
          <div className="text-xs text-gray-400 truncate">{h.name_local}</div>
        )}
        <div className="text-xs text-gray-500 mt-0.5">{h.country_name}</div>
      </div>
      <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:block">
        {formatDate(h.date)}
      </span>
    </Link>
  );
}

export default async function PublicHolidaysTodayPage() {
  const { today, weekEndStr, monthEndStr } = getDateRange();

  const [todayHolidays, weekHolidays, monthHolidays] = await Promise.all([
    getHolidaysForRange(today, today),
    getHolidaysForRange(today, weekEndStr),
    getHolidaysForRange(today, monthEndStr),
  ]);

  // Week holidays excluding today
  const upcomingWeek = weekHolidays.filter((h) => h.date > today);
  // Month holidays excluding this week
  const upcomingMonth = monthHolidays.filter((h) => h.date > weekEndStr);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Public Holidays Today — ${todayFormatted}`,
    description: `Countries with public holidays on ${todayFormatted}`,
    url: 'https://www.holiday-trip.com/public-holidays-today',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.holiday-trip.com' },
        { '@type': 'ListItem', position: 2, name: 'Public Holidays Today', item: 'https://www.holiday-trip.com/public-holidays-today' },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-[#faf8f5]">
        <div className="max-w-4xl mx-auto px-4 py-8">

          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-gray-900">Public Holidays Today</span>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-2">
              Public Holidays Today
            </h1>
            <p className="text-gray-500 text-sm">{todayFormatted}</p>
          </div>

          {/* Today */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-lg">🗓</span>
              <h2 className="text-xl font-semibold text-gray-900">
                Holidays today
              </h2>
              {todayHolidays.length > 0 && (
                <span className="text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full">
                  {todayHolidays.length} {todayHolidays.length === 1 ? 'country' : 'countries'}
                </span>
              )}
            </div>

            {todayHolidays.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-8 text-center">
                <div className="text-3xl mb-2">✌️</div>
                <p className="text-gray-600 text-sm font-medium">No public holidays today</p>
                <p className="text-gray-400 text-xs mt-1">Check upcoming holidays below</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {todayHolidays.map((h, i) => (
                  <HolidayCard key={i} h={h} />
                ))}
              </div>
            )}
          </section>

          {/* This week */}
          {upcomingWeek.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-lg">📅</span>
                <h2 className="text-xl font-semibold text-gray-900">This week</h2>
                <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                  {upcomingWeek.length} upcoming
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingWeek.map((h, i) => (
                  <HolidayCard key={i} h={h} />
                ))}
              </div>
            </section>
          )}

          {/* This month */}
          {upcomingMonth.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-lg">🗓</span>
                <h2 className="text-xl font-semibold text-gray-900">Later this month</h2>
              </div>

              {/* Group by date */}
              {Object.entries(
                upcomingMonth.reduce((acc, h) => {
                  if (!acc[h.date]) acc[h.date] = [];
                  acc[h.date].push(h);
                  return acc;
                }, {} as Record<string, HolidayWithCountry[]>)
              ).map(([date, holidays]) => (
                <div key={date} className="mb-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {holidays.map((h, i) => (
                      <HolidayCard key={i} h={h} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* About section — SEO text */}
          <section className="bg-white border border-gray-200 rounded-2xl px-6 py-6 mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              About this page
            </h2>
            <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <p>
                This page shows all countries with official public holidays today,
                updated daily. Public holidays affect how travelers experience a destination —
                from shop closures and crowded transport to special cultural events and
                reduced services.
              </p>
              <p>
                Click any country to see its full holiday calendar, travel tips for major
                holidays, local prices, exchange rate, plug type, and transport costs.
              </p>
            </div>
          </section>

          {/* Browse all */}
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors border border-gray-300 bg-white rounded-full px-5 py-2.5 hover:border-gray-400"
            >
              Browse all 50+ countries →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
