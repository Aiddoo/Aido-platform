# 날짜·시간·언어

서버·모바일 공통 기준이다. "순간(instant)", "달력 날짜", "시간대", "표시 언어"는 서로 다른 값이며 하나에서 다른 하나를 추측하지 않는다.

## 1. 값의 종류

| 값        | 저장·전송                                                      | 예                                      |
| --------- | -------------------------------------------------------------- | --------------------------------------- |
| 순간      | DB `TimestampString(3)`(UTC 텍스트), API ISO datetime/epoch ms | `createdAt`, `expiresAt`, 리마인더 시각 |
| 달력 날짜 | DB `DateString`, API `YYYY-MM-DD`                              | 할 일 `startDate`, 피드 `date`          |
| 시간대    | IANA 이름(`Asia/Seoul`)                                        | `X-Timezone`, `UserPreference.timezone` |
| 표시 언어 | `ko` / `en`                                                    | `Accept-Language`, 앱 언어 설정         |

- 달력 날짜를 process 시간대의 `Date`로 바꾼 뒤 요일·자정을 계산하지 않는다. 날짜 산술은 `YYYY-MM-DD` key로 한다.
- PostgreSQL 세션은 `TimeZone=UTC`로 고정한다([Prisma](../../apps/api/.claude/prisma.md#읽기쓰기와-transaction)). 서버 process 시간대에 의존하는 코드를 쓰지 않는다.

## 2. "오늘"과 시간대의 출처

- **서버**: 요청의 `X-Timezone`(`@Timezone()` 데코레이터, `apps/api/src/platform/http/decorators/timezone.decorator.ts`)으로 사용자의 오늘·주·기간을 계산한다. 헤더가 없으면 저장된 사용자 시간대를 쓰는 경로가 있다(AI 파싱). 배치는 사용자별 저장 시간대로 계산한다. 공용 helper는 `apps/api/src/shared/domain/date/utils`(`todayInTimezone`, `parseDateOnly`, `parseLocalDateTime`)다.
- **모바일**: 시간대는 기기 달력(`expo-localization` `getCalendars()[0].timeZone`)에서만 온다. 앱 전체의 오늘 key·자정 전환은 `LocalDateProvider`(`apps/mobile/src/shared/providers/local-date-provider.tsx`)가 소유하고, Provider 밖(위젯 경계)은 같은 `readDeviceLocalDateState()`를 쓴다. 컴포넌트는 `useToday`/`useTodayKey`로 읽고 render 중 `new Date()`를 기준 상태로 만들지 않는다.
- 표시 언어는 글자 모양만 바꾼다. 언어로 시간대·오늘·주 시작·날짜 key를 바꾸지 않는다(dayjs 전역 locale로 주 시작을 바꾸는 경로 포함).
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
