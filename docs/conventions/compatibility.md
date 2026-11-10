# 레거시와 하위 호환

내부 코드는 레거시 없이 현재 구조 하나로 유지하고, 하위 호환은 **배포된 앱·기기·운영 데이터가 보는 외부 계약**에서만 지킨다. 외부 계약은 추가만 한다.

## 1. 내부: 남기지 않는다

- 바뀐 구현의 forwarding 파일·alias·re-export·쓰지 않는 export·옛 이름의 wrapper를 남기지 않는다. 실제 소비를 검색해 함께 지운다.
- "혹시 몰라" 두는 분기·플래그·옛 경로를 만들지 않는다. 문서·주석에도 삭제된 경로를 현행 예제로 남기지 않는다.
- 임시로 남겨야 하는 코드는 제거 조건을 코드와 아래 목록에 함께 적는다. 조건 없는 `TODO`는 쓰지 않는다.

## 2. 외부 계약: 바꾸지 않는다

| 계약              | 지키는 것                                                                                                                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST(`/v{n}`)     | 기존 필드의 이름·타입·required/nullable·의미·오류 코드. 새 필드는 additive optional로만 추가한다([REST 계약](../../apps/api/docs/http-contracts.md))                                                                                                                 |
| 앱 버전별 동작    | 새 동작이 구 앱을 깨면 `X-App-Version` 헤더로 서버가 분기한다. 헤더가 없는 구 앱은 기존 동작이다                                                                                                                                                                     |
| 라우트·딥링크     | 공개된 경로와 `aido://` URI. `aido://auth/callback`, `aido://auth/{provider}`는 바꾸지 않는다. 새 경로는 추가만 한다                                                                                                                                                 |
| 푸시 payload      | 의미 데이터만 보낸다. 새 앱은 `navigation`(kind별 화면·id)을, 구 앱은 함께 싣는 type·action·context·routing을 읽는다. 앱이 경로를 정하므로 라우트를 바꿔도 payload는 그대로다([Push](../../apps/api/docs/push-notifications.md))                                     |
| 위젯 snapshot·URI | `aido_widget_snapshot_v1` key와 저장 JSON 버전 해석, `aido://feed?…`·`aido://todo/{id}` 형식([위젯](../../apps/mobile/.claude/widgets.md))                                                                                                                           |
| 기기 저장 key     | SecureStore 토큰 key, MMKV key, 초안 key 형식. 바꾸면 기존 설치의 로그인·설정·초안을 잃는다. 1.15.0에 SecureStore `pendingRevocation`(`{ refreshToken, expiresAt }`)을 더했다([오프라인 로그아웃](../../apps/mobile/docs/authentication_guide.md#오프라인-로그아웃)) |
| 공급자 웹훅       | RevenueCat 웹훅 경로(`POST /v1/webhooks/revenuecat`)·200 응답·`@aido/api` 웹훅 스키마. 처리하지 않는 이벤트도 200으로 받아 재전송을 막는다. 운영은 Test Store 이벤트를 받기만 하고 반영하지 않는다([결제](../../apps/api/docs/billing.md#sandbox-결제))              |
| DB·queue·cache    | 마이그레이션은 additive로 쌓는다. 파괴적 migration 뒤에는 이전 API 이미지로 되돌리지 못한다([배포](../../apps/api/docs/deployment.md#롤백의-범위)). pg-boss job 이름·payload·Redis key/TTL은 소유 Context의 계약이다                                                 |

새 기능은 추가 API로 낸다. 서버를 먼저 배포하고 안정화를 확인한 뒤 앱을 낸다. 옛 앱 호환은 서버가 맡는다.

구 앱 경로를 남긴 경우 지원 범위는 여기에 적는다.

- `POST /v1/todos/recurring`: 마지막 지원 앱 1.14.x. 내부는 `POST /v1/todos`의 `repeat`(매주 + 날짜까지)와 같은 경로다. 날짜 없음은 이 경로에서만 옛 코드 `SYS_0002`다. 1.16.0에서 출시 앱 비율을 보고 제거 일정을 정한다. 진행 중 반복 상한은 이 경로(메모 변환의 `isRecurring`, AI 제안 수락도 같다)에서 `TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY`(300개)이고 거절 코드는 `TODO_0813`이다. 옛 앱이 `TODO_0842`를 몰라 `SYS_0001`로 보이기 때문이고, `TODO_0813`은 옛 서버도 이 경로에서 보내던 코드라 옛 앱에 전용 문구("카테고리 한도")가 있다. 새 경로의 30개는 그대로 `TODO_0842`다. `TODO_0812`와 `RECURRING_TODO_LIMITS.MAX_DAYS_RANGE`는 이 경로와 함께 지운다.
- `GET /v1/ai/usage`: 마지막 지원 앱 1.14.x(1.15 앱은 안 쓴다). 1.16.0에서 `/recurring`과 같이 판단한다.
- `POST /v1/ai/parse-todo`: 마지막 지원 앱 1.14.x(1.15 앱은 `POST /v1/quick-plans`를 쓴다). 응답의 `meta`도 출시 계약이다. 1.16.0에서 `/recurring`과 같이 판단한다.
- `POST /v1/ai/parse-memo`의 `Idempotency-Key` 생략: 마지막 지원 앱 1.14.x. 헤더가 없으면 요청마다 차감한다. 1.15 앱은 항상 보낸다. 생략을 막는 것은 1.14.x 사용자가 사라진 뒤에 판단한다.
- 메모 변환의 `isRecurring`·`recurrence`: 마지막 지원 앱 1.14.x. 서버가 Presentation에서 같은 `repeat`로 바꾼다. 1.16.0에서 `/recurring`과 같이 판단한다.
- 파싱 응답의 `recurrence`(요일 + 종료일): 마지막 지원 앱 1.14.x. 새 앱은 `repeat`를 쓴다. 1.16.0에서 `/recurring`과 같이 판단한다.
- `POST`·`DELETE /v1/notifications/token`: 마지막 지원 앱 1.14.1. 1.14.2 앱부터 `PUT /v1/notifications/push-devices/{deviceId}`를 쓴다. 같은 UseCase로 위임한다.
- `Todo.recurrenceGroupId`(DB 칸·응답): 영구. 출시 앱 응답의 필수 칸이다.
- `Todo.scheduledTime`(응답): 영구. 출시 앱은 이 순간을 기기 시간대로 보여 준다. 시간대 재계산은 완료했거나 지난 할 일까지 모두 다시 쓰므로 옛 앱에서도 고른 시각으로 보인다. 재계산 전 1~2분만 옛 시간대의 시각으로 보인다.
- Gemini 전용 AI 동의 경로: 영구. 재동의를 받지 않는 한 그 동의자는 Gemini만 쓴다.
- 옛 관리자 알림 잡 형식(`LegacyAdminNotificationSchema`, 조립 메시지를 싣던 `{ channel, notification }`의 `LegacySendDataSchema`): 배포 순간 쌓여 있는 잡을 위해 1.15.1까지 둔다. 대기 잡 보관이 24시간이라 1.15.1 배포 뒤 남은 잡이 없으면 다음 릴리스에서 지운다.

모바일은 최신 코드만 둔다. 앱은 옛 서버 응답을 위한 분기를 두지 않고, 기기 저장 값과 공개 링크, 지금 서버가 주는 값만 받는다. 앱 1.15.0 출시 뒤에는 서버를 1.15 이전으로 되돌리지 않고 수정 배포로 대응한다.

기기에 이미 남은 값과 링크를 읽는 앱 코드도 외부 계약이다. 새 앱이 쓰지 않는 모양을 읽어 옮기거나 받아 준다.

| 코드(앱)                                                                 | 읽는 것                                                                                                             | 지울 시점                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `shared/infra/storage/encrypted-draft-storage.ts` `migrateLegacyDrafts`  | 암호화 전 MMKV `aido.drafts`의 초안                                                                                 | 지우면 이전 버전에서 올라온 사용자의 저장 전 초안이 사라진다             |
| `store-review.repository.ts` `toStoreReviewState`                        | 앱 안 확인 창을 쓰던 시절의 `completions`·`reviewRequestedAt`                                                       | 지우면 이미 평가 요청을 받은 사용자에게 다시 묻는다                      |
| `notification-destination.ts` `toLegacyFieldsDestination`                | `navigation`이 없는 알림의 type·action·context·routing                                                              | 영구(서버가 `navigation`을 고르지 못한 알림함 항목이 화면으로 가는 경로) |
| `app/(app)/todo/[todoId]/comments/[commentId].tsx`                       | 1.14.0 이하 대화 링크                                                                                               | 지우면 이미 받은 푸시·공유 링크가 열리지 않는다                          |
| `widget-snapshot-storage.schema.ts` `legacyWidgetSnapshotV1Schema`       | 위젯 snapshot v1 저장 JSON                                                                                          | 영구(위젯 snapshot 버전 해석 계약)                                       |
| `coachmark.repository.ts` `REORDER_KEY_PREFIX`·`FRIEND_STRIP_KEY_PREFIX` | 1.14.x까지 쓰던 안내 key. 지금도 이 key로 읽고 쓴다                                                                 | 영구(기기 저장 key)                                                      |
| `marketing-push-prompt.repository.ts` `claimDeviceRecord`                | 1.14.x까지 기기 하나에 남긴 `aido_marketing_push_prompt`(`lastPromptedAt`). 로그인한 계정 key로 한 번 옮기고 지운다 | 1.16.0 이후(옮기기 전에 업데이트한 사용자가 한 번 더 제안을 받을 뿐이다) |
| `push-permission-prompt.repository.ts` `NOTICE_DISMISSED_KEY_PREFIX`     | 1.14.x까지 쓰던 피드 안내 닫은 시각 key. 지금도 이 key로 읽고 쓴다                                                  | 영구(기기 저장 key)                                                      |
| `activation-progress-storage.schema.ts`                                  | 1.14.x가 남긴 `pushRegistrationUnlockedAt`은 읽지 않고 버린다                                                       | 지울 코드 없음(스키마가 모르는 칸을 버린다)                              |

호환 판단은 OpenAPI·released-client fingerprint([E2E](../../apps/api/docs/http-contracts.md#출시-앱-호환-절차))와 push/widget resolver 테스트로 확인한다. 고정된 released fixture를 현재 schema로 재생성하지 않는다.

## 3. REST 버전

- 경로 버전은 Nest URI 버저닝(`platform/http/api-versioning.ts`)이 붙인다. 버전을 지정하지 않은 컨트롤러는 `v1`, 버전이 없는 `health`는 `VERSION_NEUTRAL`이다.
- 응답 형태나 데이터 공급자가 통째로 바뀌어 구 앱이 같은 경로를 쓸 수 없을 때만 `/v{n+1}`을 연다. 필드 추가와 같은 버전 안의 동작 차이는 위 표의 방식으로 처리한다.
- 버전은 presentation과 계약에만 드러난다. `presentation/http/v{n}/`(서버 전환 중인 옛 구조는 `presentation/{controllers,schemas,mappers}/<slice>/v{n}/`), `packages/api/src/contracts/<domain>/v{n}/`에 두고, UseCase·Domain·Port는 버전을 모른다.
- 이전 버전 작업에는 `@ApiDoc({ deprecated: true })`와 Swagger 태그(`… · Deprecated`)를 달고, 설명 첫 줄에 지원하는 마지막 앱 버전을 적는다(예: 날씨 v1은 1.13.1 이하). 그 앱 버전 사용자가 사라진 뒤 경로를 제거하고 Changesets major로 기록한다.
- 앱이 호출하지 않는 관리자 경로도 공개 OpenAPI 계약이다. 응답 의미가 바뀌면 같은 원칙으로 새 버전을 열고, 제거 조건은 앱 버전 대신 관리자 도구의 전환으로 적는다(예: 동기 `POST /v1/admin/notifications/broadcast` → 비동기 캠페인 `POST /v2/admin/notifications/broadcasts`).
