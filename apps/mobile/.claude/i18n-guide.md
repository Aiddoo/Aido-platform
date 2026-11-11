# i18n 가이드 (다국어)

> **Version**: 1.2.0 · **Last Updated**: 2026-11-07 · **Owner**: Aido Mobile Team

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

**네임스페이스**: `resources.ts`가 정본이다. feature별(`todo`, `voice`, `voicePlan`, `voiceNote` 등)과 횡단 4개(`common`, `errors`, `validation`, `settings`)가 있다. 파일 이름은 kebab-case(`voice-plan.json`), namespace는 camelCase(`voicePlan`)다.

**언어 상태**: `src/shared/preferences/language.preference.ts` (MMKV `aido_language`, `'system'|'ko'|'en'`) + `src/shared/providers/language-provider.tsx` (`useLanguage()` — `resolvedLanguage` 파생, useEffect로 i18n 단방향 동기화. `'system'` 모드는 expo-localization `useLocales()`를 구독해 실행 중 기기 언어 변경도 반영한다). `'system'`은 기기 언어가 한국어면 `ko`, 그 밖의 언어(예: `ja`)와 감지하지 못한 기기는 `en`이다(`toResolvedLanguage`, 규칙은 `@aido/api/vocabulary`의 `resolveSupportedLocale`). 설정 화면: `app/(app)/(tabs)/(mypage)/settings/language.tsx`.

---

## 규칙

### 새 문자열 추가

1. **하드코딩 금지** — 사용자 노출 문자열은 반드시 ko/en 카탈로그 동시 추가 (`locale-parity.test.ts`가 키·보간 변수 불일치를 잡음)
2. 키: `{screen|section}.{element}` camelCase, 최대 3단계 (예: `todo:detail.deleteConfirm.title`)
3. 공용 문구(확인/취소/저장 등)는 `common:actions.*` 재사용

### ko·en 카탈로그 일치

문구는 ko·en에 같은 키로 함께 넣는다. `src/shared/i18n/__tests__/locale-parity.test.ts`가 네임스페이스마다 다음을 막는다. en의 복수형 접미사(`_one`, `_other` 등)는 뗀 키로 비교한다.

- ko와 en의 키 집합이 같다
- 키마다 보간 변수 집합이 같다
- 빈 문자열 값이 없다

안 쓰는 키를 찾는 검사는 없다. 코드를 옮겨 키가 바뀌면 함께 옮기고, 안 쓰게 된 키는 지운다.

언어는 글자만 바꾼다. 오늘, 시간대, 주 시작, 날짜 key에 영향을 주지 않는다.

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
- **enum 라벨 맵**: 값 대신 키를 담는다. 여러 파일이 쓰면 `constants/{feature}-labels.ts`, 한 파일만 쓰면 그 파일 안의 지역 상수다
  ```ts
  export const INQUIRY_CATEGORY_LABEL_KEYS = {
    BUG_REPORT: 'inquiry:category.bugReport',
    ...
  } as const satisfies Record<InquiryCategory, string>;
  // 사용처: t(INQUIRY_CATEGORY_LABEL_KEYS[category])
  ```
- **런타임 키**(에러 코드 등): `tDynamic('errors', code, fallback)` — 타입 검증 우회 전용
- **날짜/시간**: 사용자에게 보이는 날짜·시각은 `@src/shared/date/date-format`의 Intl 헬퍼(formatDateLabel, formatDateKeyLabel, formatYearAwareDateLabel, formatYearAwareDateKeyLabel, formatDateKeyRange, formatClockTime, formatTimeOfDay, formatHourLabel)와 카탈로그 문구를 붙이는 `date-labels.ts`의 formatRelativeTimeLabel·formatWeekOfMonthLabel로만 만든다. 모두 `DateFormatContext`를 인자로 받고, 컴포넌트는 `useDateFormatContext()`로 읽는다 — 재구현·카탈로그 날짜 포맷 금지. dayjs는 날짜 계산과 YYYY-MM-DD key에만 쓰고 기본 locale(en)을 유지한다 — 표시 언어가 주 시작·요일 계산을 바꾸지 않도록 `dayjs.locale()`을 호출하지 않는다. 주는 `date-key.ts` `getCalendarWeek`의 일요일 시작 규칙 하나만 쓴다. "오늘"은 `useToday()`/`useTodayKey()`로 읽어 인자로 넘긴다. 지난 기록·결제일처럼 다른 해일 수 있는 날짜는 `formatYearAwareDateLabel`·`formatYearAwareDateKeyLabel`·`formatDateKeyRange`에 오늘 key를 넘겨 올해면 월·일, 아니면 연도까지 보인다

