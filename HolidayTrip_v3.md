# HolidayTrip 프로젝트 종합 정리 v3.0

**최종 업데이트**: 2026-04-17
**이전 버전**: v2.0 (2026-04-16)

---

## 📌 v3.0 주요 변경사항 (v2.0 대비)

1. **콘텐츠 범위 확대**: 주요 공휴일 150~200개 → **전체 약 2,000개**
2. **AI 에이전트 확장**: 11개 → **16개** (디자인 3개 + 수익/성능 2개 추가)
3. **신규 기능 2가지**:
   - 국가별 여행 위험도 (외교부 여행 경보)
   - 공휴일 연계 실용 팁 (기차표 예매 등 현실적 팁)
4. **저작권 전략 명시**: 사실 사용, 표현 AI 재작성, 출처 URL 강제
5. **70:30 원칙**: 여행 팁 = 공식 70% + 검색 창의 30%, 디자인 = 표준 70% + 창의 30%
6. **AI 모델 전략**: Gemini 주력 → Claude 크레딧 확보 후 점진적 업그레이드
7. **다국어 지원**: 영어 먼저, 궁극적으로 전체 언어 지원

---

## 1. 서비스 개요

- **프로젝트명**: HolidayTrip
- **도메인**: holiday-trip.com (www.holiday-trip.com)
- **운영 회사**: SE Company
- **운영자 이메일**: seansaiid@gmail.com
- **배포 URL**: https://www.holiday-trip.com
- **GitHub**: https://github.com/seansaiid-creator/holiday-trip
- **Vercel URL**: holiday-trip-nine.vercel.app

---

## 2. 서비스 목적과 배경

### 왜 이 서비스를 만드는가
- 1인 운영, 운영 비용 거의 0, 자동화 90% 이상
- 근로 외 추가 수익 창출 목표
- 반복 방문 유도, 편리함과 재미 제공
- **공개된 공신력 높은 데이터(정부/인증 기관 오픈 데이터)를 결합해 더 쉽게 만드는 서비스**
- 수익화를 통해 장기적으로 근로소득 대체 목표

### 기존 시장 공백
- timeanddate.com 등 기존 공휴일 사이트는 날짜만 나열, 여행 정보 없음
- 기존 여행 사이트는 공휴일 정보 없음
- **두 가지를 결합한 서비스가 현재 시장에 없음** = 핵심 차별화

### 서비스의 원본 아이디어 (기원)
> "공휴일 + 그 날짜에 뭘 조심해야 하고 뭘 즐길 수 있는지"
> 예: "설날에는 기차표 구하기 어렵다"

---

## 3. 서비스 핵심 가치

**한 줄 정의**: "전 세계 공휴일과 여행 정보를 한눈에 보여주는, AI가 자동 운영하는 여행자 정보 허브"

### 데이터 3축 전략
1. **오픈 API 자동 수집**: 공휴일, 통화, 전압, 환율, 물가
2. **AI 생성 콘텐츠**: 여행 팁 (공식 70% + 검색 30%), 공식 기관 검증
3. **커뮤니티**: 실제 여행자 경험으로 부족한 부분 보완

### 제공 기능

#### 1. 공휴일 정보 (자동)
- 50개국 (2025-2027), 약 2,000개
- Nager.Date API 기반
- Thailand는 수동 데이터 (Nager.Date 미지원)
- **향후 확장**: 100개국 → 150개국

#### 2. 실시간 시간대 표시 (예정)
- 브라우저 자동 감지
- 여행할 나라 현재 시간과 시차 표시

#### 3. 여행 기본 정보 (고정 + 실시간)
- 화폐, 전압, 플러그 타입, 시간대
- 환율 실시간 연동 (예정)

#### 4. 물가 비교 도구 (핵심 차별화, 예정)
- Numbeo API 기반 약 15개 항목
- 생수, 콜라, 택시, 대중교통, 빅맥, 스타벅스, 현지 식당, 중급 식당, 맥주, 우유, 쌀, 가솔린, 현지 대표 음식
- 6개월마다 자동 수집 + 검수

#### 5. 여행 팁 (AI 생성, 자동화 90%)
- **전체 약 2,000개 공휴일 대상**
- 구조: 공휴일 의미 / 여행자 영향 / 주의사항 / 추천 활동 / 팁
- **70:30 원칙**: 공식 정보 70% + 검색 기반 30%
- 4단계 검증 프로세스 (초안 → 공식 검색 → 수정 → 최종 승인)

