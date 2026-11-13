# 푸시 발송·기기·큐

푸시 delivery/receipt 장애, 기기·토큰 등록, 푸시 큐와 작업 key, 관리자 브로드캐스트 캠페인을 확인할 때 읽는다. 발송 정책·일정·알림 종류는 [푸시 알림](push-notifications.md), 우선순위·지표 설계는 [알림 발송 설계](notifications.md)에 있다. 코드는 `src/modules/notification/push`와 `src/modules/operations/broadcasts`다.

## Delivery·receipt

알림 기록, `PushDispatch`와 outbox, 외부 공급자 발송은 분리된다. 알림을 만드는 모든 경로(소셜·리마인더·리텐션·관리자 브로드캐스트)는 같은 transaction에서 `Notification`·`PushDispatch`·`PushDispatchOutbox`를 쓰고, commit 뒤 `push-delivery.v1` 작업이 발송한다. worker는 publication generation·job ID·delivery attempt fence로 claim/finalize/retry를 제한한다. stale worker가 새 generation을 끝내지 못하게 하는 내부 원자성은 외부 푸시 exactly-once와 다르다.

공급자 경계는 채널 중립 `PushProviderPort`다(지금 `ExpoPushSenderAdapter`). 공급자 오류 코드는 어댑터 안에서 `PushFailureKind`로 바꾼다.

| PushFailureKind        | Expo 원본                                                  | 처리                                                    |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `DEVICE_UNREGISTERED`  | `DeviceNotRegistered`                                      | 발송 당시 토큰이 그대로면 비활성화                      |
| `INVALID_TOKEN`        | SDK 토큰 형식 검사 실패                                    | 비활성화                                                |
| `PAYLOAD_TOO_LARGE`    | `MessageTooBig`, 4096 byte 초과                            | 실패 기록, 토큰 유지                                    |
| `RATE_LIMITED`         | `MessageRateExceeded`                                      | 그 메시지만 1·2·4초 backoff 뒤 재전송, 남으면 실패 기록 |
| `PROVIDER_REJECTED`    | `InvalidCredentials`, `DeveloperError`, `MismatchSenderId` | 실패 기록                                               |
| `PROVIDER_UNAVAILABLE` | `ExpoError`, `ProviderError`                               | 실패 기록                                               |
| `RECEIPT_EXPIRED`      | receipt 보관 기간(약 24시간) 안에 결과 없음                | `UNKNOWN`으로 닫음                                      |
| `UNKNOWN`              | 그 밖의 코드                                               | 실패 기록                                               |

`PushDeliveryAttempt.failureKind`가 판단 기준이고 `errorCode`·`errorMessage`는 공급자 원본 진단 기록이다. 코드의 `providerTicketId`는 기존 칼럼 `expoTicketId`를 그대로 쓴다(운영 데이터를 옮기지 않으려고 칼럼 이름은 바꾸지 않는다).

공급자 처리량: Expo 프로젝트 한도는 초당 600건이다. 어댑터가 프로세스 안에서 초당 500건(`EXPO_PUSH_MESSAGES_PER_SECOND` 상수) 토큰 버킷으로 청크(100건) 전송을 직렬화하고, SDK가 HTTP 429를 backoff 재시도하며 동시 요청을 6개로 제한한다. 운영 API는 단일 프로세스라 이 한도가 곧 전체 한도다. 인스턴스를 늘리면 상수를 인스턴스 수로 나눠야 한다.

보관 시간·우선순위: 메시지마다 알림 종류로 정한 `ttl`(초)과 `priority`를 싣는다(`push-delivery-options.constants.ts`의 `pushDeliveryOptions`, 종류 튜플 전체를 `satisfies`로 덮는다). 기기가 꺼져 있으면 FCM·APNs가 `ttl`까지만 보관하고 버리므로 늦게 켠 태블릿에 지난 리마인더가 쌓이지 않는다. 메시지 단위 값이라 등록 토큰에는 영향이 없다.

