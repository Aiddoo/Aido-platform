# 레거시와 하위 호환

내부 코드는 레거시 없이 현재 구조 하나로 유지하고, 하위 호환은 **배포된 앱·기기·운영 데이터가 보는 외부 계약**에서만 지킨다. 외부 계약은 추가만 한다.

## 1. 내부: 남기지 않는다

- 바뀐 구현의 forwarding 파일·alias·re-export·쓰지 않는 export·옛 이름의 wrapper를 남기지 않는다. 실제 소비를 검색해 함께 지운다.
- "혹시 몰라" 두는 분기·플래그·옛 경로를 만들지 않는다. 문서·주석에도 삭제된 경로를 현행 예제로 남기지 않는다.
- 임시로 남겨야 하는 코드는 제거 조건을 코드와 아래 목록에 함께 적는다. 조건 없는 `TODO`는 쓰지 않는다.

## 2. 외부 계약: 바꾸지 않는다

| 계약              | 지키는 것                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST(`/v{n}`)     | 기존 필드의 이름·타입·required/nullable·의미·오류 코드. 새 요청 필드는 additive optional로만 더한다. 새 응답 필드는 서버가 모든 경로에서 늘 보내면 필수로 둘 수 있다(출시 앱 Zod는 모르는 키를 버린다)([REST 계약](../../apps/api/docs/http-contracts.md))                                                                                                                    |
| 앱 버전별 동작    | 새 동작이 구 앱을 깨면 `X-App-Version` 헤더로 서버가 분기한다. 헤더가 없는 구 앱은 기존 동작이다                                                                                                                                                                                                                                                                              |
| 라우트·딥링크     | 공개된 경로와 `aido://` URI. `aido://auth/callback`, `aido://auth/{provider}`는 바꾸지 않는다. 새 경로는 추가만 한다                                                                                                                                                                                                                                                          |
| 푸시 payload      | 의미 데이터만 보낸다. 서버는 모든 푸시·알림함 행에 `navigation`(kind별 화면·id)을 계산해 싣고, 구 앱 호환을 위해 type·action·context·routing도 함께 싣는다. 최신 앱은 `navigation`만 읽는다(없거나 틀리면 알림함으로 연다). 앱이 경로를 정하므로 라우트를 바꿔도 payload는 그대로다([Push](../../apps/api/docs/push-notifications.md#푸시-navigation))                        |
| 위젯 snapshot·URI | `aido_widget_snapshot_v1` key와 저장 JSON(v2) 해석, `aido://feed?…`·`aido://todo/{id}` 형식([위젯](../../apps/mobile/docs/widgets.md))                                                                                                                                                                                                                                        |
| 기기 저장 key     | SecureStore 토큰 key, MMKV key, 초안 key 형식. 바꾸면 기존 설치의 로그인·설정·초안을 잃는다. SecureStore `pendingRevocation`(`{ refreshToken, expiresAt }`)도 여기에 든다([오프라인 로그아웃](../../apps/mobile/docs/auth.md#오프라인-로그아웃))                                                                                                                              |
| 기기 저장 원문    | 출시 앱이 남긴 저장 값과 초안의 모양. 지금 코드가 그대로 읽고 다시 써도 원문이 같아야 한다. 저장 값 정의는 `stored-value-compatibility.test.ts`, 말로 메모 초안은 1.15.1 원문 fixture(`RELEASED_VOICE_NOTE_DRAFTS`)가 지킨다. 저장소를 열지 못한 실행은 초안이 비어 있다고 보지 않아 그 녹음을 지우지 않는다([오류](../../apps/mobile/docs/error-handling.md#조회-캐시-보관)) |
| 공급자 웹훅       | RevenueCat 웹훅 경로(`POST /v1/webhooks/revenuecat`)·200 응답·웹훅 원문 스키마(billing `revenuecat-webhook.wire.ts`). 처리하지 않는 이벤트도 200으로 받아 재전송을 막는다. 운영은 Test Store 이벤트를 받기만 하고 반영하지 않는다([결제](../../apps/api/docs/billing.md#sandbox-결제))                                                                                        |
| DB·queue·cache    | 마이그레이션은 additive로 쌓는다. 파괴적 migration 뒤에는 이전 API 이미지로 되돌리지 못한다([배포](../../apps/api/docs/deployment.md#롤백의-범위)). pg-boss job 이름·payload·Redis key/TTL은 소유 Context의 계약이다                                                                                                                                                          |

새 기능은 추가 API로 낸다. 서버를 먼저 배포하고 안정화를 확인한 뒤 앱을 낸다. 옛 앱 호환은 서버가 맡는다.

이름 입력 검증 강화: 가입 이름·프로필 이름·카테고리 이름(생성·수정)은 앞뒤 공백을 지운 뒤 검사한다. 공백만 쓴 이름을 보내는 출시 앱(1.15.1 이하)도 400 `SYS_0002`를 받는다. 길이 상한(이름 20자, 카테고리 50자)도 공백을 지운 뒤 세므로 앞뒤 공백을 더해 넘는 이름(" 가×20 ")은 통과한다. 응답·OpenAPI 모양은 검증과 상관없이 같다. 출시 앱은 `SYS_0002`를 알아 서버 검증 문구가 아니라 앱 카탈로그 문구("잘못된 요청이에요"/"Invalid request")를 보인다. 새 앱은 같은 규칙을 폼에서 먼저 막아 저장 버튼을 끈다.

구 앱 경로를 남긴 경우 지원 범위는 여기에 적는다.

- `POST /v1/todos/recurring`: 마지막 지원 앱 1.14.x. 내부는 `POST /v1/todos`의 `repeat`(매주 + 날짜까지)와 같은 경로다. 날짜 없음은 이 경로에서만 옛 코드 `SYS_0002`다. 지우는 기준은 7일 활성 사용자 중 1.14 이하가 5% 아래다. 릴리스마다 운영 읽기 전용(`User.lastSeenAppVersion`·`lastActiveAt`)으로 다시 본다. 2026-11-25 확인은 기준 위라 남긴다. 최소 지원 버전·강제 업데이트는 없다. 앱 버전 관리(`app-config/app-releases`)는 설정의 업데이트 확인이 읽는 스토어 최신 버전(`latestVersion`)만 둔다. 진행 중 반복 상한은 이 경로(메모 변환의 `isRecurring`, AI 제안 수락도 같다)에서 `TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY`(300개)이고 거절 코드는 `TODO_0813`이다. 옛 앱이 `TODO_0842`를 몰라 `SYS_0001`로 보이기 때문이고, `TODO_0813`은 옛 서버도 이 경로에서 보내던 코드라 옛 앱에 전용 문구("카테고리 한도")가 있다. 새 경로의 30개는 그대로 `TODO_0842`다. `TODO_0812`와 `RECURRING_TODO_LIMITS.MAX_DAYS_RANGE`는 이 경로와 함께 지운다.
- 1.4.0 전 앱의 저장 언어(`resolvePreI18nAppLocale`, `request-client.ts`): `X-App-Version`이 없거나 1.4.0보다 낮은 요청(1.10.0 이하 앱과 앱 밖 클라이언트, 앱은 1.10.1부터 `X-App-Version`을 보낸다)만 지원하지 않는 언어를 `ko`로 저장하고, 나머지는 앱과 같은 `resolveSupportedLocale`(`en`)이다. 1.4.0 전 앱은 Accept-Language를 직접 보내지 않았지만 iOS URLSession이 기기 언어(`ja-JP` 등)를 붙였고 화면은 한국어뿐이었다. 1.4.0~1.10.0 앱은 앱 언어 `ko`·`en`만 보내 이 분기를 타도 결과가 같으므로 영향은 지원하지 않는 언어뿐이다. 지우는 기준은 `/recurring`과 같은 방법으로 본 7일 활성 중 `lastSeenAppVersion`이 없거나 1.4.0 미만인 사용자가 5% 아래다. 2026-11-25 확인은 기준 아래라 [#1884](https://github.com/Aiddoo/Aido-platform/issues/1884)에서 지운다.
- `GET /v1/ai/usage`: 마지막 지원 앱 1.14.x(1.15 앱은 안 쓴다). `/recurring`과 같은 기준으로 함께 판단한다.
- `POST /v1/ai/parse-todo`: 마지막 지원 앱 1.14.x(1.15 앱은 `POST /v1/quick-plans`를 쓴다). 응답의 `meta`도 출시 계약이다. `/recurring`과 같은 기준으로 함께 판단한다.
- `POST /v1/ai/parse-memo`의 `Idempotency-Key` 생략: 마지막 지원 앱 1.14.x. 헤더가 없으면 요청마다 차감한다. 1.15 앱은 항상 보낸다. 생략을 막는 것은 1.14.x 사용자가 사라진 뒤에 판단한다.
- `POST /v1/memos`의 `Idempotency-Key` 생략: 출시 앱 1.15.1 이하와 서버 안 음성 계획 저장 경로(`PlanMemoWriterPort`). 헤더가 없으면 요청마다 메모를 만든다. 1.15.2 앱은 새 메모 저장마다 보내고, 같은 키로 글이 다르면 409 `MEMO_2004`다. 앱 쪽 생략을 막는 것은 1.15.1 이하 사용자가 사라진 뒤에 판단하고, 음성 계획 경로는 계속 키 없이 만든다.
- 메모 변환의 `isRecurring`·`recurrence`: 마지막 지원 앱 1.14.x. 서버가 Presentation에서 같은 `repeat`로 바꾼다. `/recurring`과 같은 기준으로 함께 판단한다.
- 파싱 응답의 `recurrence`(요일 + 종료일): 마지막 지원 앱 1.14.x. 새 앱은 `repeat`를 쓴다. `/recurring`과 같은 기준으로 함께 판단한다.
- `POST /v1/notifications/token`: 마지막 지원 앱 1.14.1. 1.14.2 앱부터 `PUT /v1/notifications/push-devices/{deviceId}`를 쓴다. 같은 UseCase로 위임한다. deviceId 없는 등록의 기본 기기 id `default`(`LEGACY_DEFAULT_DEVICE_ID`)와 `X-Device-Type` 플랫폼 추정(`legacyPlatformHint`)도 이 경로에만 있다. `/recurring`과 같은 방법으로 릴리스마다 다시 보고, 7일 활성 중 1.14.1 이하가 5% 아래면 경로와 두 대체를 함께 지운다. 2026-11-25 확인은 기준 위다. 같은 경로의 `DELETE /v1/notifications/token?deviceId=`는 구 앱 경로가 아니다. 1.15.x 앱이 로그인한 채 로그아웃할 때 이 기기를 푸는 현행 경로(`PushDeviceApi.unregister`)이고, 세션이 끝난 기기는 인증 없이 `POST /v1/notifications/push-devices/unregister`로 푼다.
- `Todo.recurrenceGroupId`(DB 칸·응답): 영구. 출시 앱 응답의 필수 칸이다.
- `RetentionExperimentAssignment.assignedAt`(DB 칸): 영구. 코드는 읽지 않지만 DB 기본값으로 남는 배정 시각이고 다른 칸에 없다.
- `Account.accessToken`·`accessTokenExpiresAt`·`refreshToken`·`scope`, `OAuthState.codeVerifier`·`ipAddress`·`userAgent`, `PushToken.lastUsedAt`(DB 칸): 1.17.0 스키마에서 뺐고 DB에는 남긴다. 어느 코드도 읽거나 쓰지 않지만 1.16.0 이미지가 세 테이블을 쿼리할 때마다 이름으로 적어, 지우면 배포 중이거나 롤백한 1.16.0이 실패한다. 1.17.0이 롤백 바닥이 되고 운영 읽기 전용 확인에서 1.17.0 배포 뒤 만든 행에 값이 없으면 1.18.0에서 지운다(compatibility.md). 예전 코드가 남긴 값은 어느 코드도 읽지 않아 지우는 조건이 아니다.
- `Todo.scheduledTime`(응답): 영구. 출시 앱은 이 순간을 기기 시간대로 보여 준다. 시간대 재계산은 완료했거나 지난 할 일까지 모두 다시 쓰므로 옛 앱에서도 고른 시각으로 보인다. 재계산 전 1~2분만 옛 시간대의 시각으로 보인다.
- Gemini 전용 AI 동의 경로: 영구. 재동의를 받지 않는 한 그 동의자는 Gemini만 쓴다.
- 콕 답장·감사 기능 꺼짐의 `NUDGE_1105`: 마지막 지원 앱 1.15.1. `NUDGE_1105` 하나가 "없는 콕"과 "서버 설정으로 기능 꺼짐" 두 뜻이라 꺼짐을 새 코드 `NUDGE_1111`(404, 상태는 같다)로 나눴다. 출시 앱은 보낸 콕 목록에서 `NUDGE_1105`를 보고 목록을 꺼진 상태로 보이고, 감사 시트는 404에 `NUDGE_1105` 문구("찾을 수 없어요")를 보인다. 그래서 `X-App-Version`이 1.15.2보다 낮거나 없으면 `ReleasedAppNudgeErrorInterceptor`(답장·감사 controller)가 `NUDGE_1111`을 `NUDGE_1105`로 바꿔 보낸다. 앱은 `nativeApplicationVersion`(숫자 x.y.z)을 보내 1.15.2 RC·TestFlight 빌드도 출시판과 같이 `NUDGE_1111`을 받는다. "없는 콕"은 모든 앱에 `NUDGE_1105` 그대로다. 1.15.2 앱은 보낸 콕 목록에서 `NUDGE_1105`·`NUDGE_1111`을 모두 꺼짐으로 읽었고(목록 API의 1105는 꺼짐 뜻뿐이다), 1.16.0 앱은 `NUDGE_1111`만 꺼짐으로 읽는다. 1.15.1 이하 사용자가 사라지면 interceptor를 지운다.
- OAuth 계정 연결의 시작 사용자 없는 state(`OAuthState.canLinkFor`): 1.15.0 이하 앱은 연결 시작에 `user_hint`를 보내지 않아 `initiatingUserId`가 비고, 그 state는 로그인한 누구의 연결로도 끝낼 수 있다. `/recurring`과 같은 방법으로 릴리스마다 다시 보고, 7일 활성 중 1.15.0 이하가 5% 아래면 빈 값을 거절한다(그 앱의 계정 연결은 실패한다). 2026-11-25 확인은 기준 위다.
- 서명 키의 `JWT_SECRET` 대체(`SigningKeyRing.legacy`, kid 없는 댓글 커서·광고 수신 거부 토큰 검증): 운영은 2026-11-23에 `CURSOR_SIGNING_KEYS`·`OPT_OUT_TOKEN_SIGNING_KEYS` 두 ring(kid `k20261123`)을 넣어 그날부터 ring 키로 서명한다. 그 전에 kid 없이 `JWT_SECRET`으로 서명해 보낸 수신 거부 토큰은 수명(`TOKEN_TTL_SECONDS` 90일)이 지나야 모두 만료되므로 대체 검증은 2027-02-21 이후에 지운다. 그때까지 `JWT_SECRET`을 바꾸지 않는다. 바꾸면 이미 보낸 수신 거부 링크와 댓글 커서를 검증하지 못한다.
- `GET /v1/todos/{id}/details`의 `permissions.canNudge` 의미: 주인 아님·끝내지 않음·보는 사람 `X-Timezone`의 오늘·맞팔 친구를 모두 만족할 때만 `true`다. 콕 보내기(`POST /v1/nudges`)가 받아 주는 할 일과 같은 규칙(`canNudgeTodoOn`·`MutualFriendReaderPort`)이라, `false`를 받은 출시 앱이 콕 버튼을 숨겨도 서버가 400 `NUDGE_1106`이나 친구 오류로 거절했을 요청뿐이다. 응답 모양·OpenAPI는 같다. 영구(값의 뜻은 콕 보내기 규칙을 따른다).
- 1.10.1 전 앱의 프로필 이미지 이름(`resolveProfileImage`, `profile-image.resolver.ts`): `X-App-Version`이 없거나 1.10.1보다 낮은 요청에는 그 앱에 없는 이름(`russian_blue`·`cream_cat`·`tuxedo_cat`)을 비슷한 옛 이름(`scottish_fold`·`white_cat`·`black_cat`)으로 바꿔 보낸다. 프로필을 싣는 응답 mapper가 모두 이 함수를 거친다. 지우는 기준은 `/recurring`과 같은 방법으로 본 7일 활성 중 `lastSeenAppVersion`이 없거나 1.10.1 미만인 사용자가 5% 아래다.
- 알림 종류별 최소 앱 버전(`NOTIFICATION_MIN_APP_VERSION`, `notification-client-capability.domain-service.ts`): 콕 답장·감사는 1.11.0, 초대 4종과 보상 기간 끝남(`PREMIUM_GRANT_ENDING`)은 1.13.0보다 낮은 앱에 푸시를 보내지 않고 알림함·안 읽은 수에서도 뺀다. 알림함은 요청의 `X-App-Version`, 푸시는 기기가 보고한 앱 버전으로 본다. 안 읽은 수 캐시 범위(`NotificationInboxScope`의 `legacy`·`since-1.11.0`·`all`)가 이 단계를 키로 쓴다. 지우는 기준은 `/recurring`과 같은 방법으로 본 7일 활성 중 `lastSeenAppVersion`이 없거나 1.13.0 미만인 사용자가 5% 아래이고, 그때 표와 `legacy` 범위를 함께 지운다.
- 푸시 아이콘 배지(`PUSH_BADGE_MIN_APP_VERSION`, `push-badge.domain-service.ts`): 기기가 보고한 앱 버전이 1.17.0 이상인 기기에만 안 읽은 수 배지를 싣는다. 그 전 앱은 수가 바뀔 때만 배지를 써서 다른 기기에서 읽은 뒤에도 배지가 남는다. 지우는 기준은 `/recurring`과 같은 방법으로 본 7일 활성 중 1.17.0 미만인 사용자가 5% 아래다.
- 새 기능 소개 마케팅 푸시(`supportsFeatureDiscoveryMarketing`, `feature-marketing-capability.domain-service.ts`): payload 버전 2이고 기기가 보고한 앱 버전이 1.8.0(파일 안 상수, 같은 이름의 캠페인 env와 다르다) 이상인 기기에만 보낸다. 버전 조건의 지우는 기준은 `/recurring`과 같은 방법으로 본 7일 활성 중 1.8.0 미만인 사용자가 5% 아래다. payload 버전 조건을 함께 지울 수 있는지는 확인 필요다.
- AI 데이터 처리 동의 화면이 없는 앱(`canShareWithAi`, `ai-data-sharing-consent.domain-service.ts`, `AI_DATA_SHARING_CONSENT.MIN_APP_VERSION`): 1.13.0보다 낮은 앱은 동의 화면이 없어, 거부·철회하지 않았으면 동의 없이 AI로 보낸다. 요청은 `X-App-Version`, 예약 작업(리포트 요약·반복 제안)은 푸시 기기와 인증 요청에 남은 가장 높은 버전으로 보고 모르면 낮은 앱으로 본다. 위의 Gemini 전용 동의 경로(동의한 안내 버전이 정하는 업체 범위)와는 다른 분기다. 지우는 기준은 `/recurring`과 같은 방법으로 본 7일 활성 중 `lastSeenAppVersion`이 없거나 1.13.0 미만인 사용자가 5% 아래다.
- 날씨 v1(`GET /v1/weather/forecast`·`GET /v1/weather/conditions`·`PUT /v1/weather/location`, `weather-forecast.controller.ts`·`location.controller.ts`): 마지막 지원 앱 1.13.1. 1.14.0 앱부터 `/v2/weather`를 쓴다. 지우는 기준은 `/recurring`과 같은 방법으로 본 7일 활성 중 1.13.1 이하인 사용자가 5% 아래다.
- 관리자 동기 broadcast(`POST /v1/admin/notifications/broadcast`, `BroadcastNotificationUseCase`): 앱이 아니라 관리자 도구가 부른다. 접수는 v2와 같은 캠페인 작업이다. 지우는 기준은 관리자 도구가 `POST /v2/admin/notifications/broadcasts`로 옮긴 것이다(옮겼는지는 확인 필요).
- `Todo.content`(응답, `todo-response.mapper.ts`): 늘 `null`이다. 계약은 nullable·optional이고 지금 앱은 읽지 않는다. 이 칸을 필수로 읽는 출시 앱이 있는지는 확인 필요이고, 확인 전에는 남긴다.
- 서버가 던지지 않는 오류 코드: `@aido/api/errors`의 `ErrorCode`에는 지금 서버가 던지지 않는 코드가 남아 있다(소셜 로그인 공급자 코드 묶음과 인증·이메일·인증 코드·그 밖 몇 개, 일부는 Swagger 오류 목록에만 있다). 세는 방법은 `ErrorCode` 키마다 `apps/api/src`에서 i18n·spec 밖 참조가 0인지 본다. 옛 서버 응답에 실렸을 수 있고 출시 앱이 문구와 분기로 아는 계약 값이라, 위 표의 REST 오류 코드 규칙대로 지우지 않는다. 앱의 `token-refresh-hook.ts` `ACCESS_TOKEN_REJECTED_CODES`도 이 가운데 `AUTH_0102`·`AUTH_0103`·`AUTH_0105`·`AUTH_0106`을 재발급 조건으로 본다(지금 JWT 가드는 `AUTH_0101` 하나로 낸다). 앱에서 뺄 시점은 확인 필요다.

모바일은 최신 출시 코드만 둔다. 앱은 옛 앱·옛 서버를 위한 분기와 대체 경로, mapper 기본값을 두지 않고 지금 서버가 주는 값만 받는다. 남기는 것은 셋이다.

1. 업그레이드한 기기의 저장 값: 아래 표의 코드로 한 번 옮기거나 읽는다.
2. 이미 퍼진 링크: 초대 링크, 위젯 URI, 공개 딥링크.
3. 앞으로 서버가 더할 값: 열거의 계약 `.catch`와 `parse{X}`의 `null`.

그래서 앱은 알림 옛 필드(type·action·context·routing)로 목적지를 계산하지 않는다. 알림 목적지는 서버 `navigation`을 mapper(`toNotificationTarget`)가 바꾼 앱 target 하나다. navigation이 없거나 틀리거나 푸시 data를 읽지 못하면 알림함으로 연다. 댓글 위치는 `/todo/[todoId]?comment=` 하나다.

알림함 행의 `navigation`은 서버 1.15.1부터 실린다. 서버를 1.15.1 아래로 되돌리지 않고 수정 배포로 대응한다.

기기에 이미 남은 값과 링크를 읽는 앱 코드도 외부 계약이다. 새 앱이 쓰지 않는 모양을 읽어 옮기거나 받아 준다.

| 코드(앱)                                                                                                        | 읽는 것                                                                                                                 | 지울 시점                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `shared/infra/storage/encrypted-draft-storage.ts` `deleteLegacyDrafts`                                          | 암호화 전 MMKV `aido.drafts`. 읽지 않고 파일째 지운다. 평문 초안이 기기에 남지 않게 옮기지 않는다                       | 1.15.x 이하 설치가 0이 된 뒤(먼저 지우면 평문 초안이 남는다)                                     |
| 피드 푸시 안내 저장 값(`pushNoticeDismissedAtStoredValue`, `aido_push_permission_prompt_dismissed_v1:{userId}`) | 1.14.x까지 쓰던 피드 안내 닫은 시각 key. 저장 값 정의로 옮겨도 이 key로 읽고 쓴다                                       | 영구(기기 저장 key)                                                                              |
| `activation-progress-storage.schema.ts`                                                                         | 1.14.x가 남긴 `pushRegistrationUnlockedAt`은 읽지 않고 버린다                                                           | 지울 코드 없음(스키마가 모르는 칸을 버린다)                                                      |
| `plan-review-form.schema.ts` `restoreDraftDateKey`                                                              | 저장 시간대 없이 ISO 시각으로 남긴 말로 메모 계획 카드의 날짜(voice-note-draft.repository의 `getTimezone`)              | 2026-12-11 이후(1.15.0 스토어 출시 2026-11-11 + 초안 보관 기간 `VOICE_NOTE_RETENTION_DAYS` 30일) |
| `voice-note-draft.schema.ts`의 새 칸 `.default`                                                                 | 칸이 생기기 전에 저장한 말로 메모 초안                                                                                  | 2026-12-11 이후(1.15.0 스토어 출시 2026-11-11 + 초안 보관 기간 `VOICE_NOTE_RETENTION_DAYS` 30일) |
| `query-cache-persistence.ts` `removePlaintextQueryCache`                                                        | 조회 캐시 암호화 전 기본 MMKV에 평문으로 남긴 `aido.query-cache:*`·`aido.query-cache.owner`. 읽지 않고 시작할 때 지운다 | 1.15.x 이하 설치가 0이 된 뒤(먼저 지우면 평문 캐시가 남는다)                                     |

코드에 남기는 제거 표시는 `지운다(compatibility.md)` 문구와 이 표의 시점으로 적어 `git grep '지운다(compatibility.md)'` 한 번으로 이 표의 행을 모두 찾는다. 지우지 않는 행(영구·다시 묻게 됨)은 코드에도 남기는 이유를 적는다.

호환 판단은 OpenAPI·released-client fingerprint([E2E](../../apps/api/docs/http-contracts.md#출시-앱-호환-절차))와 push/widget resolver 테스트로 확인한다. 고정된 released fixture를 현재 schema로 재생성하지 않는다.

## 3. REST 버전

- 경로 버전은 Nest URI 버저닝(`platform/http/api-versioning.ts`)이 붙인다. 버전을 지정하지 않은 컨트롤러는 `v1`, 버전이 없는 `health`는 `VERSION_NEUTRAL`이다.
- 응답 형태나 데이터 공급자가 통째로 바뀌어 구 앱이 같은 경로를 쓸 수 없을 때만 `/v{n+1}`을 연다. 필드 추가와 같은 버전 안의 동작 차이는 위 표의 방식으로 처리한다.
- 버전은 presentation과 계약에만 드러난다. `presentation/http/v{n}/`, `packages/api/src/contracts/<domain>/v{n}/`에 두고, UseCase·Domain·Port는 버전을 모른다.
- 이전 버전 작업에는 `@ApiDoc({ deprecated: true })`와 Swagger 태그(`… · Deprecated`)를 달고, 설명 첫 줄에 지원하는 마지막 앱 버전을 적는다(예: 날씨 v1은 1.13.1 이하). 그 앱 버전 사용자가 사라진 뒤 경로를 제거하고 그 릴리스 문서(`docs/releases/<앱 버전>/`)에 기록한다.
- 앱이 호출하지 않는 관리자 경로도 공개 OpenAPI 계약이다. 응답 의미가 바뀌면 같은 원칙으로 새 버전을 열고, 제거 조건은 앱 버전 대신 관리자 도구의 전환으로 적는다(예: 동기 `POST /v1/admin/notifications/broadcast` → 비동기 캠페인 `POST /v2/admin/notifications/broadcasts`).
