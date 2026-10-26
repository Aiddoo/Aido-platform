# i18n 가이드 (다국어)

> **Version**: 1.0.0 · **Last Updated**: 2026-07-07 · **Owner**: Aido Mobile Team

한국어(소스 언어, 원문 보존) + 영어. i18next + react-i18next + expo-localization 기반.

---

## 구조

```
src/shared/i18n/
├── index.ts           # i18n 싱글턴, t(비컴포넌트용), tDynamic(런타임 키), useTranslation re-export
├── init.ts            # 폴리필 → 동기 init (app/_layout.tsx에서 로드)
├── i18next.d.ts       # 타입 안전 — ko 카탈로그가 타입 소스, 키 오타는 typecheck에서 실패
├── resources.ts       # ko/en JSON 집계
└── locales/{ko,en}/   # 네임스페이스별 카탈로그 (ko = 원문)
```

**네임스페이스**: feature 1:1 (`todo, todoComment, auth, memo, friend, invite, notification, user, subscription, ai, achievement, inquiry, weather, widget, appIcon, appVersion, featureDiscovery, storeReview`) + 횡단 4개 (`common, errors, validation, settings`). 정본은 `resources.ts`다.

**언어 상태**: `src/shared/preferences/language.preference.ts` (MMKV `aido_language`, `'system'|'ko'|'en'`) + `src/shared/providers/language-provider.tsx` (`useLanguage()` — `resolvedLanguage` 파생, useEffect로 i18n 단방향 동기화. `'system'` 모드는 expo-localization `useLocales()`를 구독해 실행 중 기기 언어 변경도 반영한다). 설정 화면: `app/(app)/settings/language.tsx`.

---

## 규칙

### 새 문자열 추가

1. **하드코딩 금지** — 사용자 노출 문자열은 반드시 ko/en 카탈로그 동시 추가 (`locale-parity.test.ts`가 키·보간 변수 불일치를 CI에서 잡음)
2. 키: `{screen|section}.{element}` camelCase, 최대 3단계 (예: `todo:detail.deleteConfirm.title`)
3. 공용 문구(확인/취소/저장 등)는 `common:actions.*` 재사용

### 컴포넌트 vs 비컴포넌트

```tsx
// 컴포넌트 — 언어 변경 시 자동 리렌더
const { t } = useTranslation('todo');
<Text>{t('list.empty')}</Text>;

// 비컴포넌트(에러 팩토리, mutation onError, 토스트 헬퍼) — 싱글턴
import { t } from '@src/shared/i18n';
toast.error(t('friend:toast.sendFailed'));
```

- **모듈 로드 시점 평가 금지**: `const MSG = t('...')` (톱레벨) ❌ — 언어 변경 시 갱신 안 됨. 반드시 호출 시점 `t()`.
- ns 바인딩된 `useTranslation('ns')`의 t는 크로스 ns 접두사 키를 타입에서 거부 → 크로스 ns는 `useTranslation(['ns', 'common'])` 배열 또는 싱글턴 `t as tGlobal`.

### 패턴

- **보간**: `t('repeat.weekly', { days })` / 카탈로그 `"매주 {{days}} 반복"`
- **복수형**: ko는 단일 키(`"{{count}}개"`), en은 `_one`/`_other` 접미사 — `t('list.count', { count })`
- **enum 라벨 맵**: 값 대신 키를 담는다
  ```ts
  export const INQUIRY_CATEGORY_LABEL_KEYS = {
    BUG_REPORT: 'inquiry:category.bugReport',
    ...
  } as const satisfies Record<InquiryCategory, string>;
  // 사용처: t(INQUIRY_CATEGORY_LABEL_KEYS[category])
  ```
