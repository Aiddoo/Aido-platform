# 알림 발송 설계와 지표

마케팅·대량 발송·방해 금지·발송 우선순위·지표를 설계할 때 읽는다. 알림 종류별 계약·큐·receipt는 [푸시 알림](push-notifications.md), 관리자 채널은 [관리자 알림](admin-notifications.md), 문구·언어는 [다국어](i18n.md)에 있다.

## 지금 구조

- 대량 발송: 캠페인 커서 작업이 500명 단위로 같은 트랜잭션에 `Notification`·`Dispatch`·`Outbox`를 쓴다 → 릴레이 → 100개 단위 `push-delivery.v1` → Expo 청크 100 + 초당 500 토큰 버킷. 한 요청·한 트랜잭션이 커지지 않고 재시도는 페이지 단위다.
- 기기 없음·권한 없음·권한 거부는 건너뜀 사유(`PUSH_DISPATCH_SKIP_REASON`)로 기록한다. 90일 지난 기기는 stale이다.
- 푸시는 Expo 공식 `expo-server-sdk`(청크·receipt)다. FCM 직접 발송이 필요해지면 어댑터 하나를 더한다.

## 발송 우선순위

| pg-boss 기능                       | 쓰는 곳                                  |
| ---------------------------------- | ---------------------------------------- |
| `priority`                         | 거래성(리마인더·소셜) `10`, 마케팅 `0`   |
| `minPriority: 10` 전용 worker      | 대량 마케팅이 리마인더를 밀어내지 않는다 |
| `batchSize` + `burstWhenBatchFull` | 밀린 작업을 폴링 지연 없이 처리          |
| `group` + `groupConcurrency`       | 캠페인 하나가 worker를 독점하지 않는다   |

Nest 공식 큐 문서의 BullMQ는 Redis가 필요해 쓰지 않는다. pg-boss Nest 래퍼는 데코레이터가 pg-boss에 묶여 교체성을 해치므로 쓰지 않고 `JobQueuePort` + `defineQueue`를 쓴다([작업과 이벤트](jobs-and-events.md)).

## 마케팅 다국어·수신자 현지 시각

관리자 캠페인 API v2는 출시 앱 계약이 아니라 추가 필드로 넓힌다.

```ts
createBroadcastCampaignSchema = broadcastNotificationSchema.extend({
  requestId: z.uuid(),
  localizedContent: z
    .partialRecord(z.enum(SUPPORTED_LOCALES), z.object({ title, body }))
    .optional(),
  delivery: z
    .discriminatedUnion("mode", [
      z.object({ mode: z.literal("NOW") }),
      z.object({
        mode: z.literal("RECIPIENT_LOCAL_TIME"),
        localTime: timeOfDaySchema,
        date: z.iso.date(),
      }),
    ])
    .default({ mode: "NOW" }),
});
```

- `BroadcastCampaign` Aggregate의 `contentFor(locale)`가 언어별 문구를 고른다. 없는 언어는 기본 `title`·`body`다.
- fan-out 페이지는 수신자를 언어별로 묶어 렌더링을 한 번만 한다.
- `RECIPIENT_LOCAL_TIME`은 수신자 저장 시간대의 그 시각을 `startAfter`로 둔다. 이미 지난 시각이면 다음 날이다.
- 같은 `requestId` 재요청은 같은 캠페인이다(중복 발송 없음).

## 방해 금지

- 광고성 알림은 수신자 현지 21:00~08:00에 야간 동의가 없으면 보내지 않고 다음 허용 시각으로 미룬다(정보통신망법). 기존 `force`·야간 동의 규칙은 그대로다.
- 판정은 순수 함수 `isWithinQuietHours({ instant, timeZone, window })`(Temporal) 하나다.

## 푸시를 등록하지 않은 사용자

알림함(`Notification` 행)은 그대로 만들고 푸시만 건너뛰며 사유를 남긴다. 발송 퍼널에서 "권한 미요청·거부·토큰 없음" 비율을 보여 앱의 권한 요청 화면 개선 근거로 쓴다.

## 지표

| 지표             | 정의                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| DAU·WAU·MAU      | `UserActivityDay.localDate`(요청 시간대의 달력 날짜, `LastActiveInterceptor`)가 있는 사용자 수          |
| 활성             | 로그인한 사용자의 앱 요청이 있는 사용자 현지 날짜. 앱을 열지 않는 요청(푸시 기기 보고 등)은 세지 않는다 |
| D1·D7·D30 리텐션 | 가입 cohort 기준(`drizzle-admin-growth-metrics.adapter.ts`, 한 SQL 집계)                                |
| stickiness       | DAU/MAU(관리자 API 추가 필드)                                                                           |
| 푸시 퍼널        | 캠페인·종류별 생성 → 건너뜀(사유별) → 발송 요청 → receipt 성공 → 열람(`readAt`)                         |

- 정의는 문서와 타입(`GrowthMetricDefinition`) 두 곳에 고정한다. 관리자 지표는 operations `metrics` slice가 소유한다.
- 열람이 푸시 탭으로 기록되는지 앱 동작을 먼저 확인하고, 아니면 퍼널은 receipt까지만 둔다.
- 문구·발송 시각 실험은 `ExperimentAssignerPort`(결정적 해시)로 배정하고 결과는 퍼널과 리텐션으로 읽는다.
- SANDBOX 결제는 매출 지표에서 뺀다([결제](billing.md#sandbox-결제)).

## 전환 중

지금 관리자 브로드캐스트는 `title`·`body` 한 벌이고 수신자 현지 시각 발송이 없다. 거래성과 마케팅이 같은 `push-delivery.v1`에서 우선순위 없이 섞이고, 지표 집계는 operations의 기존 어댑터에 있다. 이 문서의 규칙은 notification·operations Context를 옮길 때 들어온다. 옮긴 Context는 `apps/api/architecture.ratchet.json`의 `migratedContexts`에 있다.
