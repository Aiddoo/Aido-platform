# 푸시 알림 운영 기준

발송 정책·동의·일정 또는 delivery/receipt 장애를 확인할 때 참고한다. 구현 정본은 `src/modules/notification`과 `src/platform/jobs`다. 시각은 별도 표기가 없으면 모두 **사용자 IANA 타임존의 로컬 시각**이다.

## 공통 발송 조건

서버 발송에는 활성 Expo 토큰과 `pushEnabled=true`가 필요하다. OS 알림 권한과 실제 기기 도착은 서버 ticket/receipt만으로 보장하지 못한다. 알림 레코드 생성과 실제 푸시 전송은 분리되어 있으므로, 푸시가 차단돼도 앱 안 알림함 기록은 남을 수 있다.

| 정책             | 기준                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 일반 빈도 제한   | 사용자당 최근 1시간 최대 15회                                                                                           |
| 참여 유도 제한   | 로컬 날짜 기준 하루 최대 2회, 발송 사이 최소 4시간                                                                      |
| 참여 유도 대상   | `purpose=ENGAGEMENT` 또는 `WINBACK`, `SOCIAL_DIGEST`, `NUDGE_SUGGEST`, `LUNCH_NUDGE`, `STREAK_AT_RISK`, `AI_SUGGESTION` |
| 광고성 푸시 동의 | 참여 유도 대상은 `marketingPushAgreedAt`이 있어야 함                                                                    |
| 야간 시간        | 21:00 이상 08:00 미만                                                                                                   |
| 야간 참여 유도   | 동의 여부와 관계없이 발송하지 않음                                                                                      |
| 야간 일반 푸시   | `nightPushEnabled=true`일 때 발송                                                                                       |
| 야간 예외        | 사용자가 시각을 정한 `WEATHER_MORNING`, `WEATHER_EVENING`                                                               |
| Redis 장애       | 기존 정책대로 fail-open. 비정상 배치 결과도 타입 검증 후 전체 허용                                                      |

기본 제한 저장소는 PostgreSQL이다. Redis backend를 선택한 경우 배치는 하나의 Lua 실행으로 입력 순서대로 예약하며 기존 fail-open 의미를 유지한다. 동일 dispatch retry는 reservation을 재사용하고, 저장소 선택과 새 delivery attempt를 혼동하지 않는다.

## 자동 발송 일정과 대상

| 시각/트리거                  | 알림                  |      무료 | 프리미엄·관리자 | 주요 조건                                                                                         |
| ---------------------------- | --------------------- | --------: | --------------: | ------------------------------------------------------------------------------------------------- |
| 할 일 시각 -60분/-10분/정시  | `TODO_REMINDER`       |         O |               O | 활성·미완료 할 일, 단계별 중복 방지                                                               |
| 기본 07:00, 사용자 설정 가능 | `WEATHER_MORNING`     |         O |               O | 날씨 알림 사용. 위치가 없으면 안내 문구 사용                                                      |
| 08:00                        | `MORNING_REMINDER`    |         O |               - | 오늘 할 일이 없어도 하루 1회                                                                      |
| 사용자 설정 오전 시각        | `MORNING_REMINDER`    |         - |               O | 시간·분 커스텀, 하루 1회                                                                          |
| 가입일 +2시간                | Retention V2 D0       | 실험 대상 |       실험 대상 | treatment 사용자, 야간이면 다음 허용 시각으로 이월                                                |
| 10:30                        | 온보딩 / Retention V2 |         O |               O | legacy D0·D1·D2·D3·D5·D7 또는 treatment D1·D3·D7                                                  |
| 월요일 11:30                 | `WEEKLY_ACHIEVEMENT`  |         O |               - | 지난주 완료 1개 이상. 성취 기록은 모든 사용자에게 저장                                            |
| 월요일 11:30                 | `WEEKLY_REPORT`       |         - |               O | 지난주 활동이 있을 때                                                                             |
| 매월 1일 11:30               | `MONTHLY_REPORT`      |         - |               O | 지난달 활동이 있을 때. 같은 날 주간 리포트를 대체                                                 |
| 12:30                        | `LUNCH_NUDGE`         |         O |               O | 오늘 할 일은 있으나 완료가 0개                                                                    |
| 15:00                        | `NUDGE_SUGGEST`       |         O |               O | 2~7일 비활성 맞팔 친구, 동일 조합 주 1회                                                          |
| 16:00                        | `WINBACK`             |         O |               O | 3·7·14·21·30일 비활성 단계별 1회                                                                  |
| 기본 17:30, 사용자 설정 가능 | `WEATHER_EVENING`     |         O |               O | 다음 날 예보. 위치가 없으면 안내 문구 사용                                                        |
| 19:00                        | `EVENING_REMINDER`    |         O |               - | 오늘 할 일이 있는 사용자, 하루 1회                                                                |
| 사용자 설정 오후 시각        | `EVENING_REMINDER`    |         - |               O | 시간·분 커스텀, 하루 1회                                                                          |
| 20:15                        | `STREAK_AT_RISK`      |         O |               O | 유효 스트릭 3일 이상이며 오늘 미완료                                                              |
| 저녁 리마인더 +90분          | `SOCIAL_DIGEST`       |         O |               O | 직전 저녁 리마인더 실제 수신자 중 본인 미완료 + 완료 친구 존재. 같은 날 스트릭 위기 수신자는 제외 |

