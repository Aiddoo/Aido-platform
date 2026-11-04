# 날짜·시간·언어

서버·모바일 공통 기준이다. "순간(instant)", "달력 날짜", "시간대", "표시 언어"는 서로 다른 값이며 하나에서 다른 하나를 추측하지 않는다.

## 1. 값의 종류

| 값          | 저장·전송                                         | 예                                        |
| ----------- | ------------------------------------------------- | ----------------------------------------- |
| 순간        | DB `timestamp(3)`(UTC), API ISO datetime/epoch ms | `createdAt`, `expiresAt`, 리마인더 시각   |
| 달력 날짜   | DB `date`(UTC 자정 `Date`), API `YYYY-MM-DD`      | 할 일 `startDate`, 피드 `date`            |
| 벽시계 시각 | API `HH:mm`(`timeOfDaySchema`)                    | 할 일 `scheduledTime` 입력, 리마인더 시각 |
| 시간대      | IANA 이름(`Asia/Seoul`)                           | `X-Timezone`, `UserPreference.timezone`   |
| 표시 언어   | `ko` / `en`                                       | `Accept-Language`, 앱 언어 설정           |

- 달력 날짜를 process 시간대의 `Date`로 바꾼 뒤 요일·자정을 계산하지 않는다. 날짜 산술은 `YYYY-MM-DD` key로 한다.
- 서버 process(Docker `ENV TZ=UTC`·CI `TZ: UTC`)와 PostgreSQL 세션(`TimeZone=UTC`)은 UTC로 고정한다. 그래도 코드는 process 시간대에 의존하지 않는다. 사용자 시간대가 필요하면 `dayjs.tz(…, timezone)`, 시간대가 없는 달력 계산은 `dayjs.utc(…)`를 쓴다.
- dayjs plugin은 `apps/api/src/shared/domain/date/dayjs.setup.ts` 한 곳에서만 등록한다.

## 2. "오늘"과 시간대의 출처

- **서버**: 요청 헤더는 요청마다 한 번 `RequestClient`(`apps/api/src/platform/http/request-client`)로 정규화한다. `timezone`은 런타임이 지원하는 IANA 이름이거나 null이다. 헤더가 없거나 잘못됐을 때의 규칙은 `request-timezone.ts`의 두 함수뿐이고, 엔드포인트마다 아래 규칙 하나를 쓴다.

  | 규칙                  | 함수·데코레이터                                                    | 헤더 없음·오류 | 쓰는 곳                                                                            |
  | --------------------- | ------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------- |
  | 날짜 경계             | `requestTimezoneOrUtc` · `@Timezone()`                             | `UTC`          | 할 일·메모·응원·찌르기·초대·`/v1/auth/me`, 활동일 기록(`LastActiveInterceptor`)    |
  | 저장 시간대 사용·보존 | `requestTimezoneIfSent` · `@Timezone({ preserveIfMissing: true })` | `undefined`    | AI 파싱·제안·리포트(저장된 사용자 시간대로 대체), 푸시 토큰 등록(기존 저장값 유지) |
  | 저장값 갱신           | `RequestClientReader.current().timezone`                           | 갱신하지 않음  | 시간대 자가 치유(`TimezoneSelfHealInterceptor`)                                    |

  응답 형태는 규칙과 무관하다. 새 엔드포인트는 위 셋 중 하나를 고르고 `X-Timezone`을 직접 읽지 않는다. 배치는 사용자별 저장 시간대로 계산한다. 공용 helper는 `apps/api/src/shared/domain/date/utils`(`todayInTimezone`, `localDateInTimezone`, `parseDateOnly`, `parseLocalDateTime`)다. 한 instant의 사용자 달력 날짜(`YYYY-MM-DD`)는 `localDateInTimezone(date, timezone)`으로 구하고 `Intl.DateTimeFormat` 포매터를 새로 만들지 않는다. 사용자 기본 시간대 폴백은 `DEFAULT_DELIVERY_TIMEZONE`, 도메인 현재 시각은 `now()`다.

- **모바일**: 시간대는 기기 달력(`expo-localization` `getCalendars()[0].timeZone`)에서만 온다. 앱 전체의 오늘 key·자정 전환은 `LocalDateProvider`(`apps/mobile/src/shared/providers/local-date-provider.tsx`)가 소유하고, Provider 밖(위젯 경계)은 같은 `readDeviceLocalDateState()`를 쓴다. 컴포넌트는 `useToday`/`useTodayKey`로 읽고 render 중 `new Date()`를 기준 상태로 만들지 않는다. 상대 시간처럼 분 단위로 바뀌는 표시는 `useMinuteNow()`를 쓴다. `Date`의 달력 날짜·요일은 `date-key.ts`의 `toDeviceDateKey`(같은 `getCalendars()` 시간대)로 key를 만든 뒤 계산하고, 하루 길이 상수는 `date-format.ts`의 `DAY_MS` 하나를 쓴다.
- 서버의 요청 언어는 `RequestClient.locale`(`@Locale()`)이다. `Accept-Language`가 없으면 null(저장된 언어 유지, 날씨 특보 문구는 `en`), 지원하지 않는 언어는 `ko`다.
- 표시 언어는 글자 모양만 바꾼다. 언어로 시간대·오늘·주 시작·날짜 key를 바꾸지 않는다(dayjs 전역 locale로 주 시작을 바꾸는 경로 포함).
- 유료 기능 사용량 창: 응원·찌르기 일간 한도는 요청 `X-Timezone`의 하루(자정 초기화), AI 파싱 월간 한도는 계약에 고정된 KST 달력 월(매월 1일 00:00 KST)이다. `/v1/auth/me`의 `entitlements.*.resetsAt`이 같은 규칙의 다음 초기화 instant다.
- 주 시작은 사용자 설정을 따른다. 현재는 설정이 없어 일요일 시작 규칙 하나(`apps/mobile/src/shared/utils/calendar-week.ts`)이고, 서버 리포트 기간은 각 기능의 명시한 규칙(ISO 주 등)을 쓴다. 같은 화면에서 두 주 규칙을 섞지 않는다.

## 3. 표시

- 모바일 표시는 한 모듈 `apps/mobile/src/shared/utils/date-format.ts`가 한다. 모든 helper는 `DateFormatContext { locale, timeZone }`를 인자로 받고 `Intl.DateTimeFormat`에 둘을 명시한다. 달력 날짜는 `formatDateKeyLabel`, 순간은 `formatDateLabel`이다. 카탈로그에 날짜 형식을 넣거나 화면에서 포맷을 다시 만들지 않는다.
- 서버가 만드는 문구(푸시·이메일·AI)는 사용자 locale과 시간대를 함께 넘겨 만든다.

## 4. 테스트할 경계

날짜 판단을 바꾸면 영향을 받는 경계를 순수 함수 테스트로 고정한다. 같은 instant를 서울·LA처럼 두 시간대 × ko/en 두 언어로 돌려 결과가 언어에 따라 바뀌지 않는지 확인한다.

- 자정 직전/정각, UTC 날짜가 다른 시각
- DST 전환일(LA 3월·11월)과 그 주의 기간 길이
- 윤일(2028-02-29), 월말·연말
- ISO 53주가 있는 해(2026, 2032), 일요일 시작 주와 ISO 주가 갈리는 날

서버 테스트의 시간 고정은 [Unit 테스트](../../apps/api/.claude/unit-test.md#날짜와-timer)를 따른다.
