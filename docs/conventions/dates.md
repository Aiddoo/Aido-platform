# 날짜·시간·언어

서버·모바일 공통 기준이다. "순간(instant)", "달력 날짜", "시간대", "표시 언어"는 서로 다른 값이며 하나에서 다른 하나를 추측하지 않는다.

## 1. 값의 종류

| 값          | 저장·전송                                                          | 예                                               |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| 순간        | DB `timestamp(3)`·`timestamptz(3)`(UTC), API ISO datetime/epoch ms | `createdAt`, `expiresAt`, `Todo.scheduledTime`   |
| 달력 날짜   | DB `date`, API `YYYY-MM-DD`                                        | 할 일 `startDate`, 피드 `date`                   |
| 벽시계 시각 | DB `varchar(5)`, API `HH:mm`(`timeOfDaySchema`)                    | 할 일 `scheduledLocalTime`, 설정의 리마인더 시각 |
| 시간대      | IANA 이름(`Asia/Seoul`)                                            | `X-Timezone`, `UserPreference.timezone`          |
| 표시 언어   | `ko` / `en`                                                        | `Accept-Language`, 앱 언어 설정                  |

- **할 일 시간은 떠 있는 시각이다.** 진실은 달력 날짜 + 벽시계이고 어디서든 그 시각이다. `Todo.scheduledTime`(순간)은 `날짜 + 벽시계 + 사용자 현재 시간대`로 만든 파생값으로 알림과 출시 앱 호환에 쓴다([5절](#5-떠-있는-시각)).
- **모바일 앱 모델의 순간은 `Instant`다.** `shared/date/instant.ts`의 ISO 8601 문자열 brand(`instantSchema`는 Zod `.brand()`, 오프셋 표기도 받는다)로 서버 값을 `toInstant`로 한 번 검증해 `Date` 변환 없이 둔다. `Date`는 구조 공유가 안 돼 재조회마다 모든 항목이 다시 그려지지만 문자열은 같은 값이면 같은 참조다(메모 18개 재조회: 참조 유지 0개 → 18개). 읽기·비교는 `toDateKey(instant, timeZone)`, `toHHmm(instant, timeZone)`, `formatDateLabel(instant, …)`, `toEpochMs`, `isBefore`, `diffMs`를 쓴다. 문자열 사전순 비교(`a < b`)는 오프셋이 다르면 틀리므로 쓰지 않는다. `Date`는 네이티브 피커 같은 경계 컴포넌트 안에서만 만든다. 초안 `sourceUpdatedAt`처럼 숫자로 저장된 값은 `toEpochMs(instant)`로 `Date#getTime()`과 같은 값을 만든다. 영속 캐시는 JSON 그대로 저장한다. 옛 `$date` 직렬화는 지웠고 `QUERY_CACHE_SCHEMA_VERSION`을 5로 올려 옛 캐시를 버린다. 지금 순간은 `getNowInstant()`, 분 단위 현재 시각은 `useMinuteNow()`(`Instant`)다. 앱 모델에 `Date`를 두지 않으며, 네이티브 피커·달력·파일 수정 시각(`LocalFileEntry.modifiedAt`)만 경계에서 `Date`를 쓴다.
- 달력 날짜를 process 시간대의 `Date`로 바꾼 뒤 요일·자정을 계산하지 않는다. 날짜 산술은 `YYYY-MM-DD` key로 한다.
- 서버 process(Docker `ENV TZ=UTC`·CI `TZ: UTC`)와 PostgreSQL 세션(`TimeZone=UTC`)은 UTC로 고정한다. 그래도 코드는 process 시간대에 의존하지 않는다.
- **서버 날짜 계산은 Temporal이다.** 순간은 `Temporal.Instant`, 달력 날짜는 `Temporal.PlainDate`, 벽시계는 `Temporal.PlainTime`(분 단위), 시간대 계산은 IANA 이름을 명시한 `ZonedDateTime`이다. 서버의 현재 시각은 `ClockPort.now()` 하나다. 계약(`@aido/api`)은 문자열을 유지하고(Hermes에는 Temporal이 없다) 변환은 서버 presentation 경계에서만 한다. 순간 직렬화는 `toIsoString`(ms 3자리)으로 `Date#toISOString()`과 바이트 단위로 같다. `Temporal.Instant`는 `<`·`>`로 비교하지 않고 `Temporal.Instant.compare`를 쓴다. 서버 상세는 [영속성](../../apps/api/docs/persistence.md#시간-칼럼)에 있다.
- 서버에는 dayjs가 없다. 모바일은 Temporal을 쓰지 않는다.

## 2. "오늘"과 시간대의 출처

- **서버**: 앱 헤더는 요청마다 한 번 `RequestClient`(`apps/api/src/platform/http/request-client`)로 정규화한다. Controller는 `@Headers("x-timezone")`로 직접 읽지 않고 `@Timezone()`·`@Locale()`·`@AppVersion()`·`@CurrentRequestClient()`를 쓴다([서버 HTTP 계약](../../apps/api/docs/http-contracts.md#요청-헤더와-throttle)). `timezone`은 런타임이 지원하는 IANA 이름이거나 null이다. 헤더가 없거나 잘못됐을 때의 규칙은 `request-timezone.ts`의 두 함수뿐이고, 엔드포인트마다 아래 규칙 하나를 쓴다.

  | 규칙                  | 함수·데코레이터                                                         | 헤더 없음·오류        | 쓰는 곳                                                                                      |
  | --------------------- | ----------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
  | 날짜 경계             | `requestTimezoneOrUtc` · `@Timezone()`                                  | `UTC`                 | 할 일·메모·응원·찌르기·초대·`/v1/auth/me`, 활동일 기록(`LastActiveInterceptor`)              |
  | 저장 시간대 사용·보존 | `requestTimezoneIfSent` · `@Timezone({ preserveIfMissing: true })`      | `undefined`           | AI 생성·제안·리포트(저장된 사용자 시간대로 대체), 푸시 기기 보고·토큰 등록(기존 저장값 유지) |
  | 저장값 갱신           | `RequestClientReader.current().timezone`                                | 갱신하지 않음         | 시간대 자가 치유(`TimezoneSelfHealInterceptor`)                                              |
  | 벽시계 해석           | `@Timezone({ preserveIfMissing: true })` + `ResolveTodoTimezoneUseCase` | 저장값 → `Asia/Seoul` | 할 일 생성·수정·일정 변경·메모 변환·계획 적용(5절)                                           |

  응답 형태는 규칙과 무관하다. 새 엔드포인트는 위 규칙 중 하나를 고르고 `X-Timezone`을 직접 읽지 않는다. 배치는 사용자별 저장 시간대로 계산한다. 공용 helper는 `apps/api/src/shared/domain/time`(`TimeZone` VO, `localDateIn`, `localDateOf`, `toZonedInstant`, `resolveTimezone`, `toIsoString`)이다. 한 순간의 사용자 달력 날짜는 `localDateIn(instant, timezone)`으로 구하고 `Intl.DateTimeFormat` 포매터를 새로 만들지 않는다. 사용자 기본 시간대 폴백은 `DEFAULT_DELIVERY_TIMEZONE`이다.

- **모바일**: 시간대는 기기 달력(`expo-localization` `getCalendars()[0].timeZone`)에서만 온다. 앱 전체의 오늘 key·자정 전환은 `LocalDateProvider`(`apps/mobile/src/shared/providers/local-date-provider.tsx`)가 소유하고, Provider 밖(위젯 경계)은 같은 `readDeviceLocalDateState()`를 쓴다. 컴포넌트는 `useToday`/`useTodayKey`로 읽고 render 중 `new Date()`를 기준 상태로 만들지 않는다. 상대 시간처럼 분 단위로 바뀌는 표시는 `useMinuteNow()`를 쓴다. `Date`의 달력 날짜·요일은 `shared/date/instant.ts`의 `toDateKey(date, timeZone)`로 key를 만든 뒤 계산하고, 하루 길이 상수는 `shared/constants/time-units.ts`의 `DAY_MS` 하나를 쓴다. 시간대 인자는 생략할 수 없고 기기 시간대는 `shared/infra/localization/device-timezone.ts`의 `getDeviceTimezone()`이다.
- 언어: 앱은 기기 언어가 한국어면 `ko`, 그 밖은 `en`을 앱 언어로 쓰고 요청마다 `Accept-Language`로 보낸다. 서버는 같은 `@aido/api/vocabulary` `resolveSupportedLocale`(없음 `ko`, 지원하지 않는 언어 `en`)로 응답 문구와 푸시 문구의 언어를 정한다. 예외는 저장·알림함·날씨에 쓰는 요청 언어 `RequestClient.locale`(`@Locale()`, `parseAcceptLanguage`)로, 헤더가 없으면 null(저장값 유지)이고 지원하지 않는 언어는 옛 호환으로 `ko`다. 출시 앱은 `ko`·`en`만 보내 이 경로를 타지 않는다. 표와 이유: [서버 다국어](../../apps/api/docs/i18n.md#언어-결정).
- 음성 인식 언어는 사용자가 고른 값이고 없으면 앱 언어다(`useRecognitionLanguage`). 기기 언어와 달라도 된다.
- AI 출력 언어는 ai-assistance `language-policy.messages.ts` 한 곳이다. 할 일 제목은 말한 언어 그대로, 요약·핵심 포인트는 요청 언어(없으면 저장된 사용자 언어)다.
- 푸시 문구(`series-paused` 포함)의 언어는 저장된 `UserPreference.locale`이다(없으면 `ko`, 지원하지 않는 값은 `en`, `resolveRecipientLocale`). 앱이 언어를 바꿀 때 보고한다.
- 표시 언어는 글자 모양만 바꾼다. 언어로 시간대·오늘·주 시작·날짜 key를 바꾸지 않는다(dayjs 전역 locale로 주 시작을 바꾸는 경로 포함).
- 유료 기능 사용량 창: 응원·찌르기 일간 한도는 요청 `X-Timezone`의 하루(자정 초기화), AI 할 일 만들기·말로 메모하기 월간 한도는 계약에 고정된 KST 달력 월(매월 1일 00:00 KST)이다. 서버가 응답의 `resetsAt`으로 다음 초기화 순간을 준다.
- 반복 할 일의 시간을 고치면 고른 시각을 요청 시간대(없으면 저장값)로 해석하고 규칙의 시간대도 그 값으로 저장한다. 반복을 만들 때도 같다. 이관에서 사용자 시간대가 없거나 잘못되면 `Asia/Seoul`이고 저장된 `UTC`는 유지한다.
- 주 시작은 사용자 설정을 따른다. 현재는 설정이 없어 일요일 시작 규칙 하나(`apps/mobile/src/shared/date/date-key.ts`의 `getCalendarWeek`)이고, 서버 리포트 기간은 각 기능의 명시한 규칙(ISO 주 등)을 쓴다. 같은 화면에서 두 주 규칙을 섞지 않는다.

## 3. 표시

- 모바일 표시는 `apps/mobile/src/shared/date/date-format.ts`가 하고, 카탈로그 문구가 필요한 요일·주 헤더·상대 시간은 `date-labels.ts`가 한다. 모든 helper는 `DateFormatContext { locale, timeZone }`를 인자로 받고 `Intl.DateTimeFormat`에 둘을 명시한다. 달력 날짜는 `formatDateKeyLabel`, 순간은 `formatDateLabel`, 벽시계는 `formatTimeOfDay`다. 카탈로그에 날짜 형식을 넣거나 화면에서 포맷을 다시 만들지 않는다.
- 할 일 시각은 `TodoPolicy.getLocalTime(todo, timeZone)` 하나만 표시·수정 기본값에 쓴다. 매퍼 `toTodo`는 시간대를 읽지 않고 `scheduledLocalTime`을 `localTime`으로, `scheduledTime`을 `scheduledAt`(Instant)으로 옮긴다. 벽시계 칸이 없는 응답(옛 서버·옛 캐시)만 `getLocalTime`이 보는 순간의 시간대로 `scheduledAt`을 읽는다.
- 서버가 만드는 문구(푸시·이메일·AI)는 사용자 locale과 시간대를 함께 넘겨 만든다.

## 4. 테스트할 경계

날짜 판단을 바꾸면 영향을 받는 경계를 순수 함수 테스트로 고정한다. 같은 instant를 서울·LA처럼 두 시간대 × ko/en 두 언어로 돌려 결과가 언어에 따라 바뀌지 않는지 확인한다.

- 자정 직전/정각, UTC 날짜가 다른 시각
- DST 전환일(LA 3월·11월)과 그 주의 기간 길이
- 윤일(2028-02-29), 월말·연말
- ISO 53주가 있는 해(2026, 2032), 일요일 시작 주와 ISO 주가 갈리는 날

서버 테스트의 시간 고정은 [서버 테스트](../../apps/api/docs/testing.md#시간과-타이머)를 따른다.

## 5. 떠 있는 시각

한국에서 만든 오전 10시는 미국에서도 오전 10시이고 알림도 현지 10시에 울린다.

| 항목           | 규칙                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 저장           | `Todo.startDate` + `Todo.scheduledLocalTime`이 진실이다. `scheduledTime`은 파생값이고 종일이면 둘 다 없다                                                                                            |
| 순간 계산      | `resolveScheduledInstant(날짜, 벽시계, 시간대)`(planning `todo-calendar.domain-service.ts`) 하나뿐이다. 생성·수정·회차·재계산이 모두 쓴다                                                            |
| 시간대         | 요청 `X-Timezone` → 저장된 사용자 시간대 → `Asia/Seoul`(`ResolveTodoTimezoneUseCase`). 저장된 `UTC`는 진짜 UTC로 본다                                                                                |
| 시간대 변경    | 저장값이 실제로 바뀌면 같은 트랜잭션에서 `todo-timezone-rebase.v1`을 넣는다(자가 치유·토큰 등록·설정 변경). 구간(60초)마다 사용자당 작업 하나이고 실행 때 최신 저장값을 읽는다                       |
| 재계산         | 시간 있는 모든 할 일의 순간을 다시 쓴다(완료·지난 할 일 포함). 순간이 그대로면 쓰지 않는다. 규칙의 시간대도 바꾼다                                                                                   |
| 알림 예약      | 완료 전이고 앞으로 울릴 회차만 다시 잡는다. 이미 지난 단계는 건너뛰고 바로 보내지 않는다. 완료를 되돌리면 지금 순간으로 다시 잡는다                                                                  |
| 그대로 두는 것 | 할 일의 벽시계와 `updatedAt`                                                                                                                                                                         |
| 기준 기기      | 앱을 앞에 띄운 기기의 마지막 요청이다. 앱은 시작·복귀·푸시 탭 때 푸시 기기 보고로 시간대를 바로 알린다                                                                                               |
| 알림 중복      | 할 일 + 단계 + 회차(날짜 + 벽시계)마다 한 번이다. 시간대가 바뀌어도 회차는 그대로고, 날짜나 시간을 고치면 새 회차라 다시 울린다([규칙 표](../../apps/api/docs/todo-floating-time.md#알림-중복-방지)) |
| 표시           | 어느 화면이든 벽시계 그대로다. 친구도 작성자의 벽시계를 본다                                                                                                                                         |
| 서머타임       | 겹치는 시각은 앞쪽, 없는 시각은 전환 뒤로 밀린 순간에 알림이 울린다. 표시는 고른 시각이다                                                                                                            |
| 그대로인 것    | "오늘"과 일간 한도는 기기 시간대, 월간 한도는 KST 달력 월                                                                                                                                            |

한계: 서버는 앱 요청 전까지 시간대를 모른다. 비행기에서 내려 앱을 열기 전까지 알림은 옛 시간대로 울린다. 푸시를 받기만 해서는 시간대가 바뀌지 않는다. 백그라운드 보고와 기기 예약을 고르지 않은 이유는 [서버 문서](../../apps/api/docs/todo-floating-time.md#한계)에 있다.