#### 6. 🆕 공휴일 연계 실용 팁 (핵심 차별화)
**이게 서비스의 정체성.** 공휴일이 있어서 발생하는 현실적 문제에 대한 구체적 팁.

**예시 구조:**
```
[한국 추석 - Chuseok]
📅 날짜: 2026년 9월 24-26일
🚗 교통 영향: "귀성 대이동으로 전국 고속도로 극심한 정체"
🎫 예매 팁: "KTX/SRT 기차표는 4주 전부터 판매. 판매 시작일 오전 7시 정각 경쟁 심함"
🏪 영업 영향: "대부분 자영업 휴무, 대형마트/백화점도 추석 당일 휴무"
✈️ 공항: "인천공항 극심한 혼잡, 2-3시간 일찍 도착 권장"
💡 외국인 팁: "이 기간 방문은 피하거나, 서울 시내 관광에 집중 (한적함)"
```

#### 7. 🆕 국가별 여행 위험도 (여행 경보)
- **데이터 소스**: 한국 외교부 해외안전여행 공식 API (공공데이터포털)
- 단계: 여행 주의, 여행 자제, 출국 권고, 여행 금지
- **공공 데이터라 저작권 우려 없음**

#### 8. 커뮤니티 댓글 (예정)
- 실제 방문자의 경험 공유
- AI 모더레이션 시스템

---

## 4. 커뮤니티 운영 방안 (상세)

### 댓글 기능 구조
- 국가별 페이지 또는 공휴일별 페이지 하단에 댓글 섹션
- 비로그인 사용자도 댓글 작성 가능 (이름 + 국가 + 내용)
- 선택적으로 이메일 인증 추가 가능

### 모더레이션 프로세스

**1단계: AI 자동 모더레이션 (실시간)**
- 댓글 작성 즉시 Claude/Gemini API가 분석
- 감지 대상: 욕설, 비방, 스팸/광고, 혐오 발언, 개인 정보 노출, 부적절한 언어

**2단계: 자동 분류**
- 문제 없음 → 즉시 게시
- 경계선 → 관리자 검토 대기열로 이동
- 명백한 문제 → 자동 차단 + 이메일 알림

**3단계: 관리자 알림 (이메일)**
- 문제 감지 시 Resend API로 즉시 seansaiid@gmail.com에 이메일 발송
- 이메일 내용: 댓글 내용, 감지된 문제, 승인/블라인드 링크
- 하루에 여러 건이면 하루 1회 요약 이메일

**4단계: 관리자 액션**
- "승인" → 정상 게시
- "블라인드" → 댓글 숨김 처리 (삭제 아님, 법적 이유로 기록 보존)
- "삭제" → 완전 삭제

---

## 5. 기술 스택

- **프론트엔드**: Next.js 15 + React 18 + TypeScript + Tailwind CSS
- **백엔드**: Next.js API Routes
- **데이터베이스**: Supabase (PostgreSQL, Seoul 리전)
- **AI**:
  - **Gemini API** (일 1,500건 무료, 주력) - 현재 사용
  - **Claude API** (크레딧 확보 후 고품질 콘텐츠용) - 향후 전환
  - **모델 전환 전략**: Claude 연결 가능해지면 점진적으로 DB 콘텐츠 업그레이드. 재생성된 콘텐츠만 교체, 미재생성 Gemini 데이터는 유지.
- **배포**: Vercel (Hobby 플랜)
- **도메인**: 가비아 등록
- **이메일**: Resend (월 3,000통 무료)
- **에러 모니터링**: Sentry
- **외부 API**: Nager.Date, ExchangeRate-API, REST Countries, Numbeo, **한국 외교부 해외안전여행 API**

---

## 6. 데이터베이스 구조

### countries (50개국)
```
id, code, name, name_local, currency_code, currency_symbol
voltage, plug_types, timezone, emoji_flag, description
is_active, created_at, updated_at
```

### holidays (약 2,000개)
```
id, country_id, date, name, name_local, type
is_public, year, created_at
```

### travel_tips (AI 생성)
```
id, country_id, holiday_id
title, what_is_it, traveler_impact, cautions, recommendations, tips
practical_tips (🆕 공휴일 연계 실용 팁 - 기차표, 영업 등)
verified_at, source_urls, language
ai_model, ai_generated_at (Gemini/Claude 구분)
moderation_status (관리자 승인 여부)
```

