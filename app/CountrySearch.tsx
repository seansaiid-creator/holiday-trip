'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

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

export default function CountrySearch({
  countries,
  totalCount,
}: {
  countries: Country[];
  totalCount: number;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.name_local?.toLowerCase().includes(q)) ||
        c.code.toLowerCase().includes(q) ||
        (c.currency_code?.toLowerCase().includes(q))
    );
  }, [query, countries]);

  return (
    <section className="max-w-5xl mx-auto px-4 pb-16">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">All countries</h2>
      <p className="text-sm text-gray-500 mb-5">
        HolidayTrip covers {totalCount} countries with public holiday data, travel tips, and local information.
      </p>

      {/* Search input */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries… (e.g. Japan, EUR, Plug G)"
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results count when searching */}
      {query && (
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length === 0
            ? 'No countries found.'
            : `${filtered.length} country${filtered.length !== 1 ? 'ies' : 'y'} found`}
        </p>
      )}

      {/* Country grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((c) => (
            <Link
              key={c.code}
              href={`/country/${c.code.toLowerCase()}`}
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 transition-colors flex items-center gap-3"
            >
              <img
                src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                alt={c.name}
                width={28}
                height={21}
                className="rounded-sm flex-shrink-0"
                style={{ width: '28px', height: '21px', objectFit: 'cover' }}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                {c.currency_code && (
                  <div className="text-[10px] text-gray-400">
                    {c.currency_code}
                    {c.plug_types ? ` · Plug ${c.plug_types}` : ''}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm">No countries match &ldquo;{query}&rdquo;</p>
          <button
            onClick={() => setQuery('')}
            className="mt-3 text-xs text-gray-500 underline hover:text-gray-700"
          >
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}
