# 날짜·시간대·언어·문구

서버와 같은 말로 쓴다. 순간·달력 날짜·벽시계·시간대·표시 언어는 서로 다른 값이고 하나에서 다른 하나를 추측하지 않는다. 공통 기준(값의 종류, 시간대 출처, 떠 있는 시각, 테스트 경계)은 [날짜·시간·언어](../../../docs/conventions/dates.md)이고, 이 문서는 앱 구현이다.

## 날짜와 시간

### 값과 도구

| 값        | 앱 표현                                                                                                                                                                                     | 만드는 곳                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 순간      | `Instant`(ISO 8601 문자열 brand)                                                                                                                                                            | `shared/date/instant.ts`     |
| 달력 날짜 | `DateKey`(`YYYY-MM-DD` 문자열 brand). 경계는 `dateKeySchema`(계약 `dateSchema.brand`)로 한 번 읽고, 검증 안 된 바깥 문자열은 `parseDateKey`(`DateKey \| null`), 폼은 `dateKeyFieldSchema`다 | `shared/date/date-key.ts`    |
| 벽시계    | 모델·전송은 `HH:mm`(`timeOfDaySchema`), 계산·피커는 `TimeOfDay`(`{ hour, minute }`, `toTimeOfDay`·`isTimeOfDayInRange` 포함)                                                                | `shared/date/time-of-day.ts` |
| 시간대    | IANA 이름. 기기 값은 `getDeviceTimezone()`(`shared/infra/localization`)                                                                                                                     | `shared/date/zoned.ts`(계산) |

