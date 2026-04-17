import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const revalidate = 3600; // 1시간마다 재생성

async function getCountries() {
  const { data } = await supabase
    .from('countries')
    .select('*')
    .eq('is_active', true)
    .order('name');
  return data || [];
}

async function getUpcomingHolidays() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('holidays')
    .select('*, countries(name, emoji_flag, code)')
    .gte('date', today)
    .order('date')
    .limit(10);
  return data || [];
}

export default async function HomePage() {
  const countries = await getCountries();
  const upcomingHolidays = await getUpcomingHolidays();

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Holiday<span className="text-blue-600">Trip</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Your global guide to holidays, travel information, and local insights from around the world.
        </p>
        <div className="inline-flex gap-2 text-sm text-gray-500">
          <span>🌍 {countries.length} Countries</span>
          <span>•</span>
          <span>📅 2025-2027 Holidays</span>
          <span>•</span>
          <span>💡 Travel Tips</span>
        </div>
      </section>

      {/* Countries Grid */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          Explore Countries
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {countries.map((country: any) => (
            <Link
              key={country.id}
              href={`/country/${country.code.toLowerCase()}`}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="text-5xl mb-4">{country.emoji_flag}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {country.name}
              </h3>
              <p className="text-gray-500 text-sm mb-4">{country.name_local}</p>
              <p className="text-gray-700 text-sm line-clamp-2">
                {country.description}
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
                <span>💰 {country.currency_code}</span>
                <span>⚡ {country.voltage}</span>
                <span>🔌 {country.plug_types}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Holidays */}
      <section className="max-w-6xl mx-auto px-6 py-12 pb-20">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          Upcoming Holidays
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {upcomingHolidays.map((holiday: any, idx: number) => (
            <Link
              key={holiday.id}
              href={`/country/${holiday.countries.code.toLowerCase()}`}
              className={`flex items-center justify-between p-5 hover:bg-gray-50 transition-colors ${
                idx !== upcomingHolidays.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl">{holiday.countries.emoji_flag}</div>
                <div>
                  <div className="font-semibold text-gray-900">{holiday.name}</div>
                  <div className="text-sm text-gray-500">
                    {holiday.countries.name} • {holiday.name_local}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {new Date(holiday.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {Math.ceil((new Date(holiday.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days away
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="text-white text-lg font-bold mb-2">HolidayTrip</div>
          <div className="text-sm">
            © 2026 HolidayTrip. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}