| 묶음          | `ttl`  | 알림                                                                                                                                  | 이유                                        |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| REMINDER      | 1시간  | `TODO_REMINDER`                                                                                                                       | 60·10분 전 알림이 일정을 넘겨 닿으면 잡음   |
| BRIEFING      | 2시간  | `MORNING_REMINDER`, `EVENING_REMINDER`, `WEATHER_MORNING`, `WEATHER_EVENING`                                                          | 몇 시간 지나면 그날 계획에 쓸모없음         |
| TODAY_ONLY    | 3시간  | `LUNCH_NUDGE`, `STREAK_AT_RISK`, `SOCIAL_DIGEST`, `DAILY_COMPLETE`, `FRIEND_COMPLETED`                                                | 그날 안에만 뜻이 있음(20:15 + 3시간 < 자정) |
| SOCIAL        | 12시간 | `FOLLOW_NEW`, `FOLLOW_ACCEPTED`, `NUDGE_RECEIVED`, `NUDGE_REPLIED`, `NUDGE_THANKED`, `CHEER_RECEIVED`, `TODO_SHARED`, `INVITE_JOINED` | 반나절 늦어도 읽을 만함, 그 뒤는 알림함     |
| INFORMATIONAL | 24시간 | 그 밖(`WINBACK`, `AI_SUGGESTION`, `NUDGE_SUGGEST`, `INVITE_*`, 리포트, 공지·관리자 발송, `PREMIUM_*`)                                 | 하루 안에 닿으면 되고 그 뒤는 알림함        |

`priority`는 모두 `high`다. `normal`은 Android Doze에서 몇 시간 늦어져 광고성 알림이 야간에 닿을 수 있다. Android 채널은 출시 앱이 만든 `default` 하나뿐이라 모든 알림을 `default`로 보낸다.

receipt 확인은 5분마다 돈다(Expo 권장대로 수락 15분 뒤부터 묻는다). 한 실행은 45초 예산 안에서 900건씩 남은 ticket이 없을 때까지 이어서 확인한다. 대상은 수락 뒤 15분~24시간이고 아직 확인하지 않았거나 마지막 확인이 15분 지난 `TICKET_ACCEPTED`이며, 확인 시각이 오래된 순서다. 결과가 아직 없는 ticket은 확인 시각만 남겨 뒤로 보낸다. 24시간이 지나도 결과가 없으면 `UNKNOWN`·`RECEIPT_EXPIRED`로 닫는다.

receipt 갱신은 `TICKET_ACCEPTED`에만 원자적으로 적용한다. 이미 DELIVERED/FAILED인 ticket의 중복 응답은 되돌리지 않는다. 토큰을 끄는 실패는 저장된 발송 token SHA256과 현재 token이 같을 때만 비활성화 대상으로 반환한다. receipt 상태와 token 비활성화는 한 UoW에서 처리하고 실패 시 함께 rollback한다([ReconcilePushReceipts](../src/modules/notification/push/application/use-cases/reconcile-push-receipts.use-case.ts)). commit 뒤 사용자별 token cache 무효화는 allSettled로 실패를 격리해 기록한다.

남는 한계:

- 보호는 이미 저장된 발송 당시 fingerprint와 현재 token 비교에 적용된다. network send 도중 token 회전으로 기존 token 문자열 lookup이 실패하면 attempt가 생략될 수 있다.
- 같은 token을 다시 등록하는 ABA 등록 세대는 SHA256만으로 구별하지 못한다.
- 앞 청크가 수락된 뒤 다음 청크 transport가 실패하면 전체 논리 배치 retry에서 중복 전달이 가능하다. 원문/token/body/credential은 로그에 남기지 않는다.
- receipt는 외부 provider handoff 결과다. 기기 알림 표시·사용자 열람·운영 exactly-once를 보장하지 않는다.

## 기기와 토큰

앱은 기기마다 알림 권한과 Expo 토큰을 서버에 보고한다. 서버는 권한을 해석해 도달 가능 여부와 건너뜀 사유를 정하고, 앱은 OS 권한과 토큰을 읽어 보고만 한다.

