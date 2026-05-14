/**
 * generate-travel-tips-all.js
 *
 * Generates travel tips for remaining 39 countries.
 *
 * USAGE
 *   node scripts/generate-travel-tips-all.js              # all
 *   node scripts/generate-travel-tips-all.js --only=JP    # one country
 *   node scripts/generate-travel-tips-all.js --dry-run    # test only
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/sgemini-2.5-flash-liteupabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI    = new GoogleGenerativeAI(GEMINI_KEY);
const model    = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const TARGETS_BY_COUNTRY = {
  AR: [
    { key: 'ar_newyear',      match_name: "New Year's Day" },
    { key: 'ar_carnival',     match_name: 'Carnival' },
    { key: 'ar_truth',        match_name: 'Day of Remembrance for Truth and Justice' },
    { key: 'ar_malvinas',     match_name: 'Day of the Veterans and Fallen of the Malvinas War' },
    { key: 'ar_labour',       match_name: 'Labour Day' },
    { key: 'ar_mayrev',       match_name: 'May Revolution' },
    { key: 'ar_belgrano',     match_name: 'General Manuel Belgrano Memorial Day' },
    { key: 'ar_independence', match_name: 'Independence Day' },
    { key: 'ar_sanmartin',    match_name: 'General José de San Martín Memorial Day' },
    { key: 'ar_diversity',    match_name: 'Day of Respect for Cultural Diversity' },
    { key: 'ar_sovereignty',  match_name: 'National Sovereignty Day' },
    { key: 'ar_guemes',       match_name: 'Anniversary of the Passing of General Martín Miguel de Güemes' },
    { key: 'ar_goodfriday',   match_name: 'Good Friday' },
    { key: 'ar_immaculate',   match_name: 'Immaculate Conception Day' },
    { key: 'ar_christmas',    match_name: 'Christmas Day' },
  ],
  AT: [
    { key: 'at_newyear',     match_name: "New Year's Day" },
    { key: 'at_epiphany',    match_name: 'Epiphany' },
    { key: 'at_easter',      match_name: 'Easter Monday' },
    { key: 'at_labour',      match_name: 'Labour Day' },
    { key: 'at_ascension',   match_name: 'Ascension Day' },
    { key: 'at_whit',        match_name: 'Whit Monday' },
    { key: 'at_corpus',      match_name: 'Corpus Christi' },
    { key: 'at_assumption',  match_name: 'Assumption Day' },
    { key: 'at_national',    match_name: 'National Holiday' },
    { key: 'at_allsaints',   match_name: "All Saints' Day" },
    { key: 'at_immaculate',  match_name: 'Immaculate Conception' },
    { key: 'at_christmas',   match_name: 'Christmas Day' },
    { key: 'at_ststephen',   match_name: "St. Stephen's Day" },
  ],
  BE: [
    { key: 'be_newyear',     match_name: "New Year's Day" },
    { key: 'be_easter',      match_name: 'Easter Monday' },
    { key: 'be_labour',      match_name: 'Labour Day' },
    { key: 'be_ascension',   match_name: 'Ascension Day' },
    { key: 'be_whit',        match_name: 'Whit Monday' },
    { key: 'be_national',    match_name: 'Belgian National Day' },
    { key: 'be_assumption',  match_name: 'Assumption Day' },
    { key: 'be_allsaints',   match_name: "All Saints' Day" },
    { key: 'be_armistice',   match_name: 'Armistice Day' },
    { key: 'be_christmas',   match_name: 'Christmas Day' },
  ],
  BR: [
    { key: 'br_newyear',     match_name: "New Year's Day" },
    { key: 'br_goodfriday',  match_name: 'Good Friday' },
    { key: 'br_tiradentes',  match_name: 'Tiradentes' },
    { key: 'br_labour',      match_name: 'Labour Day' },
    { key: 'br_corpus',      match_name: 'Corpus Christi' },
    { key: 'br_aparecida',   match_name: 'Our Lady of Aparecida' },
    { key: 'br_allsouls',    match_name: "All Souls' Day" },
    { key: 'br_republic',    match_name: 'Republic Proclamation Day' },
    { key: 'br_blackaware',  match_name: 'Black Awareness Day' },
    { key: 'br_independence',match_name: 'Independence Day' },
    { key: 'br_christmas',   match_name: 'Christmas Day' },
  ],
  CA: [
    { key: 'ca_newyear',     match_name: "New Year's Day" },
    { key: 'ca_victoria',    match_name: 'Victoria Day' },
    { key: 'ca_canada',      match_name: 'Canada Day' },
    { key: 'ca_labour',      match_name: 'Labour Day' },
    { key: 'ca_truth',       match_name: 'National Day for Truth and Reconciliation' },
    { key: 'ca_thanksgiving',match_name: 'Thanksgiving' },
    { key: 'ca_goodfriday',  match_name: 'Good Friday' },
    { key: 'ca_christmas',   match_name: 'Christmas Day' },
  ],
  CH: [
    { key: 'ch_newyear',     match_name: "New Year's Day" },
    { key: 'ch_goodfriday',  match_name: 'Good Friday' },
    { key: 'ch_easter',      match_name: 'Easter Monday' },
    { key: 'ch_ascension',   match_name: 'Ascension Day' },
    { key: 'ch_whit',        match_name: 'Whit Monday' },
    { key: 'ch_national',    match_name: 'Swiss National Day' },
    { key: 'ch_christmas',   match_name: 'Christmas Day' },
    { key: 'ch_ststephen',   match_name: "St. Stephen's Day" },
  ],
  CL: [
    { key: 'cl_newyear',     match_name: "New Year's Day" },
    { key: 'cl_goodfriday',  match_name: 'Good Friday' },
    { key: 'cl_labour',      match_name: 'Labour Day' },
    { key: 'cl_navyday',     match_name: 'Navy Day' },
    { key: 'cl_indigenous',  match_name: 'National Day of Indigenous Peoples' },
    { key: 'cl_national',    match_name: 'National holiday' },
    { key: 'cl_assumption',  match_name: 'Assumption of Mary' },
    { key: 'cl_columbus',    match_name: 'Columbus Day' },
    { key: 'cl_reformation', match_name: 'Reformation Day' },
    { key: 'cl_allsaints',   match_name: 'All Saints Day' },
    { key: 'cl_immaculate',  match_name: 'Immaculate Conception' },
    { key: 'cl_christmas',   match_name: 'Christmas Day' },
  ],
  CN: [
    { key: 'cn_newyear',     match_name: "New Year's Day" },
    { key: 'cn_springfest',  match_name: 'Chinese New Year (Spring Festival)' },
    { key: 'cn_tomb',        match_name: 'Tomb-Sweeping Day' },
    { key: 'cn_labour',      match_name: 'Labour Day' },
    { key: 'cn_dragonboat',  match_name: 'Dragon Boat Festival' },
    { key: 'cn_midautumn',   match_name: 'Mid-Autumn Festival' },
    { key: 'cn_national',    match_name: 'National Day' },
  ],
  CO: [
    { key: 'co_newyear',     match_name: "New Year's Day" },
    { key: 'co_epiphany',    match_name: 'Epiphany' },
    { key: 'co_stjoseph',    match_name: "Saint Joseph's Day" },
    { key: 'co_goodfriday',  match_name: 'Good Friday' },
    { key: 'co_labour',      match_name: 'Labour Day' },
    { key: 'co_ascension',   match_name: 'Ascension Day' },
    { key: 'co_corpus',      match_name: 'Corpus Christi' },
    { key: 'co_sacred',      match_name: 'Sacred Heart' },
    { key: 'co_stpeter',     match_name: 'Saint Peter and Saint Paul' },
    { key: 'co_independence', match_name: 'Declaration of Independence' },
    { key: 'co_boyaca',      match_name: 'Battle of Boyacá' },
    { key: 'co_assumption',  match_name: 'Assumption of Mary' },
    { key: 'co_columbus',    match_name: 'Columbus Day' },
    { key: 'co_allsaints',   match_name: "All Saints' Day" },
    { key: 'co_cartagena',   match_name: 'Independence of Cartagena' },
    { key: 'co_immaculate',  match_name: 'Immaculate Conception' },
    { key: 'co_christmas',   match_name: 'Christmas Day' },
  ],
  CZ: [
    { key: 'cz_newyear',     match_name: "New Year's Day" },
    { key: 'cz_goodfriday',  match_name: 'Good Friday' },
    { key: 'cz_easter',      match_name: 'Easter Monday' },
    { key: 'cz_labour',      match_name: 'Labour Day' },
    { key: 'cz_liberation',  match_name: 'Liberation Day' },
    { key: 'cz_cyril',       match_name: 'Saints Cyril and Methodius Day' },
    { key: 'cz_hus',         match_name: 'Jan Hus Day' },
    { key: 'cz_statehood',   match_name: 'Independent Czechoslovak State Day' },
    { key: 'cz_wenceslas',   match_name: "St. Wenceslas Day" },
    { key: 'cz_freedom',     match_name: 'Struggle for Freedom and Democracy Day' },
    { key: 'cz_christmas',   match_name: 'Christmas Day' },
    { key: 'cz_ststephen',   match_name: "St. Stephen's Day" },
  ],
  DK: [
    { key: 'dk_newyear',     match_name: "New Year's Day" },
    { key: 'dk_maundythurs', match_name: 'Maundy Thursday' },
    { key: 'dk_goodfriday',  match_name: 'Good Friday' },
    { key: 'dk_easter',      match_name: 'Easter Monday' },
    { key: 'dk_ascension',   match_name: 'Ascension Day' },
    { key: 'dk_whit',        match_name: 'Whit Monday' },
    { key: 'dk_christmas',   match_name: 'Christmas Day' },
    { key: 'dk_ststephen',   match_name: "St. Stephen's Day" },
  ],
  EG: [
    { key: 'eg_newyear',     match_name: 'New Year' },
    { key: 'eg_labour',      match_name: 'Labour Day' },
    { key: 'eg_revolution',  match_name: 'Revolution Day' },
    { key: 'eg_armedforces', match_name: 'Armed Forces Day' },
    { key: 'eg_sinai',       match_name: 'Sinai Liberation Day' },
    { key: 'eg_june30',      match_name: 'June 30 Revolution' },
    { key: 'eg_christmas',   match_name: 'Christmas Day (Orthodox)' },
  ],
  ES: [
    { key: 'es_newyear',     match_name: "New Year's Day" },
    { key: 'es_epiphany',    match_name: 'Epiphany' },
    { key: 'es_goodfriday',  match_name: 'Good Friday' },
    { key: 'es_labour',      match_name: 'Labour Day' },
    { key: 'es_assumption',  match_name: 'Assumption' },
    { key: 'es_national',    match_name: 'National Day of Spain' },
    { key: 'es_allsaints',   match_name: 'All Saints Day' },
    { key: 'es_constitution',match_name: 'Constitution Day' },
    { key: 'es_immaculate',  match_name: 'Immaculate Conception' },
    { key: 'es_christmas',   match_name: 'Christmas Day' },
  ],
  FI: [
    { key: 'fi_newyear',     match_name: "New Year's Day" },
    { key: 'fi_epiphany',    match_name: 'Epiphany' },
    { key: 'fi_goodfriday',  match_name: 'Good Friday' },
    { key: 'fi_easter',      match_name: 'Easter Monday' },
    { key: 'fi_mayday',      match_name: 'May Day' },
    { key: 'fi_ascension',   match_name: 'Ascension Day' },
    { key: 'fi_midsummer',   match_name: 'Midsummer Day' },
    { key: 'fi_allsaints',   match_name: "All Saints' Day" },
    { key: 'fi_independence',match_name: 'Independence Day' },
    { key: 'fi_christmas',   match_name: 'Christmas Day' },
    { key: 'fi_ststephen',   match_name: "St. Stephen's Day" },
  ],
  GR: [
    { key: 'gr_newyear',     match_name: "New Year's Day" },
    { key: 'gr_epiphany',    match_name: 'Epiphany' },
    { key: 'gr_cleanmonday', match_name: 'Clean Monday' },
    { key: 'gr_independence',match_name: 'Independence Day' },
    { key: 'gr_goodfriday',  match_name: 'Good Friday' },
    { key: 'gr_easter',      match_name: 'Easter Monday' },
    { key: 'gr_labour',      match_name: 'Labour Day' },
    { key: 'gr_assumption',  match_name: 'Assumption Day' },
    { key: 'gr_ochi',        match_name: 'Ochi Day' },
    { key: 'gr_annunciation',match_name: 'Annunciation' },
    { key: 'gr_christmas',   match_name: 'Christmas Day' },
    { key: 'gr_ststephen',   match_name: "St. Stephen's Day" },
  ],
  HK: [
    { key: 'hk_newyear',     match_name: "New Year's Day" },
    { key: 'hk_lunarnew',    match_name: 'Lunar New Year' },
    { key: 'hk_goodfriday',  match_name: 'Good Friday' },
    { key: 'hk_easter',      match_name: 'Easter Monday' },
    { key: 'hk_labour',      match_name: 'Labour Day' },
    { key: 'hk_buddha',      match_name: "Buddha's Birthday" },
    { key: 'hk_chingming',   match_name: 'Ching Ming Festival' },
    { key: 'hk_dragonboat',  match_name: 'Dragon Boat Festival' },
    { key: 'hk_hksar',       match_name: 'Hong Kong Special Administrative Region Establishment Day' },
    { key: 'hk_national',    match_name: 'National Day' },
    { key: 'hk_midautumn',   match_name: 'Day following the Mid-Autumn Festival' },
    { key: 'hk_chungyeung',  match_name: 'Chung Yeung Festival' },
    { key: 'hk_christmas',   match_name: 'Christmas Day' },
    { key: 'hk_boxing',      match_name: 'Boxing Day' },
  ],
  HU: [
    { key: 'hu_newyear',     match_name: "New Year's Day" },
    { key: 'hu_1848rev',     match_name: '1848 Revolution Memorial Day' },
    { key: 'hu_goodfriday',  match_name: 'Good Friday' },
    { key: 'hu_easter',      match_name: 'Easter Monday' },
    { key: 'hu_labour',      match_name: 'Labour day' },
    { key: 'hu_whit',        match_name: 'Whit Monday' },
    { key: 'hu_foundation',  match_name: 'St. Stephen' },
    { key: 'hu_1956rev',     match_name: '1956 Revolution Memorial Day' },
    { key: 'hu_allsaints',   match_name: 'All Saints Day' },
    { key: 'hu_christmas',   match_name: 'Christmas Day' },
  ],
  ID: [
    { key: 'id_newyear',     match_name: "New Year's Day" },
    { key: 'id_goodfriday',  match_name: 'Good Friday' },
    { key: 'id_labour',      match_name: 'Labour Day' },
    { key: 'id_ascension',   match_name: 'Ascension Day' },
    { key: 'id_pancasila',   match_name: 'Pancasila Day' },
    { key: 'id_independence',match_name: 'Independence Day' },
    { key: 'id_christmas',   match_name: 'Christmas Day' },
  ],
  IE: [
    { key: 'ie_newyear',     match_name: "New Year's Day" },
    { key: 'ie_stbrigid',    match_name: "Saint Brigid's Day" },
    { key: 'ie_stpatrick',   match_name: "Saint Patrick's Day" },
    { key: 'ie_easter',      match_name: 'Easter Monday' },
    { key: 'ie_mayday',      match_name: 'May Day' },
    { key: 'ie_june',        match_name: 'June Holiday' },
    { key: 'ie_august',      match_name: 'August Holiday' },
    { key: 'ie_october',     match_name: 'October Holiday' },
    { key: 'ie_christmas',   match_name: 'Christmas Day' },
    { key: 'ie_ststephen',   match_name: "St. Stephen's Day" },
  ],
  IS: [
    { key: 'is_newyear',     match_name: "New Year's Day" },
    { key: 'is_maundythurs', match_name: 'Maundy Thursday' },
    { key: 'is_goodfriday',  match_name: 'Good Friday' },
    { key: 'is_easter',      match_name: 'Easter Monday' },
    { key: 'is_firstsummer', match_name: 'First Day of Summer' },
    { key: 'is_mayday',      match_name: 'May Day' },
    { key: 'is_ascension',   match_name: 'Ascension Day' },
    { key: 'is_whit',        match_name: 'Whit Monday' },
    { key: 'is_national',    match_name: 'Icelandic National Day' },
    { key: 'is_commerce',    match_name: 'Commerce Day' },
    { key: 'is_christmas',   match_name: 'Christmas Day' },
    { key: 'is_ststephen',   match_name: "St. Stephen's Day" },
  ],
  MA: [
    { key: 'ma_newyear',     match_name: "New Year's Day" },
    { key: 'ma_amazigh',     match_name: 'Amazigh New Year' },
    { key: 'ma_labour',      match_name: 'Labour Day' },
    { key: 'ma_enthronement',match_name: 'Enthronement' },
    { key: 'ma_oued',        match_name: 'Zikra Oued Ed-Dahab' },
    { key: 'ma_revolution',  match_name: 'Revolution of the King and the People' },
    { key: 'ma_youth',       match_name: 'Youth Day' },
    { key: 'ma_greenmarsh',  match_name: 'Green March' },
    { key: 'ma_independence',match_name: 'Independence Day' },
    { key: 'ma_proclamation',match_name: 'Proclamation of Independence' },
  ],
  MX: [
    { key: 'mx_newyear',     match_name: "New Year's Day" },
    { key: 'mx_constitution',match_name: 'Constitution Day' },
    { key: 'mx_juarez',      match_name: "Benito Juárez's birthday" },
    { key: 'mx_labour',      match_name: 'Labour Day' },
    { key: 'mx_independence',match_name: 'Independence Day' },
    { key: 'mx_revolution',  match_name: 'Revolution Day' },
    { key: 'mx_christmas',   match_name: 'Christmas Day' },
  ],
  NL: [
    { key: 'nl_newyear',     match_name: "New Year's Day" },
    { key: 'nl_easter',      match_name: 'Easter Monday' },
    { key: 'nl_kingsday',    match_name: "King's Day" },
    { key: 'nl_ascension',   match_name: 'Ascension Day' },
    { key: 'nl_whit',        match_name: 'Whit Monday' },
    { key: 'nl_christmas',   match_name: 'Christmas Day' },
    { key: 'nl_ststephen',   match_name: "St. Stephen's Day" },
  ],
  NO: [
    { key: 'no_newyear',     match_name: "New Year's Day" },
    { key: 'no_maundythurs', match_name: 'Maundy Thursday' },
    { key: 'no_goodfriday',  match_name: 'Good Friday' },
    { key: 'no_easter',      match_name: 'Easter Monday' },
    { key: 'no_labour',      match_name: 'Labour Day' },
    { key: 'no_constitution',match_name: 'Constitution Day' },
    { key: 'no_ascension',   match_name: 'Ascension Day' },
    { key: 'no_whit',        match_name: 'Whit Monday' },
    { key: 'no_christmas',   match_name: 'Christmas Day' },
    { key: 'no_ststephen',   match_name: "St. Stephen's Day" },
  ],
  NZ: [
    { key: 'nz_newyear',     match_name: "New Year's Day" },
    { key: 'nz_waitangi',    match_name: 'Waitangi Day' },
    { key: 'nz_goodfriday',  match_name: 'Good Friday' },
    { key: 'nz_easter',      match_name: 'Easter Monday' },
    { key: 'nz_anzac',       match_name: 'Anzac Day' },
    { key: 'nz_kingsbd',     match_name: "King's Birthday" },
    { key: 'nz_matariki',    match_name: 'Matariki' },
    { key: 'nz_labour',      match_name: 'Labour Day' },
    { key: 'nz_christmas',   match_name: 'Christmas Day' },
    { key: 'nz_boxing',      match_name: 'Boxing Day' },
  ],
  PE: [
    { key: 'pe_newyear',     match_name: "New Year's Day" },
    { key: 'pe_goodfriday',  match_name: 'Good Friday' },
    { key: 'pe_workers',     match_name: "International Workers' Day" },
    { key: 'pe_stpeter',     match_name: 'Saint Peter and Saint Paul' },
    { key: 'pe_independence',match_name: 'Independence Day' },
    { key: 'pe_santarosa',   match_name: 'Santa Rosa de Lima' },
    { key: 'pe_angamos',     match_name: 'Battle of Angamos' },
    { key: 'pe_allsaints',   match_name: 'All Saints Day' },
    { key: 'pe_immaculate',  match_name: 'Immaculate Conception' },
    { key: 'pe_christmas',   match_name: 'Christmas Day' },
  ],
  PH: [
    { key: 'ph_newyear',     match_name: "New Year's Day" },
    { key: 'ph_chineseny',   match_name: 'Chinese New Year' },
    { key: 'ph_dayofvalor',  match_name: 'Day of Valor' },
    { key: 'ph_goodfriday',  match_name: 'Good Friday' },
    { key: 'ph_labour',      match_name: 'Labour Day' },
    { key: 'ph_independence',match_name: 'Independence Day' },
    { key: 'ph_ninoy',       match_name: 'Ninoy Aquino Day' },
    { key: 'ph_nationalheroes',match_name: 'National Heroes Day' },
    { key: 'ph_allsaints',   match_name: "All Saints' Day" },
    { key: 'ph_bonifacio',   match_name: 'Bonifacio Day' },
    { key: 'ph_immaculate',  match_name: 'Feast of the Immaculate Conception of Mary' },
    { key: 'ph_rizal',       match_name: 'Rizal Day' },
    { key: 'ph_christmas',   match_name: 'Christmas Day' },
  ],
  PL: [
    { key: 'pl_newyear',     match_name: "New Year's Day" },
    { key: 'pl_epiphany',    match_name: 'Epiphany' },
    { key: 'pl_easter',      match_name: 'Easter Monday' },
    { key: 'pl_mayday',      match_name: 'May Day' },
    { key: 'pl_constitution',match_name: 'Constitution Day' },
    { key: 'pl_pentecost',   match_name: 'Pentecost' },
    { key: 'pl_corpus',      match_name: 'Corpus Christi' },
    { key: 'pl_assumption',  match_name: 'Assumption Day' },
    { key: 'pl_allsaints',   match_name: "All Saints' Day" },
    { key: 'pl_independence',match_name: 'Independence Day' },
    { key: 'pl_christmas',   match_name: 'Christmas Day' },
    { key: 'pl_ststephen',   match_name: "St. Stephen's Day" },
  ],
  PT: [
    { key: 'pt_newyear',     match_name: "New Year's Day" },
    { key: 'pt_goodfriday',  match_name: 'Good Friday' },
    { key: 'pt_freedom',     match_name: 'Freedom Day' },
    { key: 'pt_labour',      match_name: 'Labour Day' },
    { key: 'pt_national',    match_name: 'National Day' },
    { key: 'pt_assumption',  match_name: 'Assumption Day' },
    { key: 'pt_republic',    match_name: 'Republic Day' },
    { key: 'pt_allsaints',   match_name: 'All Saints Day' },
    { key: 'pt_restoration', match_name: 'Restoration of Independence' },
    { key: 'pt_immaculate',  match_name: 'Immaculate Conception' },
    { key: 'pt_christmas',   match_name: 'Christmas Day' },
  ],
  RU: [
    { key: 'ru_newyear',     match_name: "New Year's Day" },
    { key: 'ru_christmas',   match_name: 'Christmas Day (Orthodox)' },
    { key: 'ru_defender',    match_name: 'Defender of the Fatherland Day' },
    { key: 'ru_womensday',   match_name: "International Women's Day" },
    { key: 'ru_labour',      match_name: 'Labour Day' },
    { key: 'ru_victory',     match_name: 'Victory Day' },
    { key: 'ru_russia',      match_name: 'Russia Day' },
    { key: 'ru_unity',       match_name: 'Unity Day' },
  ],
  SE: [
    { key: 'se_newyear',     match_name: "New Year's Day" },
    { key: 'se_epiphany',    match_name: 'Epiphany' },
    { key: 'se_goodfriday',  match_name: 'Good Friday' },
    { key: 'se_easter',      match_name: 'Easter Monday' },
    { key: 'se_workers',     match_name: "International Workers' Day" },
    { key: 'se_ascension',   match_name: 'Ascension Day' },
    { key: 'se_national',    match_name: 'National Day of Sweden' },
    { key: 'se_midsummer',   match_name: 'Midsummer Day' },
    { key: 'se_allsaints',   match_name: "All Saints' Day" },
    { key: 'se_christmas',   match_name: 'Christmas Day' },
    { key: 'se_ststephen',   match_name: "St. Stephen's Day" },
  ],
  TR: [
    { key: 'tr_newyear',     match_name: "New Year's Day" },
    { key: 'tr_children',    match_name: 'National Independence & Children\'s Day' },
    { key: 'tr_labour',      match_name: 'Labour Day' },
    { key: 'tr_youth',       match_name: 'Atatürk Commemoration & Youth Day' },
    { key: 'tr_victory',     match_name: 'Victory Day' },
    { key: 'tr_republic',    match_name: 'Republic Day' },
    { key: 'tr_democracy',   match_name: 'Democracy and National Unity Day' },
  ],
  ZA: [
    { key: 'za_newyear',     match_name: "New Year's Day" },
    { key: 'za_humanrights', match_name: 'Human Rights Day' },
    { key: 'za_goodfriday',  match_name: 'Good Friday' },
    { key: 'za_familyday',   match_name: 'Family Day' },
    { key: 'za_freedom',     match_name: 'Freedom Day' },
    { key: 'za_workers',     match_name: "Workers' Day" },
    { key: 'za_youth',       match_name: 'Youth Day' },
    { key: 'za_women',       match_name: "National Women's Day" },
    { key: 'za_heritage',    match_name: 'Heritage Day' },
    { key: 'za_reconcil',    match_name: 'Day of Reconciliation' },
    { key: 'za_christmas',   match_name: 'Christmas Day' },
    { key: 'za_goodwill',    match_name: 'Day of Goodwill' },
  ],
};

const SYSTEM_INSTRUCTION = `You are a travel information writer for HolidayTrip, a global travel guide focused on public holidays and their practical impact on visitors. Your audience is INTERNATIONAL TRAVELERS (not locals) who are visiting the country during this holiday. Write in clear, practical English.`;

function buildUserPrompt(args) {
  var { country_name, country_code, holiday_name_en, holiday_name_local, sample_date, weekday, category } = args;
  return `Generate a travel tip for international visitors about the following public holiday.

Country: ${country_name} (${country_code})
Holiday: ${holiday_name_en}${holiday_name_local ? ' (' + holiday_name_local + ')' : ''}
Date: ${sample_date} (${weekday})
Holiday category: ${category}

Output a single JSON object with EXACTLY these 5 fields:
{
  "what_is_it": "1-2 sentences explaining the holiday.",
  "traveler_impact": "1-2 sentences on concrete traveler impact.",
  "cautions": "1-2 sentences of specific warnings. Empty string if none.",
  "recommendations": "1-2 sentences of recommendations. Empty string if none.",
  "practical_tips": "2-3 sentences of actionable advice."
}

Then on a separate line:
SOURCES: ["url1", "url2", "url3"]

Output ONLY the JSON + SOURCES line. No markdown fences.`;
}

function parseGeminiOutput(raw) {
  var text = raw.trim().replace(/^`\`\`(?:json)?\s*/i, '').replace(/`\`\`\s*$/i, '');
  var sourcesMatch = text.match(/SOURCES\s*:\s*(\[[\s\S]*?\])\s*$/i);
  var sources = [];
  var jsonText = text;
  if (sourcesMatch) {
    try { sources = JSON.parse(sourcesMatch[1]); } catch (e) {}
    jsonText = text.slice(0, sourcesMatch.index).trim();
  }
  jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
  var obj = JSON.parse(jsonText);
  return {
    what_is_it:      (obj.what_is_it || '').trim(),
    traveler_impact: (obj.traveler_impact || '').trim(),
    cautions:        (obj.cautions || '').trim(),
    recommendations: (obj.recommendations || '').trim(),
    practical_tips:  (obj.practical_tips || '').trim(),
    source_urls:     Array.isArray(sources) ? sources : [],
  };
}

function weekdayName(isoDate) {
  var d = new Date(isoDate + 'T00:00:00');
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
}

async function generateTipForTarget(countryRow, target, options) {
  var matched_res = await supabase.from('holidays').select('*')
    .eq('country_id', countryRow.id)
    .ilike('name', '%' + target.match_name + '%')
    .order('date', { ascending: true });
  var matched = matched_res.data || [];

  if (matched.length === 0) {
    process.stdout.write('⚠');
    return { skipped: true, reason: 'no_matches' };
  }

  var ids = matched.map(function(h) { return h.id; });
  var eRes = await supabase.from('travel_tips').select('holiday_id').in('holiday_id', ids);
  var existing = eRes.data || [];
  if (existing.length > 0) {
    process.stdout.write('⏭');
    return { skipped: true, reason: 'tip_exists' };
  }

  var anchor = matched.find(function(h) { return h.holiday_category === 'regular'; }) || matched[0];
  var userPrompt = buildUserPrompt({
    country_name: countryRow.name,
    country_code: countryRow.code,
    holiday_name_en: anchor.name,
    holiday_name_local: anchor.name_local,
    sample_date: anchor.date,
    weekday: weekdayName(anchor.date),
    category: anchor.holiday_category || 'regular',
  });

  var result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });
  var raw = result.response.text();

  var parsed;
  try { parsed = parseGeminiOutput(raw); }
  catch(e) {
    process.stdout.write('❌');
    return { skipped: false, error: e.message };
  }

  if (options.dryRun) {
    process.stdout.write('🧪');
    return { skipped: false, dryRun: true };
  }

  var rows = matched.map(function(h) {
    return {
      country_id: countryRow.id,
      holiday_id: h.id,
      title: anchor.name,
      what_is_it: parsed.what_is_it || null,
      traveler_impact: parsed.traveler_impact || null,
      cautions: parsed.cautions || null,
      recommendations: parsed.recommendations || null,
      practical_tips: parsed.practical_tips || null,
      source_urls: parsed.source_urls.length > 0 ? parsed.source_urls : null,
      language: 'en',
      ai_model: 'gemini-2.5-flash-lite',
      moderation_status: 'approved',
    };
  });

  var insRes = await supabase.from('travel_tips').insert(rows).select('id');
  if (insRes.error) {
    process.stdout.write('❌');
    return { skipped: false, error: insRes.error.message };
  }
  process.stdout.write('✅');
  return { skipped: false, inserted: insRes.data.length };
}

async function main() {
  var args     = process.argv.slice(2);
  var dryRun   = args.includes('--dry-run');
  var onlyArg  = args.find(function(a) { return a.startsWith('--only='); });
  var onlyCode = onlyArg ? onlyArg.split('=')[1].toUpperCase() : null;

  console.log('generate-travel-tips-all.js  dryRun=' + dryRun + '  onlyCode=' + (onlyCode || '(all)') + '\n');

  var countryCodes = onlyCode ? [onlyCode] : Object.keys(TARGETS_BY_COUNTRY);
  var totalInserted = 0, totalSkipped = 0, totalErrors = 0;

  for (var i = 0; i < countryCodes.length; i++) {
    var code = countryCodes[i];
    var targets = TARGETS_BY_COUNTRY[code];
    if (!targets) { console.log('Unknown: ' + code); continue; }

    var cRes = await supabase.from('countries').select('*').eq('code', code).maybeSingle();
    var countryRow = cRes.data;
    if (!countryRow) { console.log('\n[' + code + '] Country not found in DB'); continue; }

    process.stdout.write('[' + code + '] ');
    for (var j = 0; j < targets.length; j++) {
      var r = await generateTipForTarget(countryRow, targets[j], { dryRun: dryRun });
      if (r.error) totalErrors++;
      else if (r.skipped) totalSkipped++;
      else if (!r.dryRun) totalInserted += (r.inserted || 0);
      if (!r.skipped && !dryRun && !r.error) {
        await new Promise(function(res) { setTimeout(res, 800); });
      }
    }
    console.log('');
  }

  console.log('\n=== DONE ===');
  console.log('Inserted: ' + totalInserted + ' rows');
  console.log('Skipped:  ' + totalSkipped);
  console.log('Errors:   ' + totalErrors);
}

main().catch(function(e) { console.error('Fatal:', e); process.exit(1); });
