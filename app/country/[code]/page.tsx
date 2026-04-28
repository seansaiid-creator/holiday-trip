import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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

  const [holidays, travelTips] = await Promise.all([
    getHolidays(country.id),
    getTravelTips(country.id),
  ]);

  const meta: CountryMeta = COUNTRY_META[code] || {
    iso2: code,
    iso3: code,
    callingCode: '',
    capital: country.name,
    singleTimezone: false,
  };

  return (
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
            <InfoCard
              label="Currency"
              value={
                country.currency_code
                  ? `${country.currency_code}${country.currency_symbol ? ' ' + country.currency_symbol : ''}`
                  : '—'
              }
            />
            <InfoCard label="Voltage" value={country.voltage || '—'} />
            <InfoCard label="Plug type" value={country.plug_types || '—'} />
            <InfoCard label="Timezone" value={shortTimezone(country.timezone)} />
          </div>
        </div>

        {/* Interactive view (calendar + list) */}
        <CountryHolidayView
          country={country}
          holidays={holidays}
          travelTips={travelTips}
          meta={meta}
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