- **런타임 키**(에러 코드 등): `tDynamic('errors', code, fallback)` — 타입 검증 우회 전용
- **날짜/시간**: 사용자에게 보이는 날짜·시각은 `@src/shared/utils/date-format`의 Intl 헬퍼(formatDateLabel, formatDateKeyLabel, formatDateKeyRange, formatClockTime, formatTimeOfDay, formatHourLabel)와 카탈로그 문구를 붙이는 `date.ts`의 formatRelativeTimeLabel·formatWeekOfMonthLabel로만 만든다. 모두 `DateFormatContext`를 인자로 받고, 컴포넌트는 `useDateFormatContext()`로 읽는다 — 재구현·카탈로그 날짜 포맷 금지. dayjs는 날짜 계산과 YYYY-MM-DD key에만 쓰고 기본 locale(en)을 유지한다 — 표시 언어가 주 시작·요일 계산을 바꾸지 않도록 `dayjs.locale()`을 호출하지 않는다. 주는 `calendar-week.ts`의 일요일 시작 규칙 하나만 쓴다. "오늘"은 `useToday()`/`useTodayKey()`로 읽어 인자로 넘긴다

### 에러 메시지

- 서버 에러: `errors` 네임스페이스, **키 = ErrorCode 그대로** (모든 ErrorCode + `fallback`). `error-handler.ts`의 `resolveMessage`가 카탈로그 → 서버 message → `errors:fallback` 순으로 해석
- 보안 마스킹 그룹(EMAIL_0502/0507, USER_0602 등)은 **두 언어 모두 동일 문구 유지** — 번역 시에도 그룹 단위로 같게
- `@aido/api`의 zod message는 서버 소유(한국어 유지) — 모바일 폼은 필드+에러타입 → `validation:*` 키로 표시

### 문구 톤과 고정 용어

- **ko**: 해요체(`저장했어요`, `다시 시도해주세요`). 보조 용언은 붙여 쓴다(`해주세요`, `모아보세요`, `알려줄게요`). 서버 Swagger·기본 오류 문구의 합니다체와 섞지 않는다.
- **en**: sentence case(`Invite friends`, 제목도 첫 글자만 대문자)로 자연스러운 영어를 쓴다. ko를 직역하지 않고 같은 뜻·같은 보간 변수를 유지한다.
- **고정 용어**: 같은 개념은 모든 화면에서 같은 말을 쓴다.

  | 개념           | ko             | en                |
  | -------------- | -------------- | ----------------- |
  | 앱 이름        | 아이두         | Aido              |
  | 초대 보상 도장 | 발자국         | paw prints        |
  | 친구 재촉      | 콕 / 콕 찌르기 | nudge             |
  | 초대 보상 기간 | 프리미엄 7일   | 7 days of Premium |

- ko/en은 같은 키·같은 보간 변수로 함께 추가한다(`locale-parity.test.ts`).

### 초대·보상 용어

앱·서버 푸시·스토어·랜딩이 같은 말을 쓴다. 앱 UI는 해요체, 서버 푸시는 기존 반말 + 가벼운 이모지 톤을 유지한다.

| 개념                     | ko                                                                        | en                                                                         |
| ------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 친구 한도 +1 (문장)      | 친구를 1명 더 추가할 수 있어요                                            | add 1 more friend / can add 1 more friend                                  |
| 친구 한도 +1 (짧은 라벨) | 친구 추가 +1명                                                            | +1 friend limit                                                            |
| 한도가 찬 상태           | 친구를 더 추가할 수 없어요 / {{name}}님은 지금 친구를 더 추가할 수 없어요 | You've reached your friend limit / {{name}} has reached their friend limit |
| 초대한 사람 조건         | 친구가 2일 동안 할 일을 끝내면                                            | When they complete to-dos on 2 days                                        |
| 날짜 세는 법             | 하루에 여러 개를 끝내도 1일                                               | Several to-dos on the same day count as 1 day                              |
| 초대한 사람 보상 (요약)  | 프리미엄 7일 + 친구 1명 더                                                | 7 days of Premium + 1 more friend                                          |
| 초대한 사람 보상 (문장)  | 나도 프리미엄 7일을 받고, 친구를 1명 더 추가할 수 있어요                  | you get 7 days of Premium and can add 1 more friend                        |
| 초대받은 사람 보상       | 가입하면 프리미엄 7일, 바로 친구가 돼요                                   | 7 days of Premium when they join, friends right away                       |
| 구독 중 받은 보상        | 구독이 끝난 뒤 이어서 시작돼요                                            | starts after your subscription ends                                        |

