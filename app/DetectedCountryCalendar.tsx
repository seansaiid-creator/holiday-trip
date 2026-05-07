'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Holiday = {
  id: number;
  date: string;
  name: string;
  name_local: string | null;
  holiday_category: string | null;
  is_substitute: boolean | null;
};

type CountryInfo = {
  code: string;
  name: string;
  currency_code: string | null;
  voltage: string | null;
  plug_types: string | null;
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAY_HEADERS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

export default function DetectedCountryCalendar() {
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [detectedAuto, setDetectedAuto] = useState(true);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  useEffect(() => {
    async function detectCountry() {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const code = data.country_code as string;
        setCountryCode(code);
      } catch {
        setCountryCode('US');
        setDetectedAuto(false);
      }
    }
    detectCountry();
  }, []);

  useEffect(() => {
    if (!countryCode) return;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/country-calendar?code=${countryCode}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setCountry(data.country);
        setHolidays(data.holidays);
      } catch {
        setCountry(null);
        setHolidays([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [countryCode]);

  const monthHolidays = holidays.filter((h) => {
    const [y, m] = h.date.split('-').map(Number);
    return y === year && m === month;
  });

  const holidaysByDate = new Map<string, Holiday[]>();
  for (const h of holidays) {
    const list = holidaysByDate.get(h.date) || [];
    list.push(h);
    holidaysByDate.set(h.date, list);
  }

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number | null; date: string | null; weekday: number }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, date: null, weekday: i });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr, weekday: (firstDay + d - 1) % 7 });
  }
  while (cells.length < 35) cells.push({ day: null, date: null, weekday: cells.length % 7 });

  function nav(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setYear(y);
    setMonth(m);
  }

  const upcomingHolidays = holidays
    .filter((h) => h.date >= todayStr)
    .slice(0, 3);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <div className="text-sm text-gray-400">Detecting your location…</div>
      </div>
    );
  }

  if (!country) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <img
              src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
              alt={country.name}
              width={24}
              height={18}
              className="rounded-sm"
              style={{ width: '24px', height: '18px', objectFit: 'cover' }}
            />
            <span className="text-base font-semibold text-gray-900">{country.name} — {MONTHS_SHORT[month - 1]} {year}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {detectedAuto ? 'Detected from your location · ' : 'Default location · '}
            <button
              onClick={() => {
                const code = prompt('Enter country code (e.g. JP, KR, TH):');
                if (code) { setCountryCode(code.toUpperCase()); setDetectedAuto(false); }
              }}
              className="text-blue-500 hover:underline"
            >
              Change
            </button>
          </div>
        </div>
        <Link
          href={`/country/${country.code.toLowerCase()}`}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-colors"
        >
          More Info →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* Calendar */}
        <div className="p-4">
          {/* Nav */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => nav(-1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm">‹</button>
            <span className="text-sm font-medium text-gray-700 flex-1 text-center">{MONTHS_SHORT[month - 1]} {year}</span>
            <button onClick={() => nav(1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm">›</button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
            >
              Today
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAY_HEADERS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-500' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, idx) => {
              const dayHolidays = cell.date ? holidaysByDate.get(cell.date) : null;
              const hasHoliday = !!(dayHolidays && dayHolidays.length > 0);
              const isToday = cell.date === todayStr;
              const isSunday = cell.weekday === 0;
              const label = hasHoliday ? dayHolidays![0].name.split(' ').slice(0, 2).join(' ') : '';

              return (
                <div
                  key={idx}
                  className={`
                    relative h-[52px] border rounded-md p-0.5 text-[9px] overflow-hidden
                    ${cell.day === null ? 'border-transparent' : 'border-gray-100'}
                    ${hasHoliday ? 'bg-red-50/70' : ''}
                    ${isToday ? 'ring-2 ring-blue-500 border-blue-500' : ''}
                  `}
                >
                  {cell.day !== null && (
                    <>
                      <div className={`text-[11px] font-semibold leading-none mb-0.5 ${
                        hasHoliday ? 'text-red-600' : isSunday ? 'text-red-500' : 'text-gray-700'
                      }`}>
                        {cell.day}
                      </div>
                      {hasHoliday && (
                        <div className="text-[8px] leading-tight text-red-600 line-clamp-2" style={{ wordBreak: 'break-word' }}>
                          {label}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-red-50 border border-red-100"></span>Holiday</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded ring-2 ring-blue-500"></span>Today</span>
          </div>
        </div>

        {/* Right: country info + upcoming */}
        <div className="p-4 flex flex-col gap-4">
          {/* Quick info */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Essential info</div>
            <div className="grid grid-cols-3 gap-2">
              {country.currency_code && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-gray-400 mb-0.5">Currency</div>
                  <div className="text-xs font-semibold text-gray-900">{country.currency_code}</div>
                </div>
              )}
              {country.voltage && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-gray-400 mb-0.5">Voltage</div>
                  <div className="text-xs font-semibold text-gray-900">{country.voltage}</div>
                </div>
              )}
              {country.plug_types && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-gray-400 mb-0.5">Plug</div>
                  <div className="text-xs font-semibold text-gray-900">{country.plug_types}</div>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming holidays */}
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-500 mb-2">Upcoming holidays</div>
            {upcomingHolidays.length === 0 ? (
              <div className="text-xs text-gray-400">No upcoming holidays found.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingHolidays.map((h) => {
                  const isSub = h.is_substitute || h.holiday_category === 'substitute';
                  return (
                    <div key={h.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                      <div className={`text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${
                        isSub ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {formatDateShort(h.date)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-900 truncate">{h.name}</div>
                        {h.name_local && (
                          <div className="text-[10px] text-gray-400 truncate">{h.name_local}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href={`/country/${country.code.toLowerCase()}`}
            className="text-center text-xs text-white font-bold bg-blue-600 hover:bg-blue-700 rounded-xl py-2.5 transition-colors"
          >
            More Info for {country.name} →
          </Link>
        </div>
      </div>
    </div>
  );
}