### 🆕 travel_advisories (여행 위험도)
```
id, country_id, advisory_level (1-4: 주의/자제/권고/금지)
summary, details, source_url (외교부)
last_updated_at
```

### prices (물가 정보, 예정)
```
id, country_id, item_name, item_category
price_local, price_usd
last_updated_at, source
```

### comments (커뮤니티, 예정)
```
id, country_id, holiday_id
author_name, author_country, content
is_blinded, moderation_status, moderation_notes
created_at
```

### audit_log (변경 이력)
```
id, entity_type, entity_id, action
ai_agent, details, created_at
```

---

## 7. 환경 변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY (크레딧 없음 - 카드 결제 문제)
RESEND_API_KEY
GEMINI_API_KEY ✅ 추가 완료
KOREA_MOFA_API_KEY (🆕 예정 - 외교부 여행 경보)
```

---

## 8. AI 에이전트 조직 구조 (16개, v3.0 확장)

### 🗂️ 콘텐츠 팀 (3개)

**1. Content Creator**
- 역할: 공휴일 팁 초안 작성 (전체 2,000개 대상)
- 모델: Gemini 2.5 Flash (현재) → Claude (향후)
- **프롬프트 원칙**: 공식 70% + 검색 30%, 출처 URL 3개 이상 강제
- 작업 주기: 신규 공휴일 발견 시 또는 관리자 요청 시

**2. Fact Checker**
- 역할: 정확성 2차 검증
- 공식 관광청 웹사이트, 정부 사이트 크로스체크
- 불일치 발견 시 수정 제안
- **이 예시 기준**: "KTX" → "KTX, SRT 등 모든 열차"처럼 누락 정보 보강

**3. Translation Manager**
- 역할: 다국어 번역 관리
- 초기: 영어만, 이후 스페인어 → 일본어 → 한국어 → 기타

### 📊 데이터/운영 팀 (2개)

**4. Data Updater**
- 역할: 물가/환율 주기적 업데이트 (6개월 주기)
- 여행 경보 데이터 일일 자동 갱신
- 공휴일 변동 사항 반영

**5. Community Moderator**
- 역할: 댓글 실시간 모니터링 (24/7)
- 욕설/비방/광고 감지
- 관리자 이메일 알림, 주간 커뮤니티 리포트

### 📣 마케팅 팀 (4개)

**6. SEO Strategist**
- 키워드 리서치 (주간)
- 경쟁사 순위 분석, SEO 기회 발굴

**7. Content Marketing**
- 블로그 포스트 초안 작성
- 소셜 미디어 콘텐츠 제안

**8. Analytics Analyst**
- Google Analytics 주간 분석
- 트래픽, 이탈률, 전환율 인사이트

**9. Campaign Optimizer**
- 분석 결과 기반 전략 수정 제안
- A/B 테스트 기획, 주간 마케팅 리포트

### 🎨 디자인 팀 (3개, 🆕 v3.0 신규)

**12. UI/UX Designer**
- 역할: 페이지 레이아웃, 컴포넌트 디자인, 사용자 플로우 개선
- **원칙**: 70% Material Design 3 / Apple HIG 준수 + 30% 여행 카테고리 특화 창의
- 작업 주기: 신규 페이지/기능 추가 시, 월 1회 UX 개선점 분석

**13. Visual Designer**
- 역할: 컬러/타이포/아이콘 일관성, 50개국 국기 이미지 스타일 통일
- **원칙**: 70% 디자인 시스템 규칙 강제 + 30% 국가별 테마 변주
- 작업 주기: 신규 컴포넌트 생성 시, 분기별 디자인 시스템 업데이트

**14. Accessibility Auditor**
- 역할: WCAG 2.1 AA 자동 검증 (색상 대비, 키보드 네비, 스크린 리더)
- **원칙**: 100% 표준 준수 (법적 이슈 예방)
- 작업 주기: 주간 자동 감사, 배포 전 체크

### 💰 수익화/성능 팀 (2개, 🆕 v3.0 신규)

**15. Conversion Optimizer**
- 역할: CTA 버튼/광고 영역 전환율 최적화 (수익 직결)
- A/B 테스트 설계, 제휴 링크 클릭률 분석

**16. Performance Auditor**
- 역할: 페이지 로딩 속도, Core Web Vitals 감시 (SEO 직결)
- Lighthouse 점수 모니터링, 성능 최적화 제안

### 🛠️ 개발/운영 팀 (2개)

**10. Dev Assistant**
- 코드 생성/수정 (Claude Code), 리팩토링, 신기능 구현

**11. Error Monitor**
- Sentry 에러 실시간 감지, 수정 계획 제안

---

## 9. 저작권 & 콘텐츠 정책 (🆕 v3.0)

### 원칙: "사실은 복제, 표현은 재창작"

| 소스 | 사용 가능? | 인용 방식 |
|-----|----------|---------|
| 정부 관광청 공식 발표 | ✅ 사실 사용 | 출처 URL 명시 |
| 정부 외교부 여행 경보 | ✅ 사실 사용 | 출처 URL 명시 |
| Wikipedia | ✅ (CC BY-SA) | 출처 + 라이선스 명시 |
| 유명 여행 블로그 | ⚠️ 표현 복제 금지 | AI가 완전 재작성 |
| 상업 여행 가이드 (Lonely Planet 등) | ❌ 참고 금지 | - |

### 모든 AI 생성 콘텐츠 필수 조건
1. `source_urls` 필드에 출처 URL 3개 이상 기록
2. 하단에 "Sources" 섹션 표시
3. 사이트 푸터에 저작권 원칙 명시
4. 사실(fact)만 사용, 서술 표현은 AI 재작성

---

## 10. 페이지 구조 및 광고 전략

### 국가별 페이지 레이아웃

```
1. 히어로 섹션 (국기, 실시간 시간, 환율, 다음 공휴일 D-day)
2. 🆕 여행 위험도 배지 (외교부 데이터)
3. [광고 영역 1] 상단 배너
4. 빠른 정보 카드 (통화, 전압, 플러그, 시간대)
5. 제휴 CTA 박스 (어댑터, eSIM, 여행보험)
6. 연도별 공휴일 캘린더
7. [광고 영역 2] 인아티클 배너
8. 공휴일별 여행 팁 (아코디언)
   - 공휴일 의미
   - 여행자 영향
   - 🆕 실용 팁 (기차표, 영업, 교통 등)
   - 추천 활동
   - 출처 URL
