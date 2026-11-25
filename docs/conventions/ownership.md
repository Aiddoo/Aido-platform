# 서버·앱 책임

값을 서버와 앱 중 어디서 정할지 고를 때 읽는다. 응답 필드를 더하거나 앱에서 서버 값을 다시 계산하고 싶을 때가 그때다.

판단은 서버, 표시는 앱이다. 값마다 주인은 하나이고 아래 셋 중 하나다.

| 주인           | 무엇                                                                                                                                                                                                                           | 다른 쪽이 하는 일                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 서버           | 업무 규칙·불변식, 권한, 프리미엄·한도·남은 횟수·`resetsAt`, 돈, 기기 사이에 같아야 하는 값, 저장·집계 값(완료율·연속 기록·성취·배지), 저장 집계의 날짜·주 경계, 알림 예약·발송 판단·푸시 문구·배지 수, 중복 방지, 앱 버전 분기 | 앱은 응답을 그리고 다시 계산하지 않는다. 필요한 값이 없으면 응답 필드를 더한다(추가만)                                                                                          |
| 앱             | 표시(포맷·화면 문구·현지화·배치), 기기 상태(OS 권한 읽기·기기 시간대·표시용 오늘 key), 오프라인 캐시, UX 검증과 안내 시점, 기기에서만 집행되는 기능(`clientOnly`)                                                              | 서버는 이 값으로 판단하지 않는다                                                                                                                                                |
| 공유 순수 규칙 | 낙관적 갱신·오프라인 표시처럼 둘 다 계산해야 하는 것                                                                                                                                                                           | `@aido/api/vocabulary` 함수 하나를 함께 쓴다. 두 구현이면 `packages/api/test/fixtures/*-cases.json` 표 하나를 서버 spec과 앱 테스트가 함께 읽는다. 앱 값은 서버 응답으로 덮는다 |

## 규칙

- 임계값·한도·기간 숫자는 다시 적지 않는다. 한쪽만 쓰면 그쪽 상수, 둘 다 쓰면 vocabulary다. "서버와 같다" 주석은 근거가 아니다.
- 서버가 판단하고 화면과 푸시가 함께 보이는 결과는 `kind`와 사실(숫자·시각)로 응답에 싣고 앱이 문장을 만든다. 문장을 렌더하는 것은 푸시·메일·알림함뿐이다.
- 앱이 미리 막는 것(버튼 끄기, 한도 안내)은 UX다. 서버가 같은 조건을 집행하지 않으면 앱도 막지 않는다(`clientOnly` 제외).
- 출시 앱에 묶인 값(vocabulary·카탈로그 숫자)은 그 앱 수명 동안 바뀌지 않는다. 운영 중 바뀔 수 있는 값(요금제 수치, 보상)은 응답으로 보낸다.
- 새 응답 필드는 서버를 먼저 배포한 뒤 앱이 대체 경로 없이 읽는다. 출시 앱 호환은 서버만 맡는다([호환](compatibility.md)).

## 지금 코드의 예

- 날씨 브리핑 카드: `decideWeatherHeadline`(`apps/api/src/modules/weather/weather-reports/domain/weather-headline.domain-service.ts`)이 아침·저녁 날씨 알림과 같은 판단으로 `GET /v2/weather`의 `headline`을 싣는다. 앱 `WeatherReportPolicy.findBriefing`은 그 머리글을 오늘 목록 줄과 묶기만 한다.
- 콕: `canNudgeTodoOn`(`apps/api/src/modules/social/nudges/domain/nudge-eligibility.domain-service.ts`) 하나가 콕 보내기 거절(`NUDGE_1106`)과 할 일 상세 `permissions.canNudge`를 정한다. 상세도 보내기처럼 맞팔 친구(`isMutualFriend`)일 때만 true다. 친구 피드 행의 버튼 감춤(`TodoPolicy.canNudgeOnDate`)은 같은 조건의 UX다.
- 한도: 남은 횟수·`resetsAt`은 `GET /v1/entitlements`의 `features`, 결제 화면의 무료·프리미엄 숫자는 `plans`(`resolvePlanComparisons`)다. 앱은 `EntitlementPolicy`로 읽고 `PLAN_CATALOG` 숫자를 화면에 쓰지 않는다.
- 감사: `judgeNudgeThanks`(`apps/api/src/modules/social/nudges/domain/nudge-interaction.domain-service.ts`) 하나가 감사 보내기 거절과 할 일 상세 `permissions.canThank`(내 할 일·완료·공개)를 정한다.
- 리포트: 끝낸 날 규칙은 `@aido/api/vocabulary`의 `isAllCompleted` 하나이고 연속 기록·달력 물고기·리포트 `stats.perfectDays`가 쓴다. 주로 끝낸 시간 `peakHour`와 `timePatterns` 순서(많은 수, 같으면 이른 시간)는 서버가 정한다.
- 서버가 준 순간: 앱은 그 순간이 지난 응답을 믿지 않고 그 순간에 다시 받거나 다시 그린다. 날씨 `expiresAt`과 한도 `resetsAt`은 쿼리의 `staleTime`·`refetchInterval`, 친구 독촉 `cooldownEndsAt`은 `useNow({ until })`이다. 리포트 D-N은 `nextWeeklyAt`·`nextMonthlyAt`을 기기 달력으로 센 표시다.
- 공유 순수 규칙: 반복 회차(`repeat-occurrence-cases.json`)와 주차(`week-of-month-cases.json`) 표를 서버 spec과 앱 테스트가 함께 읽는다.
- 알림 문구: 푸시와 알림함 문장은 서버가 렌더한다([서버 다국어](../../apps/api/docs/i18n.md#문구별-규칙)). 앱 화면 문구는 앱 카탈로그다.

서버 쪽 응답 추가 절차는 [HTTP 계약](../../apps/api/docs/http-contracts.md#출시-앱-호환-절차), 앱 쪽 모델·mapper는 [모델](../../apps/mobile/docs/architecture/model.md)이다.