월간 리포트와 주간 리포트는 같은 11:30 슬롯에서 동시에 보내지 않는다. 무료 주간 달성 요약은 프리미엄 리포트와 대상이 다르므로 별도로 집계한다. 모든 일일 스케줄은 `notificationDate` 또는 전용 Redis 키로 중복 발송을 막는다.

AI 제안 분석은 매일 07:30 KST에 dispatch하며 재시작 시 해당 시각 이후의 누락 실행을 보정한다. 대상은 활성·미삭제 프리미엄(`subscriptionStatus=ACTIVE`) 또는 관리자이며 최근 14일에 반복 그룹이 아닌 할 일 기록이 있어야 한다. 분석 시작과 저장 transaction에서 `hasPremiumAccessInTx`로 권한을 다시 확인하고, 실제 저장한 제안이 있을 때만 `AI_SUGGESTION`을 발행한다. 제안은 기록 기반 반복 설정·시작 단계 재시도·보완 제안을 포함한다. 할 일 파싱의 일일 quota와 제안·리포트의 premium 권한 검사는 별도 정책이다.

이 권한 검사는 푸시 동의를 대신하지 않는다. AI 제안은 `purpose=ENGAGEMENT`이므로 마케팅 동의·참여 유도 한도·야간 억제와 공통 발송 조건을 추가로 적용한다. 주간·월간 AI 리포트는 premium 권한 대상의 서비스 알림이며 위 일정의 활동 조건을 따른다.

## 알림 타입별 계약

`목적`이 `참여`인 항목만 광고성 푸시 동의와 참여 유도 일일 한도를 적용한다. `서비스`와 `거래`는 일반 시간당 한도와 야간 설정을 적용한다.

| 타입                 | 발생 조건/생성 주체                   | 목적         | 기본 이동                        |
| -------------------- | ------------------------------------- | ------------ | -------------------------------- |
| `FOLLOW_NEW`         | 친구 신청 수신                        | 거래         | 친구 신청 목록                   |
| `FOLLOW_ACCEPTED`    | 친구 신청 수락                        | 거래         | 친구 피드, ID가 없으면 친구 목록 |
| `NUDGE_RECEIVED`     | 친구의 콕 또는 할 일 생성 리마인드 콕 | 거래         | 친구 피드                        |
| `CHEER_RECEIVED`     | 친구 응원 수신                        | 거래         | 친구 피드                        |
| `DAILY_COMPLETE`     | 오늘 할 일 전체 완료                  | 거래         | 피드                             |
| `FRIEND_COMPLETED`   | 친구의 오늘 할 일 전체 완료           | 거래         | 친구 피드                        |
| `TODO_REMINDER`      | -60분/-10분/정시 지연 잡              | 서비스       | 피드 (`todoId` 유지)             |
| `TODO_SHARED`        | 할 일 공유                            | 거래         | 피드 (`todoId` 유지)             |
| `MORNING_REMINDER`   | 아침 자동 스케줄                      | 서비스       | 피드                             |
| `EVENING_REMINDER`   | 저녁 자동 스케줄                      | 서비스       | 피드                             |
| `WEEKLY_ACHIEVEMENT` | 무료 사용자 주간 성취                 | 서비스       | 성취 화면                        |
| `WEEKLY_REPORT`      | 프리미엄·관리자 주간 리포트           | 서비스       | 리포트 화면                      |
| `MONTHLY_REPORT`     | 프리미엄·관리자 월간 리포트           | 서비스       | 리포트 화면                      |
| `AI_SUGGESTION`      | 기록 기반 할 일 제안                  | 참여         | 제안 화면                        |
| `SYSTEM_NOTICE`      | 온보딩, 결제, 운영 공지               | 생성 시 지정 | 명시적 action, 없으면 이동 안 함 |
| `ADMIN_BROADCAST`    | 관리자 전체·조건 발송                 | 생성 시 지정 | 명시적 action, 없으면 이동 안 함 |
| `ADMIN_TARGETED`     | 관리자 특정 사용자 발송               | 생성 시 지정 | 명시적 action, 없으면 이동 안 함 |
| `WINBACK`            | 비활성 단계 도달                      | 참여         | 피드                             |
| `SOCIAL_DIGEST`      | 친구 완료 활동 요약                   | 참여         | 피드                             |
| `NUDGE_SUGGEST`      | 비활성 맞팔 친구 감지                 | 참여         | 친구 피드, ID가 없으면 피드      |
| `LUNCH_NUDGE`        | 점심까지 완료 0개                     | 참여         | 피드                             |
| `STREAK_AT_RISK`     | 스트릭 3일 이상 + 오늘 미완료         | 참여         | 피드                             |
| `WEATHER_MORNING`    | 오늘 날씨 또는 위치 설정 안내         | 서비스       | 피드                             |
| `WEATHER_EVENING`    | 내일 날씨 또는 위치 설정 안내         | 서비스       | 피드                             |

