// scripts/generate-travel-tip.js
// Content Creator Agent - 공휴일 여행 팁 자동 생성
// 사용법: node scripts/generate-travel-tip.js

require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// ========== 설정 ==========
const AI_MODEL = 'gemini-2.5-flash';
const LANGUAGE = 'en';
const TEST_HOLIDAY_ID = 167; // 2026-09-25 추석 당일

// ========== 클라이언트 초기화 ==========
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 서버용 키 사용
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: AI_MODEL,
  generationConfig: {
    responseMimeType: 'application/json', // JSON 강제 출력
    temperature: 0.7,
  },
});

// ========== 프롬프트 생성 함수 ==========
function buildPrompt(holiday, country) {
  return `You are an expert travel writer creating accurate, practical travel tips for international travelers.

TASK: Generate comprehensive travel tips for the following holiday.

HOLIDAY INFORMATION:
- Country: ${country.name} (${country.code})
- Holiday Name: ${holiday.name}
- Local Name: ${holiday.name_local}
- Date: ${holiday.date}
- Year: ${holiday.year}
- Type: ${holiday.type}

CRITICAL RULES:
1. ACCURACY FIRST: All information must be factually correct. Do not invent facts.
2. 70/30 Rule: 70% based on official sources (government tourism boards, Wikipedia, official institutions), 30% based on well-documented traveler experiences.
3. SOURCES REQUIRED: Provide at least 3 source URLs from credible sources (government tourism sites, Wikipedia, official institutions).
4. NO COPYING: Rewrite all information in your own words. Do not copy from any source.
5. COMPLETENESS: If mentioning specific services (e.g., trains), mention ALL major options (e.g., "KTX, SRT, and other trains" not just "KTX").
6. PRACTICAL FOCUS: Travelers should get actionable, realistic advice.

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "Brief engaging title for this holiday tip (under 100 chars)",
  "what_is_it": "2-3 sentences explaining the holiday's meaning, history, and cultural significance. Focus on facts.",
  "traveler_impact": "How does this holiday affect travelers? Cover transportation, crowds, business operations, public services. 3-5 sentences.",
  "cautions": "Specific warnings and things to avoid during this holiday. Use clear bullet-like sentences separated by periods. What could go wrong for a traveler?",
  "recommendations": "Recommended activities, places to visit, or cultural experiences during this holiday. Be specific with locations/events when possible.",
  "tips": "General helpful tips for travelers visiting during this holiday.",
  "practical_tips": "CRITICAL PRACTICAL TIPS related to this holiday. Focus on: (1) Transportation booking urgency (trains, flights, buses) with specific timelines. (2) Business/store operation impacts (which types of places close, which stay open). (3) Airport congestion. (4) Accommodation booking advice. (5) Specific behavioral tips for foreigners. Use concrete, actionable advice. Example: 'KTX/SRT train tickets sell out 4 weeks in advance. Tickets go on sale at 7:00 AM sharp, competition is fierce.' This is the MOST IMPORTANT field for differentiation.",
  "source_urls": ["url1", "url2", "url3"]
}

REMEMBER: 
- Write in English.
- Be factually accurate above all else.
- The "practical_tips" field is the most important - make it specific and actionable.
- Provide real, working URLs for sources.`;
}

