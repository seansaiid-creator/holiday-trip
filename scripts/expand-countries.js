require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 확장할 국가 리스트 (45개 추가, 기존 5개 + 45개 = 50개)
const NEW_COUNTRIES = [
  // 아시아
  { code: 'CN', name: 'China', name_local: '中国', currency_code: 'CNY', currency_symbol: '¥', voltage: '220V', plug_types: 'A, C, I', timezone: 'Asia/Shanghai', emoji_flag: '🇨🇳', description: 'The world\'s most populous country with ancient history and modern marvels.' },
  { code: 'VN', name: 'Vietnam', name_local: 'Việt Nam', currency_code: 'VND', currency_symbol: '₫', voltage: '220V', plug_types: 'A, C, F', timezone: 'Asia/Ho_Chi_Minh', emoji_flag: '🇻🇳', description: 'Southeast Asian gem with stunning landscapes, rich culture, and delicious cuisine.' },
  { code: 'SG', name: 'Singapore', name_local: 'Singapore', currency_code: 'SGD', currency_symbol: 'S$', voltage: '230V', plug_types: 'G', timezone: 'Asia/Singapore', emoji_flag: '🇸🇬', description: 'Modern city-state known for its cleanliness, diversity, and world-class cuisine.' },
  { code: 'MY', name: 'Malaysia', name_local: 'Malaysia', currency_code: 'MYR', currency_symbol: 'RM', voltage: '240V', plug_types: 'G', timezone: 'Asia/Kuala_Lumpur', emoji_flag: '🇲🇾', description: 'Multicultural nation with pristine beaches, rainforests, and modern cities.' },
  { code: 'ID', name: 'Indonesia', name_local: 'Indonesia', currency_code: 'IDR', currency_symbol: 'Rp', voltage: '230V', plug_types: 'C, F', timezone: 'Asia/Jakarta', emoji_flag: '🇮🇩', description: 'Archipelago of over 17,000 islands with diverse cultures and tropical beauty.' },
  { code: 'PH', name: 'Philippines', name_local: 'Pilipinas', currency_code: 'PHP', currency_symbol: '₱', voltage: '220V', plug_types: 'A, B, C', timezone: 'Asia/Manila', emoji_flag: '🇵🇭', description: 'Tropical paradise with over 7,000 islands, white beaches, and friendly locals.' },
  { code: 'IN', name: 'India', name_local: 'भारत', currency_code: 'INR', currency_symbol: '₹', voltage: '230V', plug_types: 'C, D, M', timezone: 'Asia/Kolkata', emoji_flag: '🇮🇳', description: 'Land of diverse cultures, ancient history, and spiritual heritage.' },
  { code: 'HK', name: 'Hong Kong', name_local: '香港', currency_code: 'HKD', currency_symbol: 'HK$', voltage: '220V', plug_types: 'G', timezone: 'Asia/Hong_Kong', emoji_flag: '🇭🇰', description: 'Vibrant metropolis where East meets West, famous for skyline and cuisine.' },
  { code: 'TW', name: 'Taiwan', name_local: '台灣', currency_code: 'TWD', currency_symbol: 'NT$', voltage: '110V', plug_types: 'A, B', timezone: 'Asia/Taipei', emoji_flag: '🇹🇼', description: 'Island nation with night markets, tech innovation, and beautiful mountains.' },
  
  // 유럽
  { code: 'GB', name: 'United Kingdom', name_local: 'United Kingdom', currency_code: 'GBP', currency_symbol: '£', voltage: '230V', plug_types: 'G', timezone: 'Europe/London', emoji_flag: '🇬🇧', description: 'Historic nation of castles, royal heritage, and cultural diversity.' },
  { code: 'DE', name: 'Germany', name_local: 'Deutschland', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Berlin', emoji_flag: '🇩🇪', description: 'Central European powerhouse known for engineering, beer, and fairytale castles.' },
  { code: 'IT', name: 'Italy', name_local: 'Italia', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'F, L', timezone: 'Europe/Rome', emoji_flag: '🇮🇹', description: 'Home of Renaissance art, delicious cuisine, and ancient Roman history.' },
  { code: 'ES', name: 'Spain', name_local: 'España', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Madrid', emoji_flag: '🇪🇸', description: 'Passionate country of flamenco, tapas, and stunning Mediterranean beaches.' },
  { code: 'NL', name: 'Netherlands', name_local: 'Nederland', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Amsterdam', emoji_flag: '🇳🇱', description: 'Land of windmills, canals, tulips, and progressive culture.' },
  { code: 'BE', name: 'Belgium', name_local: 'België', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, E', timezone: 'Europe/Brussels', emoji_flag: '🇧🇪', description: 'Heart of Europe, famous for chocolate, waffles, beer, and medieval towns.' },
  { code: 'CH', name: 'Switzerland', name_local: 'Schweiz', currency_code: 'CHF', currency_symbol: 'Fr', voltage: '230V', plug_types: 'C, J', timezone: 'Europe/Zurich', emoji_flag: '🇨🇭', description: 'Alpine paradise known for precision, chocolate, and breathtaking mountains.' },
  { code: 'AT', name: 'Austria', name_local: 'Österreich', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Vienna', emoji_flag: '🇦🇹', description: 'Musical heritage, imperial palaces, and stunning Alpine scenery.' },
  { code: 'PT', name: 'Portugal', name_local: 'Portugal', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Lisbon', emoji_flag: '🇵🇹', description: 'Iberian nation of colorful cities, coastal beauty, and maritime history.' },
  { code: 'GR', name: 'Greece', name_local: 'Ελλάδα', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Athens', emoji_flag: '🇬🇷', description: 'Cradle of Western civilization with stunning islands and ancient ruins.' },
  { code: 'SE', name: 'Sweden', name_local: 'Sverige', currency_code: 'SEK', currency_symbol: 'kr', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Stockholm', emoji_flag: '🇸🇪', description: 'Scandinavian nation of design, nature, and progressive values.' },
  { code: 'NO', name: 'Norway', name_local: 'Norge', currency_code: 'NOK', currency_symbol: 'kr', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Oslo', emoji_flag: '🇳🇴', description: 'Land of fjords, northern lights, and Viking heritage.' },
  { code: 'DK', name: 'Denmark', name_local: 'Danmark', currency_code: 'DKK', currency_symbol: 'kr', voltage: '230V', plug_types: 'C, K', timezone: 'Europe/Copenhagen', emoji_flag: '🇩🇰', description: 'Scandinavian kingdom of hygge, design, and fairy tales.' },
  { code: 'FI', name: 'Finland', name_local: 'Suomi', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Helsinki', emoji_flag: '🇫🇮', description: 'Nordic nation of saunas, lakes, and the magical northern lights.' },
  { code: 'IS', name: 'Iceland', name_local: 'Ísland', currency_code: 'ISK', currency_symbol: 'kr', voltage: '230V', plug_types: 'C, F', timezone: 'Atlantic/Reykjavik', emoji_flag: '🇮🇸', description: 'Land of fire and ice with geysers, volcanoes, and glaciers.' },
  { code: 'IE', name: 'Ireland', name_local: 'Éire', currency_code: 'EUR', currency_symbol: '€', voltage: '230V', plug_types: 'G', timezone: 'Europe/Dublin', emoji_flag: '🇮🇪', description: 'Emerald Isle of ancient castles, friendly pubs, and stunning coastlines.' },
  { code: 'PL', name: 'Poland', name_local: 'Polska', currency_code: 'PLN', currency_symbol: 'zł', voltage: '230V', plug_types: 'C, E', timezone: 'Europe/Warsaw', emoji_flag: '🇵🇱', description: 'Central European country with rich history and beautiful medieval cities.' },
  { code: 'CZ', name: 'Czech Republic', name_local: 'Česká republika', currency_code: 'CZK', currency_symbol: 'Kč', voltage: '230V', plug_types: 'C, E', timezone: 'Europe/Prague', emoji_flag: '🇨🇿', description: 'Bohemian nation of Gothic architecture, beer culture, and Prague\'s beauty.' },
  { code: 'HU', name: 'Hungary', name_local: 'Magyarország', currency_code: 'HUF', currency_symbol: 'Ft', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Budapest', emoji_flag: '🇭🇺', description: 'Central European gem with thermal baths, unique cuisine, and rich history.' },
  { code: 'TR', name: 'Turkey', name_local: 'Türkiye', currency_code: 'TRY', currency_symbol: '₺', voltage: '230V', plug_types: 'C, F', timezone: 'Europe/Istanbul', emoji_flag: '🇹🇷', description: 'Transcontinental nation bridging Europe and Asia with stunning heritage.' },
  { code: 'RU', name: 'Russia', name_local: 'Россия', currency_code: 'RUB', currency_symbol: '₽', voltage: '220V', plug_types: 'C, F', timezone: 'Europe/Moscow', emoji_flag: '🇷🇺', description: 'Largest country in the world with vast landscapes and rich cultural heritage.' },
  
  // 아메리카
  { code: 'CA', name: 'Canada', name_local: 'Canada', currency_code: 'CAD', currency_symbol: 'C$', voltage: '120V', plug_types: 'A, B', timezone: 'America/Toronto', emoji_flag: '🇨🇦', description: 'Vast northern country of natural wonders and multicultural cities.' },
  { code: 'MX', name: 'Mexico', name_local: 'México', currency_code: 'MXN', currency_symbol: '$', voltage: '127V', plug_types: 'A, B', timezone: 'America/Mexico_City', emoji_flag: '🇲🇽', description: 'Vibrant nation of ancient civilizations, beaches, and colorful traditions.' },
  { code: 'BR', name: 'Brazil', name_local: 'Brasil', currency_code: 'BRL', currency_symbol: 'R$', voltage: '127V/220V', plug_types: 'C, N', timezone: 'America/Sao_Paulo', emoji_flag: '🇧🇷', description: 'South American giant with Amazon rainforest, carnivals, and stunning beaches.' },
  { code: 'AR', name: 'Argentina', name_local: 'Argentina', currency_code: 'ARS', currency_symbol: '$', voltage: '220V', plug_types: 'C, I', timezone: 'America/Argentina/Buenos_Aires', emoji_flag: '🇦🇷', description: 'Land of tango, steak, and breathtaking Patagonian landscapes.' },
  { code: 'CL', name: 'Chile', name_local: 'Chile', currency_code: 'CLP', currency_symbol: '$', voltage: '220V', plug_types: 'C, L', timezone: 'America/Santiago', emoji_flag: '🇨🇱', description: 'Long narrow country with diverse landscapes from desert to glaciers.' },
  { code: 'CO', name: 'Colombia', name_local: 'Colombia', currency_code: 'COP', currency_symbol: '$', voltage: '110V', plug_types: 'A, B', timezone: 'America/Bogota', emoji_flag: '🇨🇴', description: 'Coffee paradise with vibrant culture, diverse landscapes, and warm people.' },
  { code: 'PE', name: 'Peru', name_local: 'Perú', currency_code: 'PEN', currency_symbol: 'S/', voltage: '220V', plug_types: 'A, B, C', timezone: 'America/Lima', emoji_flag: '🇵🇪', description: 'Andean nation home to Machu Picchu and incredible ancient civilizations.' },
  
  // 오세아니아
  { code: 'AU', name: 'Australia', name_local: 'Australia', currency_code: 'AUD', currency_symbol: 'A$', voltage: '230V', plug_types: 'I', timezone: 'Australia/Sydney', emoji_flag: '🇦🇺', description: 'Island continent with unique wildlife, stunning beaches, and outback adventures.' },
  { code: 'NZ', name: 'New Zealand', name_local: 'New Zealand', currency_code: 'NZD', currency_symbol: 'NZ$', voltage: '230V', plug_types: 'I', timezone: 'Pacific/Auckland', emoji_flag: '🇳🇿', description: 'Pristine natural beauty with stunning mountains, fjords, and Maori heritage.' },
  
  // 중동/아프리카
  { code: 'AE', name: 'United Arab Emirates', name_local: 'الإمارات', currency_code: 'AED', currency_symbol: 'د.إ', voltage: '220V', plug_types: 'C, D, G', timezone: 'Asia/Dubai', emoji_flag: '🇦🇪', description: 'Modern desert nation of futuristic cities and luxury experiences.' },
  { code: 'SA', name: 'Saudi Arabia', name_local: 'السعودية', currency_code: 'SAR', currency_symbol: 'ر.س', voltage: '127V/220V', plug_types: 'A, B, F, G', timezone: 'Asia/Riyadh', emoji_flag: '🇸🇦', description: 'Birthplace of Islam with ancient heritage and modern transformation.' },
  { code: 'IL', name: 'Israel', name_local: 'ישראל', currency_code: 'ILS', currency_symbol: '₪', voltage: '230V', plug_types: 'C, H', timezone: 'Asia/Jerusalem', emoji_flag: '🇮🇱', description: 'Holy land of three religions with rich history and Mediterranean beaches.' },
  { code: 'EG', name: 'Egypt', name_local: 'مصر', currency_code: 'EGP', currency_symbol: 'E£', voltage: '220V', plug_types: 'C, F', timezone: 'Africa/Cairo', emoji_flag: '🇪🇬', description: 'Ancient civilization of pharaohs, pyramids, and the legendary Nile.' },
  { code: 'ZA', name: 'South Africa', name_local: 'South Africa', currency_code: 'ZAR', currency_symbol: 'R', voltage: '230V', plug_types: 'C, D, M, N', timezone: 'Africa/Johannesburg', emoji_flag: '🇿🇦', description: 'Rainbow nation with diverse wildlife, landscapes, and rich cultural heritage.' },
  { code: 'MA', name: 'Morocco', name_local: 'المغرب', currency_code: 'MAD', currency_symbol: 'د.م', voltage: '127V/220V', plug_types: 'C, E', timezone: 'Africa/Casablanca', emoji_flag: '🇲🇦', description: 'North African gem of vibrant souks, Sahara deserts, and Atlas Mountains.' }
];

async function expandCountries() {
  console.log('Adding new countries...\n');

  let addedCount = 0;
  let skippedCount = 0;

  for (const country of NEW_COUNTRIES) {
    const { data: existing } = await supabase
      .from('countries')
      .select('id')
      .eq('code', country.code)
      .single();

    if (existing) {
      console.log(`○ ${country.code} already exists, skipping`);
      skippedCount++;
      continue;
    }

    const { error } = await supabase.from('countries').insert({
      ...country,
      is_active: true
    });

    if (error) {
      console.error(`✗ ${country.code}: ${error.message}`);
    } else {
      console.log(`✓ Added ${country.code} - ${country.name}`);
      addedCount++;
    }
  }

  console.log(`\nDone! Added: ${addedCount}, Skipped: ${skippedCount}`);
}

expandCountries();