9. 제휴 CTA (공휴일 기간 항공권)
10. [광고 영역 3] 사이드바/인라인
11. 물가 비교 섹션
12. [광고 영역 4] 인아티클
13. 커뮤니티 댓글 섹션
14. [광고 영역 5] 하단 배너
```

### 광고 전략
- 총 5개 광고 위치 (애드센스 승인 후 활성화)
- 모바일에서는 자동 3개로 축소
- 제휴 마케팅: Booking.com, Airalo, SafetyWing, Skyscanner, Wise

---

## 11. 수익화 로드맵

- **Phase 1 (0~6개월)**: 월 $0~200 - Google AdSense (PV 10,000)
- **Phase 2 (6~12개월)**: 월 $200~1,000 - AdSense + 여행 제휴
- **Phase 3 (12~24개월)**: 월 $1,000~5,000 - Mediavine + API B2B 판매
- **Phase 4 (24개월+)**: 월 $5,000~15,000 - 프리미엄 도구 유료화

---

## 12. 운영 비용 (월 $50 예산 내)

| 항목 | 비용 |
|-----|-----|
| 도메인 | $1/월 |
| Vercel Hobby | $0 |
| Supabase 무료 | $0 |
| Gemini API | $0 (무료 티어) |
| Claude API | $20~30 (카드 문제 해결 후) |
| Resend | $0 |
| Sentry | $0 |
| **총** | **$21~31/월** |

---

## 13. 현재까지 완료된 작업

### ✅ 인프라
- 도메인 구매 (holiday-trip.com, 가비아)
- Vercel 배포 + 커스텀 도메인 연결 (https)
- Supabase DB 구축 (Seoul 리전)
- GitHub 저장소 (seansaiid-creator/holiday-trip)
- 환경 변수 설정

### ✅ 콘텐츠
- 50개국 정보 입력
- 약 2,000개 공휴일 데이터 (2025-2027, Nager.Date API)
- 초기 5개국: 한국, 일본, 미국, 태국, 프랑스
- 추가 45개국 확장 완료

### ✅ 페이지
- 홈페이지, 국가별 상세 페이지 (/country/[code])
- About, Contact, Privacy, Terms 페이지
- SEO 기반 (sitemap.xml, robots.txt, Search Console)

### ✅ Phase 1 - Gemini API 연동 (2026-04-17 완료)
- @google/generative-ai 패키지 설치
- .env.local에 GEMINI_API_KEY 추가
- scripts/test-gemini.js로 테스트 성공
- 모델: gemini-2.5-flash

---

## 14. 다음 작업 우선순위

### 🔥 즉시 진행 (Phase 2)

**1. Content Creator 에이전트 구현**
- scripts/generate-travel-tips.js 작성
- 프롬프트 구조:
  - 공휴일 의미 (역사/배경) - Wikipedia 기반
  - 여행자 영향 (교통, 영업)
  - 주의사항
  - 추천 활동
  - 🆕 공휴일 연계 실용 팁 (기차표 예매 등)
  - 출처 URL 3개 이상 강제
- DB 저장 (travel_tips 테이블, ai_model='gemini-2.5-flash')

**2. Fact Checker 에이전트**
- Content Creator 결과물 자동 검증
- 공식 사이트 크로스체크
- 불일치 시 수정 또는 관리자 대기열

**3. 1개 공휴일로 엔드투엔드 테스트**
- 한국 추석 → 생성 → 검증 → DB 저장 → 화면 표시

### 📅 1주일 내 (Phase 2.5)
- 관리자 대시보드 (/admin, 비밀번호 보호)
- AI 생성 콘텐츠 검토/승인/거절 UI
- 커뮤니티 댓글 기능 (Moderator 에이전트 연동)
- 이메일 알림 (Resend)

### 📅 2주일 내 (Phase 3)
- 마케팅 에이전트 구축 (SEO, Analytics, Campaign Optimizer)
- Error Monitor (Sentry 연동)
- 🆕 여행 위험도 표시 (외교부 API)
- 디자인 에이전트 3개 구축
- 애드센스 신청

### 📅 장기 (Phase 4+)
- 물가 비교 기능 (Numbeo)
- 환율 실시간 연동
- 실시간 시간대 표시
- 🆕 다국어 지원 (next-intl, 영어→스페인어→일본어→한국어)
- Translation Manager 에이전트
- 국가 확장 (50→100→150+)
- 제휴 마케팅 통합

---

## 15. 운영 원칙

### 개발 원칙
- 최대한 자동화, 수동 작업 최소화 (90% 이상 자동화)
- 새 국가/언어 추가가 쉬운 구조
- 에러 자동 감지 → 관리자 알림 → 수정 계획 확인 → 진행
- 모든 AI 생성 콘텐츠는 "생성 AI 모델"과 "생성 일자" 기록
- **정확도 최우선** - 틀린 정보는 사이트 신뢰도 치명

### 소통 원칙
- 불필요한 논의 최소화
- 한 번에 여러 변수와 가능성 고려한 최종안 제시
- 단계별 진행, 각 단계 확인 후 다음 단계

### 의사결정 원칙
- 단기 비용 최소화 우선
- 서비스 안정화 후 예산 투입
- 월 $50 운영비 상한
- 모든 AI 생성 콘텐츠는 관리자 승인 후 게시

### 관리자 작업 시간
- **매일**: 5분 (검토 대기 콘텐츠, 댓글 알림 확인)
- **매주**: 30분 (신규 콘텐츠 승인, 주간 리포트 확인)
- **6개월마다**: 1~2시간 (물가 데이터 검수)

---

## 16. 기술적 세부사항

### Next.js 프로젝트 구조
```
holiday-trip/
├── app/
│   ├── page.tsx (홈페이지)
│   ├── layout.tsx
│   ├── sitemap.ts, robots.ts
│   ├── about/, contact/, privacy/, terms/
│   └── country/[code]/page.tsx
├── lib/
│   └── supabase.ts
├── scripts/
│   ├── seed-holidays.js, expand-countries.js, seed-all-holidays.js
│   ├── test-claude.js, test-gemini.js ✅
│   └── generate-travel-tips.js (🆕 다음 작업)
└── .env.local
```

### 주요 명령어
```bash
npm run dev              # 개발 서버
npm run build            # 프로덕션 빌드
node scripts/[파일].js   # 스크립트 실행
git push                 # Vercel 자동 배포
```

### 캐시 정책
- 홈페이지 & 국가별 페이지: 1시간 캐시 (revalidate = 3600)
- 데이터 변경 시 Vercel 대시보드에서 수동 재배포

---

*문서 종료*
