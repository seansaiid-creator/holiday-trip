'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Country = {
  id: number;
  code: string;
  name: string;
  name_local: string | null;
  timezone: string | null;
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
};

type CountryMeta = {
  iso2: string;
  iso3: string;
  callingCode: string;
  capital: string;
  singleTimezone: boolean;
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

type Props = {
  country: Country;
  holidays: Holiday[];
  travelTips: TravelTip[];
  meta: CountryMeta;
  priceItems: PriceItem[];
  countryPrices: CountryPrice[];
  currencyCode: string | null;
  currencySymbol: string | null;
};

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Detect Korean (Hangul) characters in a string. Used to decide whether a
// raw `note` value (which may be Korean from the gov API) should be hidden
// in the English UI.
function containsKorean(s: string | null | undefined): boolean {
  if (!s) return false;
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(s);
}

// Build the display name for a holiday based on its category.
// DB stores the base name (e.g., "Chuseok") and category separately, so the
// suffix ("eve", "day after") is appended here.
//
// mode = 'short' for calendar cells (uses "sub.")
// mode = 'full'  for list card titles and tooltips (uses "substitute")
function getDisplayName(
  h: Holiday,
  mode: 'short' | 'full',
  byId: Map<number, Holiday>
): string {
  const cat = h.holiday_category;
  const baseName = h.name;

  if (cat === 'eve') {
    return baseName + ' eve';
  }
  if (cat === 'day_after') {
    return baseName + ' day after';
  }
  if (cat === 'substitute' || h.is_substitute) {
    // Two cases:
    // 1. name = "Substitute Holiday (X)" — extract X from parentheses
    // 2. substitute_for_id is set — look up the original holiday by id
    let originalName: string | null = null;

    const parenMatch = baseName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      originalName = parenMatch[1];
    } else if (h.substitute_for_id != null) {
      const original = byId.get(h.substitute_for_id);
      if (original) originalName = original.name;
    }

    if (originalName) {
      return mode === 'short'
        ? `${originalName} sub.`
        : `${originalName} substitute`;
    }
    // Fallback if we can't find the original
    return mode === 'short' ? 'Substitute' : 'Substitute holiday';
  }
  // regular, temporary, observed, or unknown — return as-is
  return baseName;
}

// Build a short, English explanation for a substitute holiday.
// Used in the expanded card body when the raw `note` is Korean.
function buildSubstituteExplanation(
  h: Holiday,
  byId: Map<number, Holiday>
): string | null {
  if (h.holiday_category !== 'substitute' && !h.is_substitute) return null;

  let originalName: string | null = null;
  let originalDate: string | null = null;

  if (h.substitute_for_id != null) {
    const original = byId.get(h.substitute_for_id);
    if (original) {
      originalName = original.name;
      originalDate = original.date;
    }
  }
  if (!originalName) {
    const parenMatch = h.name.match(/\(([^)]+)\)/);
    if (parenMatch) originalName = parenMatch[1];
  }
  if (!originalName) return null;

  const dateStr = originalDate ? formatDateShort(originalDate) : null;
  const datePart = dateStr ? ` (${dateStr})` : '';
  return `This day is a substitute holiday — it replaces ${originalName}${datePart}, which fell on a weekend or overlapped with another holiday.`;
}

function formatDateShort(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

// Get YYYY-MM-DD in a specific IANA timezone (handles DST correctly).
function dateInTimezone(tz: string | null): { y: number; m: number; d: number } {
  const now = new Date();
  if (!tz) {
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }
  // Use Intl.DateTimeFormat for safe timezone conversion
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  return { y, m, d };
}

// Format current time in a target timezone. Returns "HH:MM:SS TZA"
function formatTimeInTimezone(tz: string | null): string {
  if (!tz) return '';
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    return fmt.format(new Date());
  } catch {
    return '';
  }
}