### 에러 메시지

- 서버 에러: `errors` 네임스페이스, **키 = ErrorCode 그대로** (모든 ErrorCode + `fallback`). `ky-error.ts`의 `resolveMessage`가 카탈로그 → 서버 message → `errors:fallback` 순으로 해석
- 보안 마스킹 그룹(EMAIL_0502/0507, USER_0602 등)은 **두 언어 모두 동일 문구 유지** — 번역 시에도 그룹 단위로 같게
- `@aido/api`의 zod message는 서버 소유(한국어 유지) — 모바일 폼은 필드+에러타입 → `validation:*` 키로 표시

### 문구 톤과 고정 용어

- **ko**: 해요체(`저장했어요`, `다시 시도해주세요`). 보조 용언은 붙여 쓴다(`해주세요`, `모아보세요`, `알려줄게요`). 서버 Swagger·기본 오류 문구의 합니다체와 섞지 않는다.
- **en**: sentence case(`Invite friends`, 제목도 첫 글자만 대문자)로 자연스러운 영어를 쓴다. ko를 직역하지 않고 같은 뜻·같은 보간 변수를 유지한다.
- **고정 용어**: 같은 개념은 모든 화면에서 같은 말을 쓴다.

  | 개념                                                  | ko                                     | en                                     |
  | ----------------------------------------------------- | -------------------------------------- | -------------------------------------- |
  | 앱 이름 (코드 식별자·개발 문서는 대상 아님)           | 아이두                                 | Aido                                   |
  | 탭 / 머리글                                           | 마이 / 내 정보                         | Me / My account                        |
  | 녹음 관리 화면                                        | 녹음 저장 공간                         | Recording storage                      |
  | 마이 탭 횟수 요약 제목                                | 이번 달 AI 사용량                      | AI usage this month                    |
  | 초대 보상 도장                                        | 발자국                                 | paw prints                             |
  | 친구 재촉                                             | 콕 / 콕 찌르기                         | nudge                                  |
  | 초대 보상 기간                                        | 프리미엄 7일                           | 7 days of Premium                      |
  | 말로 할 일 만들기 (마이크 접근성 라벨·코치마크 제목)  | 말로 할 일 만들기                      | Speak to add                           |
  | 할 일 추가 시트 표시 라벨 (남은 횟수 `N번 남음` 포함) | AI로 할 일 만들기 ⓘ · {{count}}번 남음 | Make to-dos with AI ⓘ · {{count}} left |
  | 말로 메모하기 행동·버튼                               | 중요 표시                              | Mark                                   |
  | 표시된 문장                                           | 중요 표시한 문장                       | Marked sentence                        |
  | 표시 개수 (버튼 라벨은 `중요 표시 N`·`Mark N`)        | 중요 표시 N개                          | N marked                               |
  | 표시를 고른 결과 묶음                                 | 핵심 포인트                            | Key points                             |
  | 파형·결과 아이콘 (아이콘 설명에만 쓴다)               | 깃발                                   | flag                                   |
  | 음성 결과                                             | 핵심 포인트 · 요약 · 전체 글           | Key points · Summary · Transcript      |

