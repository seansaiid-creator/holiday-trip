import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

async function getCountry(code: string) {
  const { data } = await supabase
    .from('countries')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();
  return data;
}

async function getHolidays(countryId: number) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('holidays')
    .select('*')
    .eq('country_id', countryId)
    .gte('date', today)
    .order('date');
  return data || [];
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const country = await getCountry(code);

  if (!country) {
    notFound();
  }

  const holidays = await getHolidays(country.id);

  const holidaysByYear = holidays.reduce((acc: any, h: any) => {
    if (!acc[h.year]) acc[h.year] = [];
    acc[h.year].push(h);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ← Back to all countries
        </Link>
      </div>

      <section className="max-w-4xl mx-auto px-6 pt-8 pb-12">
        <div className="flex items-center gap-6 mb-6">
          <div className="text-7xl">{country.emoji_flag}</div>
          <div>
            <h1 className="text-5xl font-bold text-gray-900 mb-2">
              {country.name}
            </h1>
            <p className="text-xl text-gray-600">{country.name_local}</p>
          </div>
        </div>

        <p className="text-lg text-gray-700 mb-8">{country.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Currency</div>
            <div className="font-semibold text-gray-900">
              {country.currency_symbol} {country.currency_code}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Voltage</div>
            <div className="font-semibold text-gray-900">{country.voltage}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Plug Type</div>
            <div className="font-semibold text-gray-900">
              {country.plug_types}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Timezone</div>
            <div className="font-semibold text-gray-900 text-sm">
              {country.timezone}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 mb-12">
        <div className="bg-gray-100 rounded-xl p-8 text-center text-gray-400 text-sm">
          [ Advertisement ]
        </div>
      </div>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          Upcoming Holidays
        </h2>

        {Object.keys(holidaysByYear)
          .sort()
          .map((year) => (
            <div key={year} className="mb-12">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">{year}</h3>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {holidaysByYear[year].map((holiday: any, idx: number) => (
                  <div
                    key={holiday.id}
                    className={`flex items-center justify-between p-5 ${
                      idx !== holidaysByYear[year].length - 1
                        ? 'border-b border-gray-100'
                        : ''
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">
                        {holiday.name}
                      </div>
                      {holiday.name_local && holiday.name_local !== holiday.name && (
                        <div className="text-sm text-gray-500 mt-1">
                          {holiday.name_local}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {new Date(holiday.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(holiday.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </section>

      <div className="max-w-4xl mx-auto px-6 mb-12">
        <div className="bg-gray-100 rounded-xl p-8 text-center text-gray-400 text-sm">
          [ Advertisement ]
        </div>
      </div>

      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-white text-lg font-bold">HolidayTrip</div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="hover:text-white">About</Link>
              <Link href="/contact" className="hover:text-white">Contact</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
            </div>
          </div>
          <div className="text-center text-sm mt-6">
            © 2026 HolidayTrip. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}