`BROWSER`, `WEBVIEW`, `NONE` action은 표의 기본 이동보다 우선한다. `DEEP_LINK`에 URL이 있으면 해당 내부 경로를 우선한다.

## 문구와 변형 선택

- 한국어와 영어 카탈로그는 키, variant 수, 플레이스홀더가 항상 같아야 한다.
- 한국어는 실제 앱 푸시에서 자연스러운 친근한 반말을 사용하고, 죄책감·조롱·과한 유행어는 쓰지 않는다.
- 제목은 60자, 본문은 120자 이하이며 한 줄의 이모지는 최대 1개다.
- 반복 캠페인은 `campaignKey + templateKey + recipientId + occurrenceKey`로 variant를 결정한다. 같은 사용자·같은 발생 건은 재시도나 서버 재시작 뒤에도 문구가 바뀌지 않는다.
- `templateKey`는 아침 할 일 유무, 저녁 진행 상태, 날씨 조건처럼 한 캠페인 안의 의미상 다른 카피 풀을 구분한다. `variantId`에도 포함되므로 서로 다른 문구가 같은 ID로 집계되지 않는다.
- `campaignKey`는 카피나 대상 정책이 바뀔 때만 버전을 올린다. `variantId`는 실제 선택된 문구를 함께 기록한다.
- 사용자 작성 메시지와 결제·운영 공지는 내용을 임의로 변형하지 않는다.

## 타임존 처리

배송·야간 자격 경로는 미상/무효 및 저장 기본 UTC를 KST로 해석하는 `resolveDeliveryTimezone`을 사용한다. 일반 날짜 계산의 UTC fallback과 별도 정책이다.

- 푸시 토큰 등록의 `x-timezone`이 없으면 기존 저장값을 유지한다.
- 설정 API의 잘못된 IANA 타임존은 `400 SYS_0002`로 거부한다. 유효한 별칭은 런타임의 정규 IANA 이름으로 저장한다.
- 일반 API에서 누락·오류 타임존 값은 `UTC`로 처리한다.
- 과거에 잘못 저장된 값은 활성 스케줄 타임존 목록에서 제외하고, 날짜 계산이 필요한 방어 경로에서는 `UTC`로 폴백한다.
- 과거에 저장된 유효한 IANA 별칭은 원래 저장값으로 스윕해 조회 조건과 일치시킨다. 이를 정규 이름으로만 합치면 기존 별칭 사용자가 누락되므로, 신규 입력부터 점진적으로 정규화한다.
- 모든 고정 시각, 로컬 날짜 중복 키, 참여 유도 일일 한도는 IANA 타임존과 DST를 반영한다.

## 구버전 클라이언트 호환성

v1.0.0~v1.4.0이 요구한 푸시 data 필드 `notificationId`, `type`, `action`, `context`의 이름과 의미는 바꾸지 않는다. v1.5 계열의 `dispatchId`, `campaignKey`, `variantId`, `purpose`, `marketingOptOutToken`은 모두 optional 추가 필드다. 과거 Zod object는 알 수 없는 optional 필드를 제거하므로 그대로 파싱된다.