- ko/en은 같은 키·같은 보간 변수로 함께 추가한다(`locale-parity.test.ts`).
- **마침표**: 버튼·제목·칩·한 문장 토스트에는 찍지 않고, 시트·다이얼로그 설명은 문장마다 찍는다. en은 ko를 따른다.
- **줄바꿈**: 창 제목·짧은 안내는 ko 문구에 `\n`을 넣어 문장 사이에서 나눈다. en은 필요할 때만 넣는다. Android에 단어 단위 줄바꿈 prop이 없어서다. 긴 글은 `WordWrapText`로 그린다.

  | 개념                         | ko                             | en                             | 쓰지 않는 말                               |
  | ---------------------------- | ------------------------------ | ------------------------------ | ------------------------------------------ |
  | 할 일                        | 할 일                          | to-do                          | 투두, 일정                                 |
  | 할 일 아래 항목              | 하위 할 일                     | subtask                        | 항목, 하위 항목, 세부 항목, sub-task       |
  | 메모 탭의 글                 | 메모                           | memo                           | note                                       |
  | 긴 녹음 기능 / 결과물        | 말로 메모하기 / 말로 남긴 메모 | Voice notes / voice note       | 음성 메모                                  |
  | 받아쓰기 입력(접근성 라벨)   | 말로 입력                      | Dictate                        | 음성 입력, 음성으로 입력                   |
  | 소리 파일                    | 녹음 / 녹음 파일               | recording / audio file         | 음성 파일                                  |
  | 기기에 받는 음성 인식 데이터 | 음성 인식 파일                 | speech recognition download    | 모델, 언어 팩, 말을 글자로 바꾸는 파일     |
  | 글자로 바꾼 말(정리 전)      | 들은 내용                      | what we heard                  | 글자, 들은 데까지                          |
  | 글자로 바꾼 말(결과 탭)      | 전체 글                        | Transcript                     |                                            |
  | 말로 할 일 만들기 다시 시작  | 이어서 말하기                  | Keep talking                   | 이어서 듣기                                |
  | 말로 메모하기 다시 시작      | 이어서 녹음 / 계속 녹음        | Resume / Keep recording        | 이어서 듣기, 계속 듣기                     |
  | 재생                         | {{time}}부터 듣기              | Play from {{time}}             |                                            |
  | AI로 요약·나누기 시작        | 정리하기                       | Summarize                      |                                            |
  | 지금까지 받은 말로 정리      | 여기까지 정리                  | Summarize now                  | 여기까지 정리하기                          |
  | 정리 실패 뒤 재시도          | 다시 정리                      | Try again                      | 다시 정리하기, Summarize again             |
  | 그 밖의 재시도 버튼          | 다시 시도                      | Try again                      | 재시도, Retry                              |
  | 지우는 동작                  | 삭제 / 삭제돼요                | Delete                         | 지우기, 지워져요                           |
  | 되돌릴 수 없음               | 되돌릴 수 없어요               | This can't be undone           | 복구할 수 없어요                           |
  | 취소                         | 취소                           | Cancel                         | 그만두기                                   |
  | 알 수 없는 실패              | 문제가 생겼어요                | Something went wrong           | 오류가 발생했어요, 잘 안 됐어요            |
  | 재시도 안내                  | 잠시 후 다시 시도해주세요      | Please try again in a moment   | 잠시 뒤에                                  |
  | 연결 문제                    | 인터넷                         | internet                       | 네트워크                                   |
  | 개수 한도가 찬 상태          | {대상}을 더 추가할 수 없어요   | You can't add more {target}    | 최대 한도에 도달, 가득 찼어요              |
  | 다 쓴 상태                   | {기능}를 다 썼어요             | You've used all your {feature} | 모두 사용, 모두 썼어요                     |
  | 혼자 보는 할 일              | 비공개                         | Private                        | 나만 보기 (말하기 예문 `나만 보게`는 예외) |
  | 정해진 시간 알림             | 리마인드 알림 / 리마인드 시간  | reminder / reminder time       | 리마인더                                   |
  | 연속 달성                    | 연속 기록                      | streak                         | 스트릭                                     |
  | 반복 범위 전체               | 이 반복 전체                   | All in this repeat             | 모든 반복 할 일                            |
  | 반복 횟수 / 한도 수치        | N회                            | N times                        |                                            |
  | 남은 횟수                    | N번                            | N left                         |                                            |
  | 프리미엄                     | 프리미엄                       | Premium (항상 대문자)          | premium                                    |

