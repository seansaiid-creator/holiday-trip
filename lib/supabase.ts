import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 타입 정의
export type Country = {
  id: number;
  code: string;
  name: string;
  name_local: string;
  currency_code: string;
  currency_symbol: string;
  voltage: string;
  plug_types: string;
  timezone: string;
  emoji_flag: string;
  description: string;
};

export type Holiday = {
  id: number;
  country_id: number;
  date: string;
  name: string;
  name_local: string;
  type: string;
  year: number;
};