| 책임   | 서버                                                                                                                              | 앱                                                                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 권한   | 보고된 `PushPermission`(`GRANTED`·`PROVISIONAL`·`DENIED`·`NOT_DETERMINED`)을 저장한다. `PROVISIONAL`도 발송한다                   | OS 권한을 읽어 로그인 직후·앱 복귀·토큰 변경·언어 변경 때 보고한다                                                         |
| 플랫폼 | `deviceId` 접두어 `ios_`·`android_`로 정한다(`platformFromDeviceId`). 접두어가 없으면 `X-Device-Type`을 쓰고, 둘 다 없으면 400    | 접두어가 붙은 `deviceId`를 만든다                                                                                          |
| 토큰   | 기기·로그인 세션에 묶어 저장하고 `DeviceNotRegistered`면 비활성화하고 소유권 이전·세션 폐기·권한 거절 때 지운다(발급 실패는 아래) | Expo 토큰을 얻어 보고한다. 로그아웃 때 해제 요청을 보내도 서버가 세션 폐기로 다시 지운다. 세션이 끝나면 공개 해제를 보낸다 |
| 사유   | 활성 토큰이 없으면 기기 권한으로 건너뜀 사유를 정한다                                                                             | 사유를 알지 못한다                                                                                                         |

- 엔드포인트: `PUT /v1/notifications/push-devices/{deviceId}`(기기 보고, 1.14.2+), `DELETE /v1/notifications/token?deviceId=`(로그인한 기기의 로그아웃 해제, 현행 `UnregisterPushDevice`), `POST /v1/notifications/push-devices/unregister`(세션이 끝난 기기의 공개 해제, 1.15.1+). deprecated는 1.14.1 이하 앱의 `POST /v1/notifications/token` 하나이며 같은 UseCase(`ReportPushDevice`)로 위임한다. 이전 앱의 등록은 권한 `GRANTED`로 저장한다.
- 토큰 발급 실패: 권한이 `GRANTED`·`PROVISIONAL`인데 `token`이 null이면(앱의 발급 15초 제한·오프라인) 한 번의 실패로 보고 기존 토큰 행을 지우지 않는다(`PushDevice.tokenChange`가 `KEEP`). 그 행의 `sessionId`·`payloadVersion`·`appVersion`만 이번 보고로 옮겨 로그아웃 정리가 지금 세션으로 찾게 한다. 응답 `hasActiveToken`은 남은 토큰이 활성인지다. `DENIED`·`NOT_DETERMINED`는 지금처럼 지운다. 출시된 1.13~1.15.0 앱도 서버만으로 고쳐진다.
- 등록은 `(userId, deviceId)` 기준 upsert다. 같은 토큰을 다른 사용자나 다른 deviceId가 가지고 있으면 같은 트랜잭션에서 그 등록을 지우고 새로 등록해 토큰 소유를 옮긴다. 이전 소유자의 토큰 캐시도 비우고 `notification.delivery.report-push-device.owner-transferred`(새·이전 userId만, 토큰 값 없음)를 남긴다. 같은 토큰이 동시에 등록돼 `PushToken_token_key` 충돌이 나면 `…token-conflict-retried`(warn)를 남기고 새 트랜잭션에서 한 번만 다시 한다. 재시도도 충돌하면 DB 오류로 응답한다.
- `X-Timezone`이 없으면 기존 저장값을 유지한다. 값이 바뀌면 할 일 시각을 다시 계산한다([떠 있는 시각](todo-floating-time.md#시간대-변경)).
- 세션 결속: `PushDevice`·`PushToken`의 `sessionId`는 `Session`을 참조하며 `ON DELETE CASCADE`다. identity가 세션을 폐기하면(로그아웃·전체 로그아웃·비밀번호 변경·재설정·원격 종료·토큰 재사용 감지·탈퇴) `SessionPushDeviceReleaserPort`가 notification의 `SessionPushDeviceReleasePort`를 불러 그 세션의 기기와 토큰을 바로 지운다. 해제가 실패해도 세션 폐기는 막지 않고 `identity.session.push-device-release.failed`(warn)만 남긴다. `sessionId`가 없는 1.14.1 이하 등록은 그대로 둔다.
- 만료된 세션: 세션 행은 만료돼도 지우지 않는다(정리 작업 없음, CASCADE는 탈퇴 때만 돈다). 그래서 갱신 기한(7일)이 지났거나 오프라인 로그아웃의 해제가 24시간 안에 닿지 못한 기기는 계정 푸시를 계속 받는다. 발송을 세션으로 거르면 오래 쉰 사용자의 재방문(`WINBACK`) 알림까지 막히므로 거르지 않는다. 대신 앱이 세션이 끝날 때 공개 해제로 `{ deviceId, token }`을 보낸다. 서버는 둘 다 맞는 등록(`PushToken.token`은 유일)만 그 기기의 토큰·권한 기록과 함께 지우고, 맞지 않아도 같은 200 `{ unregistered: true }`를 줘 등록 여부를 드러내지 않는다. 로그인 전 요청이라 IP마다 분당 20회다. 로그는 `notification.push.device.unregistered-by-token`(주인 ID·지운 수, 토큰 값 없음)이다.
- 건너뜀 사유: 활성 토큰이 없으면 최근 `PUSH_DEVICE_STALE_AFTER_DAYS`(90일) 안에 보고한 기기의 권한으로 정한다(`noActiveTokenSkipReason`).

| 사유                            | 조건                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `NO_ACTIVE_TOKEN`               | 허용된 기기가 있거나, 보고한 기기가 없거나(1.14.1 이하 앱) 모든 보고가 90일을 넘음 |
| `PUSH_PERMISSION_NOT_REQUESTED` | 허용된 기기가 없고 `NOT_DETERMINED` 기기가 있음. 거절보다 먼저 센다                |
| `PUSH_PERMISSION_DENIED`        | 허용된 기기가 없고 `DENIED` 기기만 있음                                            |

## 큐와 작업 key

큐 규칙(이름·`defineQueue`·멱등)은 [작업과 이벤트](jobs-and-events.md#큐-정의)다. 푸시 큐는 `push/infrastructure/jobs/*.queue.ts`에 있고, 예약 작업(`push-receipts`·`relay-outbox`)은 DLQ 없이 같은 큐의 예약 정의로 등록한다. 같은 원인 이벤트의 작업은 결정적 job id로 한 번만 저장된다.

| 큐                                            | 작업                                                                                                                   | key                                                                                                                                                                                      | 실패                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `notification.v1`                             | follow·nudge·cheer·billing·friend-completed·milestone                                                                  | `nudge-<id>`, `cheer-<id>`, `follow-new-<a>-<b>`, `follow-mutual-<user>-<friend>`, `billing-issue-<user>-<UTC 날짜>`, `friend-completed-<friend>-<현지 날짜>`, `milestone-<user>-<단계>` | 2회 재시도 뒤 `notification-dead-letter.v1`(14일 보관, 기록만)    |
| `notification.v1`                             | `push-receipts`(5분 예약, `missed: skip`)                                                                              | 예약 key `push-receipts-scheduler`                                                                                                                                                       | 2회 재시도                                                        |
| `push-delivery.v1`                            | `deliver-dispatches`(거래성 `priority 10`·마케팅 `0`, 일반 worker + `minPriority 10` worker), `relay-outbox`(1분 예약) | publication 집합의 SHA256                                                                                                                                                                | 5회 재시도 뒤 `push-delivery-dead-letter.v1`가 outbox를 다시 연다 |
| `operations.broadcast-fan-out.v1`             | `fan-out-campaign`                                                                                                     | `broadcast-fan-out-<campaignId>-<cursor 또는 start>`                                                                                                                                     | 5회 재시도 뒤 DLQ가 캠페인을 `FAILED`로 닫음                      |
| `operations.broadcast-delivery.v1`            | `deliver-group`(수신자 현지 시각 발송, `startAfter`)                                                                   | `broadcast-delivery-<campaignId>-<startAfter>-<첫 사용자>`                                                                                                                               | 5회 재시도 뒤 DLQ가 운영 경보만 올림                              |
| `retention.v1`                                | `retention-stage-sweep`(매분 예약, `missed: once`)                                                                     | 예약 key                                                                                                                                                                                 | 4회 재시도                                                        |
| `notification.marketing-consent-reconfirm.v1` | `reconfirm-marketing-consents`(매시 정각 `missed: skip`, 현지 야간 사용자는 다음 낮 실행으로)                          | 예약 key `hourly-marketing-consent-reconfirm-scheduler`                                                                                                                                  | 2회 재시도. 멱등은 `marketingReconfirmedAt` 조건부 UPDATE         |
| `todo-reminder.v1`, `timezone-reminder.v1`    | 리마인더(`todo-reminder.v1`은 20건 묶음을 이어 꺼내고 작업마다 끝냄), `send-series-paused-notice`                      | `reminder_<todoId>_<단계>`(`60min`·`10min`), `series-paused_<userId>_<마지막 활동일>`                                                                                                    | 큐 정의의 재시도                                                  |

key builder는 `notification-job-keys.constants.ts`와 각 큐 모듈의 순수 함수다. 다른 Context는 상태를 바꾼 트랜잭션 안에서 `NotificationQueueAdapter`(`notification-delivery-jobs.public.ts`)로 이벤트를 넘기고 기다린다. 작업 행이 그 변경과 함께 커밋되므로(트랜잭셔널 아웃박스) 커밋 직후 프로세스가 멈춰도 알림을 잃지 않고, 저장 실패는 호출자의 트랜잭션을 되돌린다. 사례: 팔로우·친구 성립·응원·넛지·첫 친구 마일스톤.

DB 연결: 앱 풀(`DATABASE_POOL_MAX` 기본 10)과 pg-boss 풀(`max: 3`)은 따로다. 각 작업은 짧은 transaction(claim·finalize·outbox 쓰기) 동안만 연결을 잡고 Expo 호출과 commit 뒤 enqueue 중에는 잡지 않는다. fan-out 한 페이지는 알림·dispatch·outbox 500건씩을 한 transaction에 쓴다. worker 동시성을 늘릴 때는 풀 크기를 함께 본다.

## 관리자 브로드캐스트 캠페인

`POST /v2/admin/notifications/broadcasts`는 캠페인을 만들고 첫 분배 작업을 같은 transaction에 등록한 뒤 202와 `campaignId`를 돌려준다. 요청 ID가 같은 재요청은 처음 캠페인을 돌려주고(내용이 다르면 409 `ADMIN_1405`), 대상이 없으면 404 `ADMIN_1402`다. 관리자마다 분당 5회까지다.

분배 작업은 대상 사용자를 ID 순서로 500명씩 읽어 수신자 언어의 문구(`localizedContent`, 없으면 `title`·`body`)로 캠페인 key(`admin-broadcast:<campaignId>`)가 붙은 알림을 만든다. `delivery`가 `RECIPIENT_LOCAL_TIME`이면 알림 대신 시각별 발송 작업(`operations.broadcast-delivery.v1`)을 등록한다. 분배·발송 작업은 마케팅 차선(`priority: 0`)이다. 페이지 저장과 cursor 전진이 한 transaction이라 worker가 죽어도 다음 시도가 마지막 커밋 cursor부터 이어 가며, 한 실행이 60초를 넘기면 다음 cursor 작업을 남긴다. 탈퇴·정지된 사용자는 다음 페이지 조회에서 빠지고, 수신 설정·야간·빈도 제한·토큰 상태는 발송 시점에 공용 정책으로 판단한다.

`GET /v2/admin/notifications/broadcasts/{campaignId}`는 분배 진행(`recipients.processed`·`queued`), 사용자별 발송 상태(`dispatches`, 사유별 `skippedByReason`), 기기별 전달 결과(`deliveries`)를 집계한다. `queued`는 알림을 만들어 대기열에 올린 수이며 전달 수가 아니다. v1 `POST /v1/admin/notifications/broadcast`는 deprecated다. 같은 캠페인으로 접수하고 기존 응답 shape(`successCount`=대기열에 올릴 대상 수)를 유지한다.

리텐션 실험은 단계 정책·예약만 소유한다. 발송할 단계는 공용 알림 발행(`purpose=ENGAGEMENT`, 단건 dispatch)으로 넘기므로 빈도 제한·광고성 동의·야간 억제·토큰 정리·receipt가 다른 알림과 같다.

외부 제약: [Expo 공식 sending 문서](https://docs.expo.dev/push-notifications/sending-notifications/)는 15분 receipt 확인과 24시간 보관, 초당 600건 한도와 `MessageRateExceeded` backoff를 설명한다.