// ========== 메인 함수 ==========
async function generateTravelTip(holidayId) {
  console.log('🚀 Content Creator Agent 시작\n');
  console.log(`📍 대상 공휴일 ID: ${holidayId}`);
  console.log(`🤖 AI 모델: ${AI_MODEL}`);
  console.log(`🌐 언어: ${LANGUAGE}\n`);

  try {
    // 1. DB에서 공휴일 + 국가 정보 조회
    console.log('1️⃣  DB에서 공휴일 정보 조회 중...');
    const { data: holiday, error: holidayError } = await supabase
      .from('holidays')
      .select('*, countries(*)')
      .eq('id', holidayId)
      .single();

    if (holidayError) throw new Error(`공휴일 조회 실패: ${holidayError.message}`);
    if (!holiday) throw new Error('공휴일을 찾을 수 없습니다.');

    const country = holiday.countries;
    console.log(`   ✓ ${holiday.name} (${holiday.name_local}) - ${country.name}, ${holiday.date}\n`);

    // 2. 이미 해당 언어로 생성된 팁이 있는지 확인 (중복 방지)
    console.log('2️⃣  기존 팁 확인 중...');
    const { data: existingTip } = await supabase
      .from('travel_tips')
      .select('id, moderation_status')
      .eq('holiday_id', holidayId)
      .eq('language', LANGUAGE)
      .maybeSingle();

    if (existingTip) {
      console.log(`   ⚠️  이미 존재 (id=${existingTip.id}, status=${existingTip.moderation_status})`);
      console.log('   → 테스트를 위해 진행하지만, 실제 운영에서는 skip하거나 업데이트 로직 필요\n');
    } else {
      console.log('   ✓ 기존 팁 없음. 신규 생성 진행\n');
    }

    // 3. Gemini에게 프롬프트 전송
    console.log('3️⃣  Gemini API 호출 중... (10~30초 소요)');
    const prompt = buildPrompt(holiday, country);
    const startTime = Date.now();

    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✓ 응답 수신 (${elapsed}초)\n`);

    // 4. JSON 파싱
    console.log('4️⃣  응답 파싱 중...');
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error('   ❌ JSON 파싱 실패. 원본 응답:');
      console.error(rawText);
      throw new Error('Gemini가 유효하지 않은 JSON을 반환했습니다.');
    }

    // 필수 필드 검증
    const requiredFields = ['title', 'what_is_it', 'traveler_impact', 'cautions', 
                            'recommendations', 'tips', 'practical_tips', 'source_urls'];
    const missing = requiredFields.filter(f => !parsed[f]);
    if (missing.length > 0) {
      console.warn(`   ⚠️  누락된 필드: ${missing.join(', ')}`);
    }

    // 출처 URL 개수 확인
    const sourceCount = Array.isArray(parsed.source_urls) ? parsed.source_urls.length : 0;
    if (sourceCount < 3) {
      console.warn(`   ⚠️  출처 URL이 3개 미만입니다 (${sourceCount}개). 품질 확인 필요.`);
    }
    console.log(`   ✓ 파싱 완료 (출처 ${sourceCount}개)\n`);

    // 5. 콘솔에 결과 출력
    console.log('📦 생성된 여행 팁:\n');
    console.log('─'.repeat(60));
    console.log(`📌 Title: ${parsed.title}`);
    console.log('─'.repeat(60));
    console.log(`\n📖 What is it:\n${parsed.what_is_it}\n`);
    console.log(`🚗 Traveler Impact:\n${parsed.traveler_impact}\n`);
    console.log(`⚠️  Cautions:\n${parsed.cautions}\n`);
    console.log(`✨ Recommendations:\n${parsed.recommendations}\n`);
    console.log(`💡 Tips:\n${parsed.tips}\n`);
    console.log(`🎯 Practical Tips (핵심 차별화!):\n${parsed.practical_tips}\n`);
    console.log(`🔗 Sources:`);
    (parsed.source_urls || []).forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
    console.log('─'.repeat(60));

    // 토큰 사용량
    if (response.usageMetadata) {
      console.log('\n📊 토큰 사용량:');
      console.log(`   입력: ${response.usageMetadata.promptTokenCount}`);
      console.log(`   출력: ${response.usageMetadata.candidatesTokenCount}`);
      console.log(`   합계: ${response.usageMetadata.totalTokenCount}`);
    }

    // 6. DB에 저장
    console.log('\n5️⃣  DB에 저장 중...');
    const now = new Date().toISOString();

    const insertData = {
      country_id: country.id,
      holiday_id: holidayId,
      title: parsed.title,
      what_is_it: parsed.what_is_it,
      traveler_impact: parsed.traveler_impact,
      cautions: parsed.cautions,
      recommendations: parsed.recommendations,
      tips: parsed.tips,
      practical_tips: parsed.practical_tips,
      source_urls: parsed.source_urls || [],
      language: LANGUAGE,
      ai_model: AI_MODEL,
      ai_generated_at: now,
      moderation_status: 'pending', // 관리자 승인 대기
      created_at: now,
      updated_at: now,
    };

    const { data: saved, error: insertError } = await supabase
      .from('travel_tips')
      .insert(insertData)
      .select()
      .single();

    if (insertError) throw new Error(`DB 저장 실패: ${insertError.message}`);

    console.log(`   ✓ 저장 완료 (travel_tips.id = ${saved.id})\n`);

    console.log('✅ 엔드투엔드 테스트 성공!');
    console.log(`\n다음 단계: Supabase에서 travel_tips 테이블을 열어 id=${saved.id}를 확인하세요.`);

  } catch (error) {
    console.error('\n❌ 에러 발생:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// 실행
generateTravelTip(TEST_HOLIDAY_ID);