- **녹음 고지**: `녹음 파일은 아이두 서버로 보내지 않아요` / `Audio files aren't sent to Aido's servers`로 쓴다. `폰에서만`, `이 기기에만`, `기기에서만`은 쓰지 않는다. 기기 백업에 포함될 수 있고 네트워크 인식 경로가 있어서다.
- **`음성 인식`**: 권한 이름과 Apple·Google 처리 고지에만 쓴다(설정 화면의 이름과 같아서). 그 밖의 안내는 `말을 글자로 바꿔요`처럼 쓰고 `인식`, `감지`, `텍스트`, `시간 초과`, `쿨다운`은 쓰지 않는다.
- **`정리`**: AI로 요약·나누는 뜻으로만 쓴다. 오래된 것을 자동으로 없애는 일은 `삭제돼요`로 쓴다.
- **듣기와 녹음**: `듣기`는 재생 뜻으로 남겨 두고, 녹음을 시작·이어 가는 버튼에는 쓰지 않는다.

### 기능 이름·한도·결제 유도

기능 이름은 "무엇을 + 어떻게" 동사형으로 쓰고 기술 용어(AI 파싱, AI 사용 횟수, 인식, 쿼터, 크레딧)는 쓰지 않는다. 숫자는 서버 스냅샷(`GET /v1/entitlements`)·`PLAN_CATALOG`를 보간 변수로 받는다. 한도 안내는 `useEntitlementGate` → `PremiumUpsellBottomSheet`(그날 두 번째부터 토스트) 하나로만 하고 화면마다 토스트·배너 문구를 따로 만들지 않는다. AI 표시 규칙은 [UI 규칙](ui-components.md#ai-기능-표시)에 있다.

| 개념                                     | ko                                       | en                                |
| ---------------------------------------- | ---------------------------------------- | --------------------------------- |
| 글·말·메모로 할 일 만들기 한도(AI_PARSE) | AI 할 일 만들기                          | AI to-dos                         |
| 할 일 추가 시트의 마이크                 | 말로 할 일 만들기                        | Speak to add                      |
| 메모에서 할 일로                         | 메모를 할 일로 나누기                    | Turn memo into to-dos             |
| 긴 녹음 정리(VOICE_NOTE)                 | 말로 메모하기 (요약 행은 말로 메모 정리) | Voice notes                       |
| 정리 버튼 보조 문구                      | 1번 사용 · 이번 달 N번 남음              | Uses 1 · N left this month        |
| 반복                                     | 반복 할 일 / 반복 끝내기                 | repeating to-do / Stop repeating  |
| 남은 횟수(알약)                          | N번 남음 / 이번 달 다 씀·오늘 다 씀      | N left / Used up this month·today |
| 남은 횟수(문장)                          | 이번 달 N번 남았어요                     | N left this month                 |
| 차감 없음(미리 안내, 잘 안 되면)         | 잘 안 되면 횟수는 차감되지 않아요        | If it fails, it doesn't count     |
| 차감 없음(실패 뒤 결과)                  | 횟수는 차감되지 않았어요                 | This didn't count                 |
| 프리미엄 버튼(대안 행동 다음)            | 프리미엄으로 넉넉하게 쓰기               | Get more with Premium             |

- 한도 도달 제목은 `이번 달 {기능}를 다 썼어요`·`오늘 {기능}를 다 썼어요`, 설명은 `{날짜}에 다시 N번 생겨요. 프리미엄은 {혜택}.` 공식을 쓴다(`subscription:gate.*`). `모두 사용했어요`는 `다 썼어요`로 쓴다.
- 한도 수치는 `월 10회`·`하루 3회`, 남은 횟수는 `N번`으로 쓴다. 표 형식 혜택 행은 `회당 3분`, 문장은 `한 번에 3분까지`로 쓴다. `무제한`은 정말 상한이 없는 것(콕 찌르기·친구)에만 쓰고, 공정 사용 상한이 있는 프리미엄 AI는 `넉넉하게(월 1,000회까지)`로 쓴다.
- 결제 화면 혜택 행은 제목 `{기능} {프리미엄 양}`, 설명 `무료는 {무료 양}, 프리미엄은 {프리미엄 양}` 구조다.

### 초대·보상 용어

앱·서버 푸시·스토어·랜딩이 같은 말을 쓴다. 앱 UI와 서버 푸시 모두 해요체를 쓰고, 푸시는 가벼운 이모지(알림 하나에 최대 1개)를 더한다.

**누가·언제·무엇을 받는지 항상 함께 쓴다.** 조건 없이 `함께`·`둘 다`·`친구도 나도 7일`·`both`·`together`로 보상을 말하지 않는다. 보상을 말할 때는 받는 사람과 시점을 짝지어 쓴다.

- 친구(초대받은 사람): `가입하면 바로 프리미엄 7일` / `Your friend: 7 days of Premium right when they join`
- 나(초대한 사람): `친구가 2일 동안 할 일을 끝내면 프리미엄 7일 + 친구 1명 더` / `You: 7 days of Premium + 1 more friend once they complete to-dos on 2 days`
- 자리가 좁으면 한 줄로 줄이거나(`친구는 가입하면 바로, 나는 친구가 2일 하면 프리미엄 7일`) 위 두 줄을 라벨(친구/나, Your friend/You)로 나눠 쓴다.
- 숫자는 보간 변수(`days`, `activeDays`)로 받고, 스토어·랜딩처럼 변수가 없는 곳만 숫자를 직접 쓴다.

| 개념                     | ko                                                                        | en                                                                         |
| ------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 친구 한도 +1 (문장)      | 친구를 1명 더 추가할 수 있어요                                            | add 1 more friend / can add 1 more friend                                  |
| 친구 한도 +1 (짧은 라벨) | 친구 추가 +1명                                                            | +1 friend limit                                                            |
| 한도가 찬 상태           | 친구를 더 추가할 수 없어요 / {{name}}님은 지금 친구를 더 추가할 수 없어요 | You've reached your friend limit / {{name}} has reached their friend limit |
| 초대한 사람 조건         | 친구가 2일 동안 할 일을 끝내면                                            | When they complete to-dos on 2 days                                        |
| 날짜 세는 법             | 하루에 여러 개를 끝내도 1일                                               | Several to-dos on the same day count as 1 day                              |
| 초대한 사람 보상 (요약)  | 프리미엄 7일 + 친구 1명 더                                                | 7 days of Premium + 1 more friend                                          |
| 초대한 사람 보상 (문장)  | 나는 프리미엄 7일을 받고, 친구를 1명 더 추가할 수 있어요                  | you get 7 days of Premium and can add 1 more friend                        |
| 초대받은 사람 보상       | 가입하면 바로 프리미엄 7일을 받고 친구가 돼요                             | 7 days of Premium right when they join, friends right away                 |
| 구독 중 받은 보상        | 구독이 끝난 뒤 이어서 시작돼요                                            | starts after your subscription ends                                        |

- 그대로 쓰는 말: 아이두/Aido, 프리미엄/Premium, 발자국/paw print, 발자국 모으기/Collect paw prints, 콕 찌르기/nudge, 할 일/to-do, 초대 링크·초대 코드/invite link·invite code
- 쓰지 않는 말: `친구 자리`, `자리가 꽉 찼어요`, `friend slot(s)`, `slots are full`, `활동일`, `active days`, `qualify`. 코드·계약 이름(`FRIEND_SLOT`, `friendSlots`)은 바꾸지 않는다.
- 푸시 예: `발자국이 찍혔어요 🐾` / `프리미엄 7일을 받았고, 친구도 1명 더 추가할 수 있어요` · `You got a paw print 🐾` / `You got 7 days of Premium and can add 1 more friend`

### 비번역 대상

- 코드 주석, 로그, Sentry breadcrumb/이벤트 메시지 (개발자용)
- 언어 이름 자체("한국어", "English" — 해당 언어로 고정 표기)
- 서버가 조립해 내려주는 텍스트(푸시 알림 title/body — 서버 locale이 처리)

### 레이아웃 안전 (영어 장문)

- Row 내 텍스트 `shrink`(flexShrink), 고정 width 금지(padding 기반), 필요 시 `numberOfLines` + `ellipsizeMode`
- en 번역은 ko 대비 ~1.4배 길이 상한 가이드
- QA 최악 조합: **en × xlarge 글꼴 스케일**
- 갈라지면 뜻이 흐려지는 묶음(숫자+단위 `{{amount}}\u00a0a\u00a0month`·`월\u00a0{{amount}}회`·`월\u00a0{{price}}`, 문장 속 고유 이름 `App\u00a0Store`·`Privacy\u00a0Policy`)은 카탈로그에서 줄바꿈 없는 공백(`\u00a0`)으로 잇는다. 코드에서 만드는 숫자+단위는 포매터가 같은 공백을 넣는다(`formatFileSize`)

---

## 자산 배치 원칙 (모노레포)

- **카탈로그(locales/\*.json)는 앱 소유** — 소비자가 모바일 하나뿐이라 패키지화하지 않는다 (dist 빌드 체인·Metro 우회 비용만 추가). 서버 푸시 템플릿과 중복 문자열 0건 확인됨 (2026-07)
- **공유 계약은 `@aido/api/errors`의 ErrorCode뿐** — 클라 errors.json이 코드를 키로 소비. 메시지 문구는 서버(정중체)/클라(구어체)로 의도적 분리 유지
- **서버 발송·생성 텍스트(푸시 템플릿, AI 프롬프트)는 서버 소유** — 푸시는 `apps/api/src/i18n/<locale>/notification.json`, AI는 `apps/api/src/modules/ai-assistance/application/prompts/`
- **저장된 히스토리는 생성 당시 언어 유지가 설계** — 과거 알림 title/body, 과거 AI 리포트 본문은 언어 변경 후에도 그대로 (본문-라벨 일관성)

## 서버 연동

- Ky 클라이언트가 `Accept-Language: <i18n.language>` 헤더 전송 (auth/public 공통, beforeRequest 훅). 앱 언어라 값은 `ko`·`en`뿐이고 기기 언어(`ja` 등)를 그대로 보내지 않는다
- 서버는 푸시 기기 보고 때 이 값으로 `UserPreference.locale`을 저장하고 푸시 문구 언어를 정한다 (`apps/api/src/modules/notification/push/application/messages/`)
- 헤더가 없던 옛 앱(1.3.x)은 서버가 `ko`로 본다. 서버가 지원하지 않는 요청 언어를 받았을 때의 규칙(응답 문구는 `en`, 저장값은 옛 호환으로 `ko`)은 [서버 다국어](../../api/docs/i18n.md#언어-결정) 한 곳에 있다

## 테스트

- 카탈로그 정합성: `src/shared/i18n/__tests__/locale-parity.test.ts` (키 집합·보간 변수·빈 값)
- 언어별 동작 검증은 실제 카탈로그로 init 후 `i18n.changeLanguage()` — 카탈로그 모킹 금지
- 테스트 후 `afterEach(() => i18n.changeLanguage('ko'))`로 복원
- 잔여 한국어 검출: `grep -rn '[가-힣]' src app --include='*.ts*' | grep -v locales/ | grep -v '.test.'` (주석 제외 0건 유지)
