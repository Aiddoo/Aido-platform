# 알림 발송 설계와 지표

마케팅·대량 발송·방해 금지·발송 우선순위·지표를 설계할 때 읽는다. 알림 종류별 정책은 [푸시 알림](push-notifications.md), 큐·receipt·기기는 [푸시 발송](push-delivery.md), 관리자 채널은 [관리자 알림](admin-notifications.md), 문구·언어는 [다국어](i18n.md)에 있다.

## 지금 구조

- notification Context는 slice 다섯이다: `inbox`(알림함), `push`(발송·기기·문구), `email`, `reminders`(시각 기반 알림), `retention`(온보딩·리텐션 실험). 관리자 캠페인은 operations `broadcasts`, 지표는 operations `metrics`가 소유한다.
- 대량 발송: 캠페인 커서 작업이 500명 단위로 같은 트랜잭션에 `Notification`·`PushDispatch`·`PushDispatchOutbox`를 쓴다 → 릴레이 → `push-delivery.v1` → Expo 청크 100 + 초당 500 토큰 버킷. 한 요청·한 트랜잭션이 커지지 않고 재시도는 페이지 단위다.
- 기기 없음·권한 없음·권한 거부는 건너뜀 사유(`PUSH_DISPATCH_SKIP_REASON`)로 기록한다. 90일 지난 기기는 stale이다.
- 푸시는 Expo 공식 `expo-server-sdk`(청크·receipt)다. FCM 직접 발송이 필요해지면 `PushProviderPort` 어댑터 하나를 더한다.

## 발송 우선순위

| pg-boss 기능                       | 쓰는 곳                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `priority`                         | `push-delivery.v1` 작업 하나는 한 차선만 담는다. 거래성(리마인더·소셜·결제·시스템) `10`, 마케팅(`purpose=ENGAGEMENT`·마케팅 타입·관리자 브로드캐스트) `0`(`pushDeliveryLaneOf`) |
| `minPriority: 10` 전용 worker      | 대량 마케팅이 리마인더를 밀어내지 않는다                                                                                                                                        |
| `batchSize` + `burstWhenBatchFull` | 밀린 작업을 폴링 지연 없이 처리                                                                                                                                                 |

Nest 공식 큐 문서의 BullMQ는 Redis가 필요해 쓰지 않는다. pg-boss Nest 래퍼는 데코레이터가 pg-boss에 묶여 교체성을 해치므로 쓰지 않고 `JobQueuePort` + `defineQueue`를 쓴다([작업과 이벤트](jobs-and-events.md)).

## 마케팅 다국어·수신자 현지 시각

관리자 캠페인 API v2(`POST /v2/admin/notifications/broadcasts`)는 출시 앱 계약이 아니라 추가 필드로 넓힌다. 계약은 `@aido/api`의 [admin-broadcast.request.ts](../../../packages/api/src/contracts/admin/v2/admin-broadcast.request.ts)(`requestId`, `localizedContent`, `delivery: NOW | RECIPIENT_LOCAL_TIME`)다.

- `BroadcastCampaign` Aggregate의 `contentFor(locale)`가 언어별 문구를 고른다. 없는 언어는 기본 `title`·`body`다.
- fan-out 페이지는 수신자를 언어별로 묶어 렌더링을 한 번만 한다.
- `RECIPIENT_LOCAL_TIME`은 수신자 저장 시간대의 그 시각을 `startAfter`로 둔다. 이미 지난 시각이면 다음 날이고, 날짜가 오래전이면 수신자의 오늘부터 다음 그 시각이다. 분배 페이지는 알림을 바로 만들지 않고 같은 시각의 사용자끼리 묶어 `operations.broadcast-delivery.v1` 작업(`startAfter`, 마케팅 priority 0)을 같은 transaction에 등록하며, 그 시각에 작업이 알림과 발송 outbox를 만든다.
- 같은 `requestId` 재요청은 같은 캠페인이다(중복 발송 없음).

## 방해 금지

- 광고성 알림은 수신자 현지 21:00~08:00에 야간 동의가 없으면 보내지 않고 다음 허용 시각으로 미룬다(정보통신망법). 기존 `force`·야간 동의 규칙은 그대로다.
- 사용자가 시각을 정한 알림(할 일 리마인더, 프리미엄 아침·저녁 리마인더, 날씨)은 야간 수신을 꺼도 보낸다. 소셜·재방문은 야간 설정을, 광고성은 야간 금지를 그대로 따른다([푸시](push-notifications.md#공통-발송-조건)).
- 판정은 순수 함수 `isWithinQuietHours({ instant, timeZone, window })`(`push/domain/quiet-hours.domain-service.ts`, Temporal) 하나다.

## 푸시를 등록하지 않은 사용자

알림함(`Notification` 행)은 그대로 만들고 푸시만 건너뛰며 사유를 남긴다. 발송 퍼널에서 "권한 미요청·거부·토큰 없음" 비율을 보여 앱의 권한 요청 화면 개선 근거로 쓴다.

## 지표

| 지표             | 정의                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| DAU·WAU·MAU      | `UserActivityDay.localDate`(요청 시간대의 달력 날짜, `LastActiveInterceptor`)가 있는 사용자 수 |
| 활성             | 로그인한 사용자의 앱 요청이 있는 사용자 현지 날짜(앱 시작·복귀·푸시 탭 때의 기기 보고 포함)    |
| D1·D7·D30 리텐션 | 가입 cohort 기준(`drizzle-growth-metrics.reader.ts`, 한 SQL 집계)                              |
| stickiness       | DAU/MAU(%, 소수 둘째 자리, MAU가 0이면 0. 관리자 API 추가 필드 `stickiness`)                   |
| 푸시 퍼널        | 캠페인·종류별 생성 → 건너뜀(사유별) → 발송 요청 → receipt 성공 → 열람(`openedAt`)              |

- 정의는 문서와 타입(`GROWTH_METRIC_DEFINITIONS`, 관리자 Swagger 설명이 이 상수로 만들어진다) 두 곳에 고정한다. 관리자 지표는 operations `metrics` slice가 소유한다.
- 열람은 앱이 푸시를 누를 때 부르는 `POST /v1/notifications/{id}/opened`의 `openedAt`이다. 푸시 data의 `notificationId`·`navigation`으로 앱이 탭 즉시 부르고, 처음 열 때만 `Notification.openedAt`·읽음과 `PushDispatch.openedAt`을 남기며 `notification.push.opened`(userId·notificationId)를 한 번 로그한다.
- 집계는 notification push의 public `PushFunnelReaderPort.summarize`(생성 구간·캠페인·종류로 좁힘)가 한 SQL 묶음으로 한다. 관리자 HTTP API로는 아직 내보내지 않는다.
- 문구·발송 시각 실험은 retention slice의 `ExperimentAssignerPort`(결정적 해시)로 배정하고 결과는 퍼널과 리텐션으로 읽는다. 다른 slice가 쓰기 시작하면 Context `shared`로 올린다.
- SANDBOX 결제는 매출 지표에서 뺀다([결제](billing.md#sandbox-결제)).
- 수신자 언어는 push `resolveRecipientLocale`(지원하지 않는 언어 en)이고 리마인더도 같은 함수를 쓴다([다국어](i18n.md#언어-결정)). notification 밖 Context가 만드는 알림은 `copyKey`·`copyFacts`를 넘겨야 알림함에서 요청 언어로 다시 렌더된다. 지금은 ai 제안 알림만 넘기고 billing·social·engagement 알림은 저장 문구로 보인다.