- 그대로 쓰는 말: 아이두/Aido, 프리미엄/Premium, 발자국/paw print, 발자국 모으기/Collect paw prints, 콕 찌르기/nudge, 할 일/to-do, 초대 링크·초대 코드/invite link·invite code
- 쓰지 않는 말: `친구 자리`, `자리가 꽉 찼어요`, `friend slot(s)`, `slots are full`, `활동일`, `active days`, `qualify`. 코드·계약 이름(`FRIEND_SLOT`, `friendSlots`)은 바꾸지 않는다.
- 푸시 예: `발자국이 찍혔어 🐾` / `프리미엄 7일을 받았고, 친구도 1명 더 추가할 수 있어` · `You got a paw print 🐾` / `You got 7 days of Premium and can add 1 more friend`

### 비번역 대상

- 코드 주석, 로그, Sentry breadcrumb/이벤트 메시지 (개발자용)
- 언어 이름 자체("한국어", "English" — 해당 언어로 고정 표기)
- 서버가 조립해 내려주는 텍스트(푸시 알림 title/body — 서버 locale이 처리)

### 레이아웃 안전 (영어 장문)

- Row 내 텍스트 `shrink`(flexShrink), 고정 width 금지(padding 기반), 필요 시 `numberOfLines` + `ellipsizeMode`
- en 번역은 ko 대비 ~1.4배 길이 상한 가이드
- QA 최악 조합: **en × xlarge 글꼴 스케일**

---

## 자산 배치 원칙 (모노레포)

- **카탈로그(locales/\*.json)는 앱 소유** — 소비자가 모바일 하나뿐이라 패키지화하지 않는다 (dist 빌드 체인·Metro 우회 비용만 추가). 서버 푸시 템플릿과 중복 문자열 0건 확인됨 (2026-07)
- **공유 계약은 `@aido/api/errors`의 ErrorCode뿐** — 클라 errors.json이 코드를 키로 소비. 메시지 문구는 서버(정중체)/클라(구어체)로 의도적 분리 유지
- **서버 발송·생성 텍스트(푸시 템플릿, AI 프롬프트)는 서버 소유** — 푸시는 `apps/api/src/modules/notification/application/messages/delivery/locales/`, AI는 `apps/api/src/modules/ai-assistance/application/prompts/`
- **저장된 히스토리는 생성 당시 언어 유지가 설계** — 과거 알림 title/body, 과거 AI 리포트 본문은 언어 변경 후에도 그대로 (본문-라벨 일관성)

## 서버 연동

- Ky 클라이언트가 `Accept-Language: <i18n.language>` 헤더 전송 (auth/public 공통, beforeRequest 훅)
- 서버는 푸시 토큰 등록 시 `UserPreference.locale` upsert → 푸시 알림 언어 결정 (`apps/api/src/modules/notification/application/messages/delivery/`)
- 미전송(1.3.x)·미지원 언어는 서버가 'ko'로 처리 — 하위 호환

## 테스트

- 카탈로그 정합성: `src/shared/i18n/__tests__/locale-parity.test.ts` (키 집합·보간 변수·빈 값)
- 언어별 동작 검증은 실제 카탈로그로 init 후 `i18n.changeLanguage()` — 카탈로그 모킹 금지
- 테스트 후 `afterEach(() => i18n.changeLanguage('ko'))`로 복원
- 잔여 한국어 검출: `grep -rn '[가-힣]' src app --include='*.ts*' | grep -v locales/ | grep -v '.test.'` (주석 제외 0건 유지)