- 모델·캐시·전송은 문자열 brand다. 문자열은 같은 값이면 같은 참조라 재조회에도 구조 공유가 유지된다. 순간의 사전순 비교(`a < b`)는 오프셋이 다르면 틀리므로 쓰지 않는다.
- 날짜 key 계산(`addDaysToDateKey`·`getMonthStartDateKey`·`toDateKey(instant, timeZone)` 등)은 `DateKey`만 받고 돌려준다. 계산 결과는 `isDateKey`(스키마와 같은 규칙)로 좁혀 칸마다 Zod를 거치지 않고, 0000~9999년을 벗어나면 던진다. 테스트 리터럴은 `src/testing/date-key.ts`의 `createDateKey('2026-11-12')`로 만든다.
- `Date`는 `shared/date/native-date.ts`를 지나는 네이티브 피커·달력·파일 수정 시각 경계에서만 만든다. 앱 모델에 `Date`를 두지 않는다.
- Hermes에는 Temporal이 없고 폴리필도 쓰지 않는다([Temporal spike](#temporal-spike)). 날짜 key 산술은 `date-key.ts`의 순수 계산(Hinnant의 civil 날짜 ↔ 일수 변환), 순간 직렬화는 `Date#toISOString`, 시간대 변환(`zoned.ts`)은 캐시한 `Intl.DateTimeFormat`이다. 테스트는 서버와 같은 Node 26 네이티브 Temporal을 정답으로 비교한다(`src/testing/temporal-oracle.ts`). `dayjs`·`temporal-polyfill` import는 depcruise(`date-library-dayjs`·`date-library-temporal`)가 막는다.
- 같은 계산의 서버↔앱 이름은 [공통 기준의 표](../../../docs/conventions/dates.md#1-값의-종류)에 있다. 날짜 + 벽시계 → 순간은 `toZonedInstant({ date, time, timeZone })` 하나이고 겹치는 시각은 앞쪽, 없는 시각은 전환 뒤 순간이다(Temporal `compatible`). 순간 직렬화는 `Date#toISOString`이라 서버 `toIsoString`(ms 3자리 내림)과 바이트 단위로 같다.
- 표시는 캐시된 `Intl.DateTimeFormat` 하나다. 새 포매터를 만들지 않는다.

```text
shared/date/
  instant.ts  date-key.ts  time-of-day.ts  day-of-week.ts
  zoned.ts       # 시간대 계산(Intl). 순간 ↔ 날짜 key·벽시계
  clock.ts       # 지금(getNowInstant), 오늘 상태, 다음 자정
  format/        # Intl 표시 helper와 카탈로그 문구를 붙이는 label helper
  native-date.ts # Date가 드나드는 유일한 경계
```

### Temporal spike

1.15.2 [10/32]에서 잰 값이다. 같은 검사 1,143개를 Node 26.13.0(ICU 78.3, tzdata 2026e)의 네이티브 Temporal과 Hermes(iOS 27.1 시뮬레이터, Hermes 260318099.0.5, Metro dev 번들)의 `temporal-polyfill` 1.0.8로 돌려 비교했다. 네이티브 결과는 서버 `toZonedInstant`·`localDateIn`·`localDateOf`와 2,835건 모두 같았다.

| 검사                                                                     | Hermes iOS 결과                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| 날짜 + 벽시계 → 순간(9개 시간대 × 11개 날 × 9개 시각)                    | 891/891 서버와 같음                                       |
| 미국·영국 2026 서머타임 틈·겹침(`compatible`·`earlier`·`later`·`reject`) | 16/16                                                     |
| 다음 시간대 전환 찾기(9곳)                                               | 9/9                                                       |
| 순간 → 날짜·시각(서울·뉴욕·런던 등 9곳, 전환 전후 매시)                  | 63/63 구간                                                |
| 하루의 시작·끝·길이(23·25시간, 산티아고 자정 없음)                       | 99/99                                                     |
| 윤일 2028-02-29, ISO 53주 해(2026·2032), 말일 + 달                       | 9 + 13 + 11 모두 같음                                     |
| `Instant`·`PlainDate`·`PlainTime` 읽기·쓰기(오류·옛 시각 포함)           | 32/32                                                     |
| IANA 이름 430개                                                          | 앱을 새로 띄운 뒤 15개 실패(아래)                         |
| 지금 Intl 구현과 비교(날짜 key·HH:mm 각 15,552, 다음 자정 3,888)         | 모두 같음                                                 |
| 지금 Intl 구현의 벽시계 → 순간(891)                                      | 10개 다름: 서머타임 틈·겹침 시각을 서버와 반대쪽으로 읽음 |

- **시간대 이름.** 폴리필은 이름을 대문자로 바꿔 `Intl.DateTimeFormat`에 넘긴다. Hermes iOS는 프로세스에서 처음 보는 대문자 이름 15개(`Asia/Kolkata`, `America/Buenos_Aires`, `America/Indianapolis`, `Asia/Saigon`, `US/Eastern`, `Etc/UTC` 등)를 `RangeError`로 거부한다. 원래 표기로 한 번 만든 뒤에는 통과한다. 인도 기기 시간대(`Asia/Kolkata`)에서 날짜 계산이 던지는 경로다.
- **속도.** 반복 할 일 달력의 최악 경로(365회차까지 하루씩 걷기, `todo-repeat.model.ts`)가 JIT 없는 Node(`--jitless`, Hermes처럼 해석 실행)에서 격주 반복 기준 폴리필 268ms, dayjs 129.8ms, 순수 계산 26ms다(JIT 50.6·36.8·4.7ms). 시간대 변환 2,000번은 Hermes iOS에서 폴리필 79.6ms, Intl 27.1ms다.
- **크기.** 폴리필 README의 19.2kB는 gzip 크기다. `Temporal`만 묶어도 minify 56,113B, `hermesc -O` 바이트코드 159,974B다. dayjs를 쓰던 `date-key`(dayjs + utc·isoWeek 포함)는 바이트코드 27,099B, 순수 계산 `date-key`는 9,717B다.
- **콜드 스타트.** 폴리필은 앱 시작 경로(`LocalDateProvider` 첫 상태 → `getNowInstant`)에서 평가돼 12–22ms가 든다(13번, dev 번들). 진입 → 첫 렌더는 부하(load average 40–50) 때문에 흔들려 차이를 가려낼 수 없었다(없음 1,137–1,374ms, 있음 1,081–2,121ms).
- **결정.** 폴리필을 쓰지 않는다. 날짜 key 산술은 순수 계산, 순간 직렬화는 `Date#toISOString`, 시간대 변환은 Intl이다. 서버와 같은지는 Node 26 Temporal을 정답으로 테스트한다(1900~2200년 날짜 key 36,646개 × 8개 연산, 서머타임 날 벽시계 320개). Intl 벽시계 변환의 서머타임 틈·겹침은 서버 규칙으로 고쳤다. 출력 글자는 49만 개 조합(7개 시간대 × ko·en)에서 바이트 단위로 같다.
- **Android.** 개발 빌드 APK가 없어 기기에서 돌리지 못했다. 날짜 key 산술은 Intl을 쓰지 않아 플랫폼과 무관하다. 출시 전에 Android Hermes에서 아래를 확인한다.
  1. `toDateKey`·`toHHmm`·`toZonedInstant`가 Node 결과와 같다: 서울·뉴욕·런던·산티아고·`Asia/Kolkata`, 2026 서머타임 날 전후 매시와 02:30.
  2. 화면 글자가 iOS와 같다: `formatDateLabel` 9종·`formatClockTime`·상대 시간을 ko·en으로, 특히 오전/오후 앞 공백과 `dayNumber`·`dottedMonthDay`의 en-US 파트.
  3. 시간 피커(`openAndroidTimePicker`·설정 알림 시각)가 고른 시와 분을 그대로 돌려준다(`toPickerDate`의 고정 날짜, 서머타임 시작일 포함).
  4. 자정 전환: 앱을 켠 채 자정을 넘기면 오늘 key·피드·위젯(`readLocalDateKey`)이 함께 바뀐다.
  5. 기기 시간대를 바꾸면 오늘·달력 칸·할 일 시각이 새 시간대로 다시 계산된다(`expo-localization` 달력 시간대와 JS 런타임 시간대가 같은지).

### 오늘과 시계

- 시간대는 기기 달력(`expo-localization`)에서만 온다. 앱의 오늘 key와 자정 전환은 `LocalDateProvider`가 소유하고(자정 timer, foreground, `useCalendars()` 변화에서 다시 평가) 컴포넌트는 `useTodayKey()`(`DateKey`)로 읽는다. Provider 밖(위젯 경계)은 같은 `readDeviceLocalDateState()`를 쓴다. 렌더 중 `new Date()`를 기준 상태로 만들지 않는다.
- 지금 시각은 둘이다. 분 단위로 여러 화면이 함께 보는 지금(상대 시간 "5분 전", 날짜·마감 판단)은 `useMinuteNow()`로 앱 하나의 분 시계(`minute-clock-store`, 분 경계와 앱 복귀에 갱신)를 구독한다. 화면마다 다른 간격이나 마감까지 다시 읽는 지금(쿨다운 초, 녹음 경과, 갱신 시각)은 `useNow({ tickMs?, until? })`다. 새 지금 시계 훅을 만들지 않는다.
- 앱 달력·위젯의 주는 `getCalendarWeek`(일요일 시작), 주간 성취·리포트는 서버와 같은 ISO 주(`getIsoWeekOfMonth`)다. 한 화면에서 두 주 규칙을 섞지 않는다. 주차는 두 체계 모두 주의 가운데 날(수·목요일)이 속한 달의 몇째 주이고 라벨은 체계마다 하나(`formatCalendarWeekLabel`·`formatIsoWeekLabel`, 위젯 제목은 같은 `formatWeekHeaderLabel`)이고 둘 다 오늘 key를 받아 다른 해의 주에 연도를 붙인다([주차 규칙](../../../docs/conventions/dates.md#2-오늘과-시간대의-출처)). 하루 길이 상수는 `shared/constants/time-units.ts`의 `DAY_MS`다.
- 지난 기록·결제일처럼 다른 해일 수 있는 날짜는 year-aware helper에 오늘 key를 넘겨 올해면 월·일(ko "11월 12일", en "Nov 12"), 아니면 연도까지(`monthDayYear`, ko "2025년 11월 12일", en "Nov 12, 2025") 보인다. 7일이 지난 상대 시간과 동의일도 같은 형식이다.
- 언어는 글자만 바꾼다. 오늘·시간대·주 시작·날짜 key에 영향을 주지 않는다.

### 표시

`shared/date/format/`의 helper만 쓴다. 모두 `DateFormatContext { locale, timeZone }`를 인자로 받고 컴포넌트는 `useDateFormatContext()`로 읽는다. 카탈로그에 날짜 형식을 넣거나 화면에서 포맷을 다시 만들지 않는다.

- 달력 날짜 `formatDateKeyLabel`, 순간 `formatDateLabel`, 벽시계 `formatTimeOfDay`, 시각 `formatClockTime`, 시 `formatHourLabel`, year-aware 변형(`date-format.ts`, Intl만 쓴다).
- 카탈로그 문구가 필요한 것은 `date-labels.ts`의 label helper다. 상대 시간 `formatRelativeTimeLabel`(하루가 지나면 달력 날짜로 "어제"·"n일 전"), 오늘·내일 `formatRelativeDayLabel`(`common:relativeDay`), 주차 `formatCalendarWeekLabel`·`formatIsoWeekLabel`, 요일 목록 `formatDaysOfWeek`(구분자 `common:daysOfWeekSeparator`, ko "·", en ", "), 기간 `formatDateKeyRange`·`formatDateKeyCompactRange`와 날짜가 아닌 범위 `formatRangeLabel`(구분자 `common:dateRange.full|compact`, ko "~", en "–")이다. 범위 구분자를 코드나 기능 카탈로그에 다시 쓰지 않는다.
- 할 일 기간 한 줄(일정 칩·상세·음성 계획 카드·삭제 확인)은 `formatTodoPeriod` 하나다. 오늘·내일은 말로, 여러 날은 짧은 범위다.
- 할 일 시각은 `TodoPolicy.getLocalTime(todo, timeZone)` 하나만 표시·수정 기본값에 쓴다. 설정을 읽지 못한 시간 표기는 `USER_PREFERENCE_DEFAULTS.TIME_FORMAT`이다.

### 시간 피커

시간 입력은 `shared/ui/time-picker`의 `<TimeSpinner value onChange timeFormat minimum maximum />` 하나다. Android 시스템 시계는 `openAndroidTimePicker()`(`DateTimePickerAndroid.open`)를 쓴다. 설정(알림 시각)과 할 일 시간이 같은 부품을 쓴다. 날씨 시간 범위는 `@aido/api/vocabulary`의 `WEATHER_HOUR_RANGE`를 쓴다(알림 시간 범위와 다르다).

### 숫자

`Intl.NumberFormat` 캐시를 쓴다. `formatPercent`가 `%`까지 붙이므로 뒤에 `%`를 이어 붙이지 않는다. 개수는 `formatCount`·`formatCompactCount`다. 숫자+단위는 포매터가 줄바꿈 없는 공백을 넣는다(`formatFileSize`).

## 언어

한국어(원문) + 영어. i18next + react-i18next + expo-localization.

```text
src/shared/i18n/
  index.ts         # i18n 싱글턴, t(비컴포넌트용), tDynamic(런타임 키), useTranslation re-export
  init.ts          # 폴리필 → 동기 init (app/_layout.tsx)
  i18next.d.ts     # ko 카탈로그가 타입 소스, 키 오타는 typecheck 실패
  resources.ts     # 언어별 JSON 집계
  app-locales.ts   # 언어 레지스트리
  locales/{ko,en}/ # 네임스페이스별 카탈로그
```

- **언어 레지스트리** `app-locales.ts`: 언어마다 `{ nativeName, intlLocale, speechLocale, pickerLocale }`를 두고 `satisfies Record<SupportedLocale, AppLocaleConfig>`를 건다. 언어 매핑을 다른 곳에 흩어 두지 않는다. 컴포넌트는 `useLocaleContext()`(`shared/hooks`)로 읽고, React 밖은 `APP_LOCALES[language]`·`getTimePickerLocale`·`toLanguageOfIntlLocale`을 쓴다. 카탈로그 묶음 `resources.ts`도 `satisfies Record<SupportedLocale, …>`다.
- `fallbackLng`는 `@aido/api/vocabulary`의 `FALLBACK_LOCALE`(`'en'`)이다.
- **언어 선택**: 저장 값(`'system'|'ko'|'en'`, `aido_language`)과 `LanguageProvider`의 `useLanguage()`(`resolvedLanguage`)가 i18n과 단방향으로 동기화한다. `'system'`은 `useLocales()`를 구독해 기기 언어 변경도 반영한다. 기기 언어가 한국어면 `ko`, 그 밖과 감지 실패는 `en`이다(`resolveSupportedLocale`, `@aido/api/vocabulary`). 화면: `app/(app)/(tabs)/(mypage)/settings/language.tsx`.
- 네임스페이스는 `resources.ts`가 정본이다. 기능별과 횡단 4개(`common`, `errors`, `validation`, `settings`). 파일은 kebab-case(`voice-plan.json`), namespace는 camelCase(`voicePlan`)다.

### 언어를 추가하려면

1. `@aido/api/vocabulary`의 지원 언어 튜플에 추가한다(서버가 같은 값을 쓴다).
2. `locales/{lang}/` 카탈로그를 만든다. parity 테스트가 모든 언어를 돌아 키·보간 변수·빈 값을 검사한다.
3. `app-locales.ts`에 한 항목을 더한다(`satisfies`가 빠뜨림을 막는다).
4. 네이티브·스토어 자산(위젯 갤러리 `native-locales/{lang}.json`, 스토어 등록 정보, 권한 문구)을 더한다.
5. 서버 푸시·AI 문구 언어는 서버 쪽에서 따로 더한다([서버 다국어](../../api/docs/i18n.md)).

### 새 문자열

1. 하드코딩하지 않는다. 사용자 노출 문자열은 모든 카탈로그에 함께 넣는다(`locale-parity.test.ts`가 en 복수형 접미사를 뗀 키로 비교해 키 집합·보간 변수·빈 값을 막는다). 안 쓰는 키를 찾는 검사는 없으므로 코드를 옮기며 안 쓰게 된 키를 지운다.
2. 키는 `{screen|section}.{element}` camelCase, 최대 3단계(`todo:detail.deleteConfirm.title`).
3. 공용 문구(확인·취소·저장)는 `common:actions.*`를 재사용한다.

```tsx
const { t } = useTranslation('todo'); // 컴포넌트: 언어 변경 시 자동 리렌더
import { t } from '@src/shared/i18n'; // 비컴포넌트(오류 팩토리, 토스트 헬퍼): 싱글턴
toast.error(t('friend:toast.sendFailed'));
```

- 모듈 로드 시점에 `const MSG = t('...')`로 평가하지 않는다. 호출 시점에 `t()`한다.
- ns 바인딩된 `useTranslation('ns')`의 t는 다른 ns 접두사 키를 거부한다. 여러 ns는 `useTranslation(['ns', 'common'])`나 싱글턴을 쓴다.
- 보간 `t('repeat.weekly', { days })`, 복수형은 ko 단일 키·en `_one`/`_other`(`t('list.count', { count })`).
- enum 라벨은 값 대신 키를 담는다: `INQUIRY_CATEGORY_LABEL_KEYS = { … } as const satisfies Record<InquiryCategory, string>`. 여러 파일이 쓰면 `utils/{name}.view-model.ts`의 `get{X}LabelKey`, 한 파일만 쓰면 파일 안 지역 상수다. `constants/`와 모델에 두지 않는다.
- 런타임 키(오류 코드)는 `tDynamic('errors', code, fallback)`이다. 타입 검증 우회 전용이다.

### 오류 메시지

- 서버 오류는 `errors` 네임스페이스, 키 = ErrorCode 그대로(`fallback` 포함)다. `ky-error.ts`의 `resolveMessage`가 카탈로그 → 서버 message → `errors:fallback` 순으로 푼다.
- 보안 마스킹 그룹(EMAIL_0502/0507, USER_0602 등)은 두 언어 모두 같은 문구다.
- `@aido/api` zod message는 서버 소유(한국어)이고 모바일 폼은 필드+오류 종류 → `validation:*` 키로 보인다.

### 비번역 대상

코드 주석·로그·Sentry 메시지, 언어 이름 자체("한국어", "English"), 서버가 조립하는 텍스트(푸시 title/body)다.

## 문구 톤과 용어

- **ko**: 해요체(`저장했어요`, `다시 시도해주세요`). 보조 용언은 붙여 쓴다(`해주세요`). 서버 합니다체와 섞지 않는다. 앱 이름은 "아이두".
- **en**: sentence case(`Invite friends`)로 자연스러운 영어를 쓴다. ko를 직역하지 않고 같은 뜻·보간 변수를 유지한다. 앱 이름은 "Aido".
- **마침표**: 버튼·제목·칩·한 문장 토스트에는 찍지 않고, 시트·다이얼로그 설명은 문장마다 찍는다.
- **줄바꿈**: 창 제목·짧은 안내는 ko 문구에 `\n`을 넣어 문장 사이에서 나눈다(Android에 단어 단위 줄바꿈 prop이 없다). 긴 글은 `WordWrapText`로 그린다.
- 같은 개념은 모든 화면에서 같은 말을 쓴다.

| 개념                         | ko                                | en                                      | 쓰지 않는 말                 |
| ---------------------------- | --------------------------------- | --------------------------------------- | ---------------------------- |
| 할 일 / 하위 할 일           | 할 일 / 하위 할 일                | to-do / subtask                         | 투두, 일정 / 항목, 세부 항목 |
| 메모 탭의 글                 | 메모                              | memo                                    | note                         |
| 긴 녹음 기능                 | 말로 메모하기 / 말로 남긴 메모    | Voice notes                             | 음성 메모                    |
| 말로 할 일 만들기            | 말로 할 일 만들기                 | Speak to add                            | 음성 입력                    |
| 받아쓰기 입력                | 말로 입력                         | Dictate                                 | 음성으로 입력                |
| 소리 파일 / 기기 인식 데이터 | 녹음 / 음성 인식 파일             | recording / speech recognition download | 음성 파일 / 모델, 언어 팩    |
| 글자로 바꾼 말               | 들은 내용(정리 전), 전체 글(결과) | what we heard, Transcript               | 글자                         |
| AI로 요약·나누기             | 정리하기 / 다시 정리              | Summarize / Try again                   |                              |
| 그 밖의 재시도               | 다시 시도                         | Try again                               | 재시도, Retry                |
| 앞으로의 때 / 다시 보내기    | 1분 뒤, 3일 뒤 / 다시 보내기      | in 1 minute, in 3 days / Resend         | 1분 후, 3일 후 / 재발송      |
| 삭제 / 되돌릴 수 없음        | 삭제 / 되돌릴 수 없어요           | Delete / This can't be undone           | 지우기 / 복구할 수 없어요    |
| 알 수 없는 실패              | 문제가 생겼어요                   | Something went wrong                    | 오류가 발생했어요            |
| 연결 문제                    | 인터넷                            | internet                                | 네트워크                     |
| 개수 한도가 찬 상태          | {대상}을 더 추가할 수 없어요      | You can't add more {target}             | 최대 한도에 도달             |
| 다 쓴 상태 / 남은 횟수       | {기능}를 다 썼어요 / N번          | You've used all your {feature} / N left | 모두 사용                    |
| 혼자 보는 할 일              | 비공개                            | Private                                 | 나만 보기                    |
| 정해진 시간 알림             | 리마인드 알림                     | reminder                                | 리마인더                     |
| 연속 달성                    | 연속 기록                         | streak                                  | 스트릭                       |
| 초대 보상 도장 / 친구 재촉   | 발자국 / 콕 찌르기                | paw prints / nudge                      |                              |
| 프리미엄                     | 프리미엄                          | Premium(항상 대문자)                    | premium                      |

- **녹음 고지**: `녹음 파일은 아이두 서버로 보내지 않아요` / `Audio files aren't sent to Aido's servers`. `폰에서만`·`이 기기에만`은 쓰지 않는다(백업 포함·네트워크 인식 경로가 있다).
- **`음성 인식`**은 권한 이름과 Apple·Google 처리 고지에만 쓴다. 그 밖은 `말을 글자로 바꿔요`처럼 쓰고 `인식`·`텍스트`·`시간 초과`·`쿨다운`은 쓰지 않는다. **`정리`**는 AI 요약·나누기에만 쓴다(자동 삭제는 `삭제돼요`). `듣기`는 재생 뜻으로만 쓴다.
- **기능 이름·한도·결제 유도**: 기능 이름은 "무엇을 + 어떻게" 동사형이고 AI 파싱·쿼터·크레딧 같은 기술 용어를 쓰지 않는다. 숫자는 서버 스냅샷(`GET /v1/entitlements`)·`PLAN_CATALOG`를 보간 변수로 받는다. 한도 안내는 `useEntitlementGate` → `PremiumUpsellBottomSheet`(그날 두 번째부터 토스트) 하나뿐이다. 제목은 `이번 달 {기능}를 다 썼어요`·`오늘 {기능}를 다 썼어요`, 설명은 `{날짜}에 다시 N번 생겨요. 프리미엄은 {혜택}.`(`subscription:gate.*`)다. 한도 수치는 `월 10회`·`하루 3회`, 남은 횟수는 `N번`이다. `무제한`은 정말 상한이 없는 것(콕 찌르기·친구)에만 쓰고 공정 사용 상한이 있는 프리미엄 AI는 `넉넉하게(월 1,000회까지)`로 쓴다.
- **초대·보상**: 앱 UI·서버 푸시·스토어·랜딩이 같은 말을 쓴다. 누가·언제·무엇을 받는지 항상 함께 쓰고 조건 없이 `함께`·`둘 다`·`both`로 말하지 않는다. 친구는 `가입하면 바로 프리미엄 7일`, 나는 `친구가 2일 동안 할 일을 끝내면 프리미엄 7일 + 친구 1명 더`다(하루에 여러 개를 끝내도 1일). 숫자는 보간 변수(`days`, `activeDays`)로 받는다. `친구 자리`·`자리가 꽉 찼어요`·`friend slot`·`활동일`·`active days`는 쓰지 않는다(코드 이름 `FRIEND_SLOT`은 그대로). 푸시는 가벼운 이모지를 알림 하나에 최대 1개 더한다.

### 레이아웃 안전

- Row 안 텍스트는 `shrink`, 고정 width를 쓰지 않는다(padding 기반). 필요하면 `numberOfLines` + `ellipsizeMode`. en은 ko의 약 1.4배 길이를 상한으로 본다.
- QA 최악 조합은 en × xlarge 글꼴 스케일이다.
- 갈라지면 뜻이 흐려지는 묶음(`{{amount}} a month`, `월 {{price}}`, `App Store`)은 카탈로그에서 줄바꿈 없는 공백(` `)으로 잇는다.

## 자산과 서버 연동

- 카탈로그(`locales/*.json`)는 앱 소유다. 소비자가 앱 하나뿐이라 패키지화하지 않는다. 공유 계약은 `@aido/api/errors`의 ErrorCode뿐이고 문구는 서버(정중체)/앱(구어체)으로 의도적으로 나눈다.
- 서버 발송·생성 텍스트(푸시 템플릿, AI 프롬프트)는 서버 소유다. 저장된 알림·AI 리포트는 생성 당시 언어를 유지한다.
- Ky 클라이언트가 `Accept-Language: <i18n.language>`를 보낸다(공개·인증 공통). 앱 언어라 `ko`·`en`뿐이다. 서버가 푸시 기기 보고 때 이 값으로 푸시 문구 언어를 저장한다. 서버가 지원하지 않는 요청 언어를 받았을 때의 규칙은 [서버 다국어](../../api/docs/i18n.md#언어-결정) 한 곳에 있다.

## 테스트

- 카탈로그 정합성은 `src/shared/i18n/__tests__/locale-parity.test.ts`(모든 언어, 키·보간 변수·빈 값)다.
- 언어별 동작은 실제 카탈로그로 init한 뒤 `i18n.changeLanguage()`로 검증한다. 카탈로그를 mock하지 않고 `afterEach`에서 `ko`로 복원한다.
- 날짜 경계는 같은 instant를 서울·LA × ko/en으로 돌려 언어가 결과를 바꾸지 않는지 순수 함수로 확인한다([날짜 경계](../../../docs/conventions/dates.md#4-테스트할-경계)).
- 잔여 한국어 검출: `grep -rn '[가-힣]' src app --include='*.ts*' | grep -v locales/ | grep -v '.test.'`(주석 제외 0건 유지).