호환성 테스트는 Git 릴리스 이력의 실제 알림 타입 enum을 반영한 v1.0~~v1.1, v1.2~~v1.4 스키마와 현재 `pushNotificationDataSchema`로 같은 서버 payload를 각각 파싱한다. OpenAPI paths/components 스냅샷도 별도로 고정한다.

소셜 다이제스트 지연 잡은 직전 저녁 리마인더 수신자 CUID 목록을 함께 저장한다. 배포 전에 생성되어 대상 목록이 없는 구형 지연 잡은 타임존 전체로 확대 발송하지 않고 안전하게 건너뛴다.

신규 저녁 기본값 19:00 마이그레이션은 DB column default만 바꾸며 기존 사용자의 저장된 커스텀 값은 갱신하지 않는다.

## Delivery·receipt·롤아웃

알림 기록, PushDispatch와 outbox, 외부 Expo 발송은 분리된다. worker는 publication generation·job ID·delivery attempt fence로 claim/finalize/retry를 제한한다. stale worker가 새 generation을 끝내지 못하게 하는 내부 원자성은 외부 푸시 exactly-once와 다르다.

Expo ticket 수락은 TICKET_ACCEPTED, receipt 성공은 DELIVERED다. receipt 조회 대상은 생성 후 15분 이상 24시간 이하인 TICKET_ACCEPTED 행이며 createdAt/id 순서로 제한한다. 너무 오래된 missing ticket이 앞 배치를 계속 차지하지 않지만 해당 행은 별도 terminal 처리 없이 남는다. SDK의 빈 receipt map은 받은 결과만 반영하고 응답 누락 ticket을 실패로 추측하지 않는다.

receipt 갱신은 TICKET_ACCEPTED에만 원자적으로 적용한다. 이미 DELIVERED/FAILED인 ticket의 중복 응답은 되돌리지 않는다. DeviceNotRegistered는 저장된 발송 token SHA256과 현재 token이 같을 때만 현재 token 비활성화 대상으로 반환한다. receipt 상태와 token 비활성화는 하나의 UNIT_OF_WORK에서 처리하고 실패 시 함께 rollback한다. commit 뒤 user별 token cache invalidation은 allSettled로 실패를 격리해 기록한다.

새 nullable fingerprint DDL이 API보다 먼저 필요하다. 이전 행의 null fingerprint는 상태만 반영하며 token을 추측해 비활성화하지 않는다. 배포 순서·contract marker·이미지 rollback 범위는 [DEPLOYMENT.md](../DEPLOYMENT.md#db-전환-api보다-먼저-적용)에 있다.

남는 한계:

- 보호는 이미 저장된 발송 당시 A fingerprint와 현재 B token 비교에 적용된다. network send 도중 token 회전으로 기존 token 문자열 lookup이 실패하면 attempt가 생략될 수 있다.
- 같은 token을 다시 등록하는 ABA 등록 세대는 SHA256만으로 구별하지 못한다.
- 앞 청크가 수락된 뒤 다음 청크 transport가 실패하면 전체 논리 배치 retry에서 중복 전달이 가능하다. SDK error 원문과 typed progress/cause 계약은 유지하며 원문/token/body/credential은 로그에 남기지 않는다.
- receipt는 외부 provider handoff 결과다. 기기 알림 표시·사용자 열람·production drain 완료·운영 exactly-once를 보장하지 않는다.

기본 job runtime은 PostgreSQL/pg-boss다. legacy Redis/BullMQ queue aliases·payload·retry는 production 잔존 작업의 drain이 확인되기 전 제거하지 않는다. 일반 notification 잡은 `retryLimit=2`(최초 시도를 포함해 최대 3회)이며 push-delivery 잡의 별도 재시도 정책과 구분한다. 선택 backend/drain의 운영 절차는 [DEPLOYMENT.md](../DEPLOYMENT.md#job-전환과-잔존-작업)에 있다.

로컬 실제 PostgreSQL은 rotation/replay/age 경계/legacy null/lifecycle 저장·rollback을, 실제 설치 Expo SDK + 차단된 HTTP fixture는 ticket/transport 순서·오류 반환·로그 비노출을 검증한다. 외부 network나 기기에 실제 발송한 증거와 구분한다. [Expo 공식 sending 문서](https://docs.expo.dev/push-notifications/sending-notifications/)는 15분 receipt 확인과 24시간 보관, DeviceNotRegistered 처리를 설명한다.