// Format a date "today" line in a given timezone, e.g.,
// "Monday, April 27, 2026"
function formatDateInTimezone(tz: string | null): string {
  if (!tz) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

export default function CountryHolidayView({
  country,
  holidays,
  travelTips,
  meta,
  priceItems,
  countryPrices,
  currencyCode,
  currencySymbol,
}: Props) {
  // Build holidays-by-id lookup once
  const holidayById = useMemo(() => {
    const m = new Map<number, Holiday>();
    for (const h of holidays) m.set(h.id, h);
    return m;
  }, [holidays]);

  // Travel tips index by holiday_id
  const tipByHolidayId = useMemo(() => {
    const m = new Map<number, TravelTip>();
    for (const t of travelTips) m.set(t.holiday_id, t);
    return m;
  }, [travelTips]);

  // Years available based on data
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const h of holidays) set.add(h.year);
    return Array.from(set).sort();
  }, [holidays]);

  // "Today" in the country's timezone (so calendar opens to the *local* today)
  const todayInTz = useMemo(() => dateInTimezone(country.timezone), [country.timezone]);

  // Pick initial year/month: today's if data exists, else closest available year
  const initialYear =
    availableYears.includes(todayInTz.y)
      ? todayInTz.y
      : availableYears[0] || todayInTz.y;
  const initialMonth = availableYears.includes(todayInTz.y) ? todayInTz.m : 1;

  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialMonth);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const cardRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  // Live clock — update every second
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const currentTimeStr = formatTimeInTimezone(country.timezone);
  const currentDateStr = formatDateInTimezone(country.timezone);
  // suppress unused warning — clockTick is just to trigger re-render
  void clockTick;

  // Holidays for the currently-selected month (sorted by date)
  const monthHolidays = useMemo(() => {
    return holidays
      .filter((h) => {
        const [y, m] = h.date.split('-').map(Number);
        return y === year && m === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, year, month]);

  // Lookup holidays by date string for the calendar grid
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of holidays) {
      const list = map.get(h.date) || [];
      list.push(h);
      map.set(h.date, list);
    }
    return map;
  }, [holidays]);

  // Build the calendar grid (always 6 rows × 7 columns to keep height stable)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: Array<{ day: number | null; date: string | null; weekday: number }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, date: null, weekday: i });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: dateStr, weekday: (startWeekday + d - 1) % 7 });
    }
    while (cells.length < 42) {
      cells.push({ day: null, date: null, weekday: cells.length % 7 });
    }
    return cells;
  }, [year, month]);

  function handleDayClick(dateStr: string) {
    const dayHolidays = holidaysByDate.get(dateStr);
    if (!dayHolidays || dayHolidays.length === 0) return;
    const first = dayHolidays[0];
    setHighlightId(first.id);
    setExpandedId(first.id);
    // scroll the matching list card into view
    setTimeout(() => {
      const el = cardRefs.current.get(first.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    // clear highlight after a moment
    setTimeout(() => setHighlightId(null), 1800);
  }

  function goToday() {
    if (availableYears.includes(todayInTz.y)) {
      setYear(todayInTz.y);
      setMonth(todayInTz.m);
    }
  }

  function nav(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    if (availableYears.length > 0) {
      const minY = availableYears[0];
      const maxY = availableYears[availableYears.length - 1];
      if (y < minY) { y = minY; m = 1; }
      if (y > maxY) { y = maxY; m = 12; }
    }
    setYear(y);
    setMonth(m);
  }

  // Today highlight on calendar
  const todayDateStr =
    `${todayInTz.y}-${String(todayInTz.m).padStart(2, '0')}-${String(todayInTz.d).padStart(2, '0')}`;
  const isViewingTodaysMonth = year === todayInTz.y && month === todayInTz.m;

  return (
    <div>
      {/* Time strip — independent, sits above the calendar */}
      {country.timezone && (
        <div className="bg-[#f0ece4] rounded-2xl px-5 py-4 mb-8 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm text-gray-700">
              Current time in {meta.capital}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">{currentDateStr}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-gray-900 tabular-nums">
              {currentTimeStr}
            </div>
            {meta.singleTimezone && (
              <div className="text-xs text-gray-500 mt-0.5">
                All regions in {country.name} share this time
              </div>
            )}
          </div>
        </div>
      )}

      {/* Price guide section */}
      {priceItems.length > 0 && countryPrices.length > 0 && (
        <PriceGuide
          priceItems={priceItems}
          countryPrices={countryPrices}
          currencyCode={currencyCode}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Section heading */}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Holiday calendar
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* LEFT: Calendar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          {/* Calendar nav */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <NavArrowButton direction="prev" onClick={() => nav(-1)} />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-10 px-3 pr-9 border border-gray-300 rounded-lg text-sm font-medium bg-white appearance-none bg-no-repeat bg-[right_0.6rem_center]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-10 px-3 pr-9 border border-gray-300 rounded-lg text-sm font-medium bg-white appearance-none bg-no-repeat bg-[right_0.6rem_center]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
              }}
            >
              {MONTHS_SHORT.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <NavArrowButton direction="next" onClick={() => nav(1)} />
            <button
              onClick={goToday}
              disabled={isViewingTodaysMonth}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Today
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-gray-500">
            {WEEKDAY_HEADERS.map((d, i) => (
              <div
                key={d}
                className={`text-center py-1 font-medium ${i === 0 ? 'text-red-600' : ''}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              const dayHolidays = cell.date ? holidaysByDate.get(cell.date) : null;
              const hasHoliday = !!(dayHolidays && dayHolidays.length > 0);
              const primary = hasHoliday ? dayHolidays![0] : null;
              const isToday = cell.date === todayDateStr;
              const isSunday = cell.weekday === 0;

              const tooltipName = primary
                ? getDisplayName(primary, 'full', holidayById)
                : '';
              const cellLabel = primary
                ? getDisplayName(primary, 'short', holidayById)
                : '';

              return (
                <div
                  key={idx}
                  onClick={() => cell.date && handleDayClick(cell.date)}
                  title={tooltipName || undefined}
                  className={`
                    relative h-[60px] border rounded-md p-1 text-[11px]
                    overflow-hidden
                    ${cell.day === null ? 'border-transparent' : 'border-gray-100'}
                    ${hasHoliday ? 'bg-red-50/70 cursor-pointer hover:bg-red-100/80' : 'hover:bg-gray-50 cursor-default'}
                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-0 border-blue-500' : ''}
                    transition-colors
                  `}
                  style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}
                >
                  {cell.day !== null && (
                    <>
                      <div
                        className={`text-xs font-semibold leading-none mb-0.5 ${
                          hasHoliday
                            ? 'text-red-700'
                            : isSunday
                            ? 'text-red-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {cell.day}
                      </div>
                      {primary && (
                        <div
                          className="text-[10px] leading-tight text-red-700 line-clamp-2"
                          style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}
                        >
                          {cellLabel}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-red-50/70 border border-red-100"></span>
              Holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded ring-2 ring-blue-500"></span>
              Today
            </span>
          </div>
        </div>

        {/* RIGHT: Holiday list for selected month */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">
              Holidays this month
            </h3>
            <div className="text-xs text-gray-500">
              {MONTHS_FULL[month - 1]} {year}
            </div>
          </div>

          {monthHolidays.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl px-4 py-8 text-center text-sm text-gray-500">
              No public holidays this month.
            </div>
          ) : (
            <div className="space-y-2.5">
              {monthHolidays.map((h) => {
                const dayNum = Number(h.date.split('-')[2]);
                const tip = tipByHolidayId.get(h.id);
                const isExpanded = expandedId === h.id;
                const isHighlighted = highlightId === h.id;
                const fullName = getDisplayName(h, 'full', holidayById);
                const subExplanation = buildSubstituteExplanation(h, holidayById);
                const noteIsKorean = containsKorean(h.note);
                const showRawNote = h.note && !noteIsKorean;

                return (
                  <div
                    key={h.id}
                    ref={(el) => {
                      cardRefs.current.set(h.id, el);
                    }}
                    className={`
                      bg-white border rounded-xl overflow-hidden transition-all
                      ${isHighlighted ? 'border-blue-400 shadow-md' : 'border-gray-200'}
                    `}
                  >
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : h.id)
                      }
                      className="w-full flex items-stretch text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-3 border-r border-gray-100">
                        <div className="text-2xl font-bold text-red-700 leading-none">
                          {dayNum}
                        </div>
                      </div>
                      <div className="flex-1 px-3 py-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {fullName}
                            </div>
                            {h.name_local && (
                              <div className="text-[13px] text-gray-600 mt-0.5">
                                {h.name_local}
                              </div>
                            )}
                          </div>
                          <CategoryBadges holiday={h} hasTip={!!tip} />
                        </div>
                      </div>
                      <div className="flex-shrink-0 px-3 flex items-center text-gray-400">
                        {isExpanded ? '▴' : '▾'}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pt-3 pb-4 border-t border-gray-100 text-sm text-gray-700 space-y-3">
                        {tip ? (
                          <TravelTipBody tip={tip} />
                        ) : (
                          <>
                            {subExplanation && (
                              <p className="text-gray-700">{subExplanation}</p>
                            )}
                            {showRawNote && (
                              <p className="text-gray-700">{h.note}</p>
                            )}
                            {!subExplanation && !showRawNote && (
                              <p className="text-gray-500 italic text-[13px]">
                                No additional details yet.
                              </p>
                            )}
                          </>
                        )}

                        {/* Verification details — always show at the bottom
                            of the expanded body so users can audit how the
                            date was sourced. */}
                        <VerificationDetails holiday={h} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function NavArrowButton({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
}) {
  // Chevron pointing left or right.
  // viewBox is 24×24 and the path is drawn close to the edges so the arrow
  // appears to fill almost the entire button.
  const path = direction === 'prev' ? 'M16 4 L7 12 L16 20' : 'M8 4 L17 12 L8 20';
  return (
    <button
      onClick={onClick}
      aria-label={direction === 'prev' ? 'Previous month' : 'Next month'}
      className="h-10 w-10 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors flex items-center justify-center"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#374151"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    </button>
  );
}

function CategoryBadges({
  holiday,
  hasTip,
}: {
  holiday: Holiday;
  hasTip: boolean;
}) {
  const cat = holiday.holiday_category;
  const isSub = holiday.is_substitute || cat === 'substitute';

  const badges: Array<{ label: string; color: string; title?: string }> = [];

  if (cat === 'eve') {
    badges.push({ label: 'Holiday eve', color: 'bg-amber-50 text-amber-700 border-amber-200' });
  } else if (cat === 'day_after') {
    badges.push({ label: 'Day after', color: 'bg-amber-50 text-amber-700 border-amber-200' });
  } else if (isSub) {
    badges.push({ label: 'Substitute', color: 'bg-purple-50 text-purple-700 border-purple-200' });
  } else if (cat === 'temporary') {
    badges.push({ label: 'Temporary', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
  } else {
    badges.push({ label: 'Public holiday', color: 'bg-red-50 text-red-700 border-red-200' });
  }

  // Verification badge — added based on verification_status column.
  // Maps four DB states to four user-facing accuracy levels.
  const vBadge = getVerificationBadge(holiday.verification_status);
  if (vBadge) {
    badges.push(vBadge);
  }

  if (hasTip) {
    badges.push({ label: 'Travel tip', color: 'bg-blue-50 text-blue-700 border-blue-200' });
  }

  return (
    <div className="flex flex-wrap gap-1 justify-end items-center">
      {badges.map((b) => (
        <span
          key={b.label}
          title={b.title}
          className={`px-2 py-0.5 text-[10px] font-medium border rounded-full whitespace-nowrap ${b.color}`}
        >
          {b.label}
        </span>
      ))}
      {holiday.manual_locked && (
        <span
          title="Manually locked — protected from automated overwrites"
          className="text-[11px] text-gray-400"
        >
          🔒
        </span>
      )}
    </div>
  );
}

// Map DB verification_status to a UI badge.
// - verified_high: all available sources agree → "Confirmed" (green)
// - verified_mid:  two sources agree → "Verified" (blue)
// - single_source: only one source → "Tentative" (amber)
// - pending:       not yet cross-checked → "Unverified" (gray)
// - null/other:    no badge
function getVerificationBadge(
  status: string | null
): { label: string; color: string; title: string } | null {
  if (!status) return null;
  switch (status) {
    case 'verified_high':
      return {
        label: 'Confirmed',
        color: 'bg-green-50 text-green-700 border-green-200',
        title: 'Confirmed — multiple authoritative sources agree on this date',
      };
    case 'verified_mid':
      return {
        label: 'Verified',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        title: 'Verified — two sources agree on this date',
      };
    case 'single_source':
      return {
        label: 'Tentative',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        title: 'Tentative — based on a single source. Confirm with an official source before booking.',
      };
    case 'pending':
      return {
        label: 'Unverified',
        color: 'bg-gray-50 text-gray-600 border-gray-200',
        title: 'Unverified — not yet cross-checked against multiple sources. Verify with an official source before booking.',
      };
    default:
      return null;
  }
}

function TravelTipBody({ tip }: { tip: TravelTip }) {
  return (
    <div className="space-y-3">
      {tip.what_is_it && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
            What it is
          </div>
          <p className="text-sm text-gray-700">{tip.what_is_it}</p>
        </div>
      )}
      {tip.traveler_impact && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
            Traveler impact
          </div>
          <p className="text-sm text-gray-700">{tip.traveler_impact}</p>
        </div>
      )}
      {tip.cautions && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
            Cautions
          </div>
          <p className="text-sm text-gray-700">{tip.cautions}</p>
        </div>
      )}
      {tip.recommendations && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
            Recommendations
          </div>
          <p className="text-sm text-gray-700">{tip.recommendations}</p>
        </div>
      )}
      {tip.practical_tips && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-800 font-semibold mb-1">
            Practical tips
          </div>
          <p className="text-sm text-amber-900">{tip.practical_tips}</p>
        </div>
      )}
      {tip.tips && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
            Tips
          </div>
          <p className="text-sm text-gray-700">{tip.tips}</p>
        </div>
      )}
      {tip.source_urls && tip.source_urls.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
            Sources
          </div>
          <ul className="space-y-1">
            {tip.source_urls.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// VerificationDetails — small footer block in each expanded card explaining
// how the date was verified. Appears below travel tip / explanation content.
//
// Reads from holiday.verification_status, verification_sources (jsonb),
// data_source, and verified_at. Stays silent if there's nothing useful to
// show (e.g., legacy rows with no metadata).
function VerificationDetails({ holiday }: { holiday: Holiday }) {
  const status = holiday.verification_status;
  const sources = holiday.verification_sources;
  const dataSource = holiday.data_source;
  const verifiedAt = holiday.verified_at;

  // If we have absolutely nothing to show, render nothing.
  if (!status && !sources && !dataSource) return null;

  const sourceLabel = formatDataSource(dataSource);
  const checkedSources: string[] = [];
  if (sources?.db) checkedSources.push('Database');
  if (sources?.wikipedia) checkedSources.push('Wikipedia');
  if (sources?.nager) checkedSources.push('Nager.Date');

  const verifiedDate = verifiedAt ? formatVerifiedDate(verifiedAt) : null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
        Data verification
      </div>
      <dl className="text-[12px] text-gray-600 space-y-1">
        {sourceLabel && (
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">Source</dt>
            <dd>{sourceLabel}</dd>
          </div>
        )}
        {checkedSources.length > 0 && (
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">Verified by</dt>
            <dd>{checkedSources.join(', ')}</dd>
          </div>
        )}
        {verifiedDate && (
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">Last checked</dt>
            <dd>{verifiedDate}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function formatDataSource(src: string | null): string | null {
  if (!src) return null;
  // Map raw DB values to user-friendly labels
  const map: Record<string, string> = {
    korea_official: 'Korean government (Astronomical Research Institute)',
    'nager.date': 'Nager.Date public holiday API',
    nager_date: 'Nager.Date public holiday API',
    wikipedia_classified: 'Wikipedia (cross-checked & classified)',
    wikipedia: 'Wikipedia',
  };
  return map[src] || src;
}

function formatVerifiedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

// ============================================================
// PriceGuide — tabbed price comparison section
// ============================================================

// Emoji icons per price item key. Same-category items share one emoji.
const PRICE_ICONS: Record<string, string> = {
  meal_local:        '🍜',
  bigmac:           '🍔',
  starbucks_latte:  '☕',
  beer_bar:         '🍺',
  beer_convenience: '🍺',   // same as bar
  transit_single:   '🚇',
  taxi_start:       '🚕',
  airport_city:     '✈️',
  water_convenience:'💧',
  water_supermarket:'💧',   // same as convenience
  coke_convenience: '🥤',
  coke_supermarket: '🥤',   // same as convenience
  sim_7day:         '📱',
  attraction:       '🎟️',
};

const CATEGORIES = [
  { key: 'food',      label: '🍽 Food & drink',   keys: ['meal_local','bigmac','starbucks_latte','beer_bar','beer_convenience'] },
  { key: 'transport', label: '🚇 Transport',       keys: ['transit_single','taxi_start','airport_city'] },
  { key: 'grocery',   label: '🛒 Grocery & SIM',   keys: ['water_convenience','water_supermarket','coke_convenience','coke_supermarket','sim_7day','attraction'] },
  { key: 'stay',      label: '🏨 Where to stay',   keys: [] },
];

function fmtUSD(min: number | null, max: number | null): string {
  if (min === null && max === null) return '—';
  const fmt = (n: number) =>
    n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;
  if (min === null) return fmt(max!);
  if (max === null || min === max) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

function fmtLocal(
  min: number | null,
  max: number | null,
  symbol: string | null,
  code: string | null
): string {
  if (min === null && max === null) return '';
  const prefix = symbol || code || '';
  const fmt = (n: number) =>
    `${prefix} ${n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2)}`;
  if (min === null) return fmt(max!);
  if (max === null || min === max) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

function PriceGuide({
  priceItems,
  countryPrices,
  currencyCode,
  currencySymbol,
}: {
  priceItems: PriceItem[];
  countryPrices: CountryPrice[];
  currencyCode: string | null;
  currencySymbol: string | null;
}) {
  const [activeTab, setActiveTab] = useState<string>('food');

  // Build lookup: key → price row
  const itemById = useMemo(
    () => new Map(priceItems.map((i) => [i.id, i])),
    [priceItems]
  );
  const priceByKey = useMemo(() => {
    const m = new Map<string, CountryPrice>();
    for (const p of countryPrices) {
      if (p.price_item_id == null) continue;
      const item = itemById.get(p.price_item_id);
      if (item) m.set(item.key, p);
    }
    return m;
  }, [countryPrices, itemById]);

  // Transport tips row
  const transportTips = useMemo(
    () => countryPrices.find((p) => p.price_item_id === null)?.transport_tips || null,
    [countryPrices]
  );

  // Build lookup: key → item name
  const nameByKey = useMemo(
    () => new Map(priceItems.map((i) => [i.key, i.name_en])),
    [priceItems]
  );

  const sym = currencySymbol || currencyCode || '';

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Price guide</h2>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`text-xs font-medium px-4 py-1.5 rounded-full border transition-colors ${
              activeTab === cat.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Food / Transport / Grocery panels */}
      {CATEGORIES.filter((c) => c.key !== 'stay').map((cat) => (
        <div key={cat.key} className={activeTab === cat.key ? '' : 'hidden'}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cat.keys.map((key) => {
              const p = priceByKey.get(key);
              const name = nameByKey.get(key) || key;
              return (
                <div
                  key={key}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="text-xl mb-2">{PRICE_ICONS[key] || '•'}</div>
                  <div className="text-[11px] text-gray-500 mb-1 leading-tight">{name}</div>
                  {p?.local_brand && (
                    <div className="text-[10px] text-gray-400 mb-1">{p.local_brand}</div>
                  )}
                  <div className="text-base font-semibold text-gray-900">
                    {fmtUSD(p?.price_usd_min ?? null, p?.price_usd_max ?? null)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {fmtLocal(
                      p?.price_local_min ?? null,
                      p?.price_local_max ?? null,
                      sym,
                      currencyCode
                    )}
                  </div>
                  {p?.notes && (
                    <div className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100 leading-snug">
                      {p.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Transport tips block */}
          {cat.key === 'transport' && transportTips && (
            <div className="mt-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="text-[11px] text-gray-500 font-medium mb-1.5">
                🗺 Getting around
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{transportTips}</p>
            </div>
          )}
        </div>
      ))}

      {/* Where to stay */}
      {activeTab === 'stay' && (
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-700">
              🏨 Hotel prices vary widely — from budget guesthouses to luxury city hotels.
            </p>
            <a
              href={`https://www.booking.com/country/${(currencyCode || 'us').toLowerCase().slice(0,2)}.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-xs font-medium px-4 py-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-gray-900 whitespace-nowrap"
            >
              Browse hotels →
            </a>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-700">
              🛏 Traveling on a budget? Hostels and guesthouses from around $15/night.
            </p>
            <a
              href="https://www.hostelworld.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-xs font-medium px-4 py-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-gray-900 whitespace-nowrap"
            >
              Browse hostels →
            </a>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3">
        Prices are approximate reference values and may vary by location, season, and provider.
      </p>
    </div>
  );
}
