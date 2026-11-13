# Aido GA4(Firebase) 측정 계획

GA로 무엇을 보고 어떤 결정을 내리는지, 퍼널·지표 정의를 고칠 때 읽는다. Firebase 프로젝트는 `aido-997b5`이고 실제 수집은 배포 후 DebugView로 검증한다.

말한 내용·전사·할 일 제목·메모 내용은 어떤 이벤트에도 싣지 않는다.

## 1. 이벤트

이벤트 이름·파라미터는 코드의 `AppEventMap`이 원본이라 이 문서에 다시 적지 않는다. 이름 규칙과 파라미터 타입은 `aido/analytics-event-catalog`가 막고, 보내는 자리·측정 규칙(내부 트래픽, 매출 원본, 사용자 속성 `is_premium`·`subscription_status`·`premium_source`, 가입·로그인 한 번)은 [관측](./observability.md#analytics)이 원본이다.

| 영역               | 이벤트 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 앱 공통            | [event-map](../src/shared/analytics/event-map.ts)(`feature_action_success`·`local_day_changed`·`view_tab_changed` 등)                                                                                                                                                                                                                                                                                                                                                                              |
| identity           | [auth](../src/features/identity/auth/constants/auth.events.ts) · [consent](../src/features/identity/consent/constants/consent.events.ts) · [preference](../src/features/identity/preference/constants/preference.events.ts) · [user](../src/features/identity/user/constants/user.events.ts)                                                                                                                                                                                                       |
| planning           | [todo](../src/features/planning/todo/constants/todo.events.ts) · [category](../src/features/planning/category/constants/todo-category.events.ts)                                                                                                                                                                                                                                                                                                                                                   |
| notes·voice        | [memo](../src/features/notes/memo/constants/memo.events.ts) · [voice](../src/features/voice/constants/voice.events.ts)                                                                                                                                                                                                                                                                                                                                                                             |
| social             | [friend](../src/features/social/friend/constants/friend.events.ts) · [invite](../src/features/social/invite/constants/invite.events.ts) · [nudge](../src/features/social/nudge/constants/todo-nudge.events.ts) · [moderation](../src/features/social/moderation/constants/moderation.events.ts)                                                                                                                                                                                                    |
| engagement·알림    | [comment](../src/features/engagement/comment/constants/todo-comment.events.ts) · [notification](../src/features/notification/constants/notification.events.ts) · [weather](../src/features/weather/constants/weather.events.ts)                                                                                                                                                                                                                                                                    |
| insights·assistant | [achievement](../src/features/insights/achievement/constants/achievement.events.ts) · [report](../src/features/insights/report/constants/report.events.ts) · [suggestion](../src/features/assistant/suggestion/constants/suggestion.events.ts)                                                                                                                                                                                                                                                     |
| billing·support    | [subscription](../src/features/billing/subscription/constants/subscription.events.ts) · [inquiry](../src/features/support/inquiry/constants/inquiry.events.ts)                                                                                                                                                                                                                                                                                                                                     |
| device·app-config  | [activation](../src/features/device/activation/constants/activation.events.ts) · [coachmark](../src/features/device/coachmark/constants/coachmark.events.ts) · [store-review](../src/features/device/store-review/constants/store-review.events.ts) · [widget](../src/features/device/widget/constants/widget.events.ts) · [app-version](../src/features/app-config/app-version/constants/app-version.events.ts) · [whats-new](../src/features/app-config/whats-new/constants/whats-new.events.ts) |

- 보내는 곳은 `git grep -n "'<이벤트 이름>'" -- apps/mobile/src`로 찾는다. 전송은 `track()`·`useTrack().trackEvent()` → `createFirebaseAnalytics` → `logEvent`이고, 자동 화면 수집은 꺼 두고(`firebase.json`) `useScreenTracking`이 route 템플릿으로 `screen_view`를 보낸다.
- 숫자 엔터티 id(`todo_id`·`memo_id` 등)는 개인정보는 아니지만 고카디널리티라 커스텀 측정기준으로 등록하지 않는다([GA 콘솔 설정](./analytics-ga-console.md#b-커스텀-측정기준)).

### 화면 조회(`screen_view`)의 정의

사용자가 본 경로 보기 한 번이다. 이름은 route 템플릿(`/todo/[todoId]`)이다. 보내는 장치와 규칙은 [관측](./observability.md#화면-조회)이 원본이다.

| 센다                                                                                  | 세지 않는다                                                                      |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 경로가 바뀐 화면(시트 route 포함), 같은 템플릿의 다른 대상(`/todo/1` → `/todo/2`)     | query만 바뀜(날짜·친구·보기 탭, 탭은 `view_tab_changed`가 맡는다)                |
| 상세·시트에서 돌아온 아래 화면                                                        | 스플래시 뒤로 지나가는 입구 `/`·`/loading`·`/auth/[provider]`(1.15.2부터)        |
| 넓은 화면에서 목록 옆 칸에 고른 상세. 좁은 화면과 같은 상세 이름으로 센다(1.15.2부터) | 넓은 화면에서 칸을 닫음(목록은 줄곧 보였다), 칸의 상세를 접어 상세 화면으로 넘김 |

진입·노출 이벤트(`weather_opened`, `paywall_viewed` 등)는 같은 이동의 `screen_view` 뒤에 나간다(1.15.2부터). 그래서 그 이벤트의 "페이지 제목 및 화면 이름" 측정기준이 앞 화면이 아니라 그 화면이다.

### 1.15.2에서 바뀐 숫자

이벤트 이름과 params는 그대로다. 기본 보고서의 정의가 바뀌는 것만 있다. GA에 1.15.2 스토어 공개일(단계적 출시면 시작일)로 "1.15.2 screen_view 정리(입구·가드 화면 제외, 넓은 화면 칸 상세 추가)" 주석을 달고, 앞뒤는 `앱 버전` 측정기준으로 나눠 비교한다.

| 바뀐 것                                                           | 영향                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 입구 화면 3개를 `screen_view`에서 뺌                              | 콜드 스타트마다 최대 3번, 로그인·로그아웃마다 1번 덜 센다. "페이지 및 화면"의 조회수 합계·세션당 조회수가 줄고 `/`·`/loading`·`/auth/[provider]` 행이 사라진다. GA4 참여 세션 조건(화면 2회 이상)이 콜드 스타트마다 채워지던 것이 빠져 **참여 세션·참여율이 준다**. 사용자 수, §4의 KPI·퍼널·키 이벤트·잠재고객 정의는 그대로다 |
| 인증 가드가 막은 화면을 `screen_view`에서 뺌                      | 가입·이메일 로그인·이메일 인증을 마칠 때마다 `/login` 조회가 1번 준다(1.15.1부터 있던 유령). 화면 경로로 보는 가입 흐름에 가입 뒤 `/login`으로 돌아간 단계가 없어진다. 피드가 아닌 화면에서 로그아웃·세션 만료할 때마다 `/feed`도 1번 준다. KPI·퍼널 정의는 그대로다                                                            |
| 넓은 화면 칸 상세를 셈                                            | iPad·폴더블의 `/todo/[todoId]`·`/memo/[memoId]` 조회가 늘어 폰과 같은 기준이 된다                                                                                                                                                                                                                                               |
| 진입·노출 이벤트의 화면 이름                                      | 앞 화면에서 그 화면으로 바뀐다. 이 측정기준으로 자르는 보고서는 없다                                                                                                                                                                                                                                                            |
| `badge_summary_viewed`, `push_permission_prompt_shown{feed_card}` | 뒤 탭 재조회·카드가 숨었다 다시 보일 때 다시 세던 것이 빠져 조금 준다. `feed_card` 노출 대비 `push_permission_requested` 비율은 조금 오른다. 쓰는 퍼널은 없다                                                                                                                                                                   |
| `invite_link_opened`                                              | 루트 "다시 시도" 뒤 같은 링크를 다시 세던 것이 빠진다. 초대 퍼널은 그대로다                                                                                                                                                                                                                                                     |
| `weather_opened`                                                  | 1.15.1과 같다. 1.15.2에서 날씨 화면을 Stack에 하나만 두며 생길 뻔한 감소(남은 날씨를 알림으로 다시 열면 세지 않음)를 연 시각으로 막았다. 날씨 채택 KPI ①·날씨 퍼널 2개·잠재고객 "날씨 사용자"·카드 7은 이어서 본다                                                                                                              |

## 2. RevenueCat → GA 이벤트 (Firebase 연동)

`PurchasesSession`가 `Analytics.getAnalyticsId()`를 읽어 `PurchasesGateway.setAnalyticsId`로 넘긴다. 어댑터가 `setFirebaseAppInstanceID`를 부른다. RevenueCat이 Measurement Protocol로 아래 이벤트를 보낸다(출처: RevenueCat Firebase 연동 문서, 2026-11 확인).

| RevenueCat 이벤트              | GA 이벤트명              | 비고                                                        |
| ------------------------------ | ------------------------ | ----------------------------------------------------------- |
| Initial Purchase               | `purchase`               | 신규 결제                                                   |
| Trial Started                  | `rc_trial_start`         |                                                             |
| Renewal(체험 → 유료 전환 포함) | `purchase`               | 신규와 같은 이름. 구분 파라미터는 RevenueCat 문서 확인 필요 |
| Non-subscription Purchase      | `purchase`               | 현재 비구독 상품 없음                                       |
| Cancellation(체험 중 포함)     | `rc_cancellation`        | 자동갱신 해제 = 이탈 예고                                   |
| Uncancellation                 | `rc_uncancellation`      | 해제 철회                                                   |
| Expiration                     | `rc_expiration`          | 실제 이탈                                                   |
| Billing Issue                  | `rc_billing_issue`       | 결제 실패                                                   |
| Product Change                 | `rc_product_change`      | 월↔연 변경                                                  |
| Subscription Paused            | `rc_subscription_paused` | Play 전용                                                   |
| Transfer                       | `rc_transfer_event`      | 계정 간 이전(2건 전송)                                      |

- `rc_initial_purchase_event` 같은 이름은 없다. 파라미터 상세(`product_id`·`period_type`·`value`·`currency`)가 GA에 그대로 가는지는 DebugView로 1회 검증한다.
- 샌드박스 이벤트도 전송된다고 문서에 있다. RC 대시보드에서 샌드박스 제외 옵션을 확인한다. 없으면 GA 탐색에서 `environment`류 파라미터로 제외한다(파라미터 존재 여부 확인 필요).
- RC 연동에는 스트림별 Firebase App ID + API secret을 넣는다. 운영 App ID만 등록돼 있으면 dev·preview 빌드의 app instance id는 매칭되지 않는다. 운영만 대상으로 둔다.
- 매출 통화(구매 통화 vs USD)와 총액·순액은 RC에서 USD 순액(수수료·세금 제외)을 권장한다. 대시보드 수치를 결정용 매출과 맞춘다.

## 3. 서버(apps/api) 비즈니스 이벤트

서버는 pino 로그 키(`*-log.events.ts`)와 DB로 남긴다. GA로 보내지 않는다.

| 서버 신호                              | 로그 키 / 원천                                                                                   | 결정                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 푸시 발송·전달·오픈                    | `notification.delivery.push-notification-delivery.*-sent`, `Notification.openedAt`, push receipt | 서버 지표. 발송 분모는 서버만 정확하다. GA에는 오픈만(`push_notification_opened`). 오픈율은 서버 SQL |
| 리텐션·윈백 실험(variant)              | `notification.retention.*`, retention experiment 테이블                                          | 서버 지표. GA는 `push_notification_opened.variant_id`로 오픈 후 행동만 비교                          |
| 초대 qualified / 보상 지급 / 보상 실패 | `social.invite.qualified`, `social.invite.rewards.granted`, `…reward.apply.failed`               | 서버 지표. 앱 루프 퍼널은 GA `invite_redeemed`까지. 보상 지급률은 서버 SQL                           |
| 프리미엄 보상 기간(GRANT) 시작·종료    | `billing.premium-grant.recorded`·`swept`                                                         | 서버 지표 + 사용자 속성 `premium_source`로 GA에 반영(앱에서 `me.premiumAccess.source`)               |
| RevenueCat 웹훅 처리                   | `billing.subscription.webhook.*`                                                                 | 운영 지표. 비즈니스 이벤트는 RC→GA가 맡는다                                                          |
| AI 쿼터 소진·생성 실패                 | `access.quota.*`, `ai.generation.*`                                                              | 서버 지표(비용·품질). GA는 앱 노출 결과(`limit_reached_shown`, `voice_plan_failed`)만                |
| 날씨 리포트 생성·프로바이더 실패       | `weather.*`, `weatherkit.*`                                                                      | 서버 지표(Sentry·로그)                                                                               |

Measurement Protocol(서버 → GA)은 도입하지 않는다. 위 신호는 SQL로 더 정확히 계산되고, GA로 보내면 app_instance_id 매핑·중복·세션 왜곡만 생긴다.

## 4. 의사결정 프레임: 핵심 질문 → KPI → 소스 → 리포트

| 영역           | 질문                                         | KPI 정의                                                                                                    | GA 소스                                                                                                                             | 리포트                            |
| -------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 획득           | 가입이 늘고 있나, 어떤 방식으로?             | 일별 가입 수 · 방식 비율                                                                                    | `auth_signup.method`(소셜 가입은 앱 1.14.1부터)                                                                                     | 개요 카드                         |
| 활성화         | 가입자가 가치를 경험하나?                    | 가입 7일 내 `activation_completed` 사용자 / 가입자                                                          | `auth_signup` → `todo_created`·`voice_plan_applied` → `todo_completed{is_completed=true}` → `activation_completed`                  | 유입경로(퍼널) 탐색               |
| 리텐션         | 돌아오나?                                    | D1·D7·D30 재방문(첫 방문 코호트), 주간 활성 중 할 일 만든 비율                                              | `first_open`(자동) 코호트 · 반환 기준 `todo_created`·`voice_plan_applied`                                                           | 코호트 탐색                       |
| 핵심 사용 빈도 | 얼마나 쓰나?                                 | 활성 사용자당 주간 `todo_completed{is_completed=true}`                                                      | 이벤트 수 / 활성 사용자                                                                                                             | 개요 카드                         |
| 날씨 채택      | 날씨를 쓰고 행동이 바뀌나?                   | ① 날씨 도달 사용자 비율 ② 위치 권한 `granted` 비율 ③ 옮기기 열기→적용 전환율(취소 제외) ④ 날씨 알림 켠 비율 | `weather_opened`, `weather_location_permission_result`, `weather_reschedule_*`, `settings_changed{setting=weather*Enabled}`         | 퍼널 + 자유형식(앱 버전 비교)     |
| AI 채택        | AI가 할 일 생산성을 높이나?                  | 저장된 계획의 할 일 수(`source`별) · 계획 실패율 · 제안 수락률                                              | `voice_plan_applied.todo_count`, `voice_plan_generated`·`voice_plan_failed.cause`, `ai_suggestion_acted.action`                     | 자유형식                          |
| 음성           | 말하기가 할 일로 이어지나?                   | 시작 → 완료 → 계획 → 저장 전환 · 기기 인식 비율(iOS 빠른 말하기는 항상 서버) · 멈춤 빈도                    | `voice_capture_started.on_device`, `voice_capture_finished.outcome`, `voice_recognizer_stalled`, `voice_plan_*`                     | 퍼널(분류 `mode`)                 |
| 바이럴 루프    | 초대가 사용자를 데려오나?                    | 진입점별 공유율 · 공유당 링크 오픈 · 오픈당 사용 성공 · 실패 사유                                           | `invite_entry_tapped.entry` → `invite_link_shared.channel` → `invite_link_opened` → `invite_redeemed`·`invite_redeem_failed.reason` | 퍼널(공유자≠수신자라 열린 퍼널)   |
| 알림           | 알림이 재방문을 만드나?                      | 유형별 오픈 수 · 오픈 후 같은 세션 `todo_completed` 비율 · 마케팅 동의율·해지율 (오픈율 분모는 서버)        | `push_notification_opened.type`·`campaign_key`·`variant_id`, `marketing_push_*`                                                     | 자유형식 + 서버 SQL               |
| 수익화: 게이트 | 어떤 기능이 업그레이드를 가장 많이 유도하나? | 게이트 기능별 노출 → 구독하기 → 페이월 → 체험·구매 전환율                                                   | `premium_gate_shown.feature` → `premium_gate_cta_tapped` → `paywall_viewed` → `rc_trial_start`·`purchase`                           | 퍼널(분류 `feature`)              |
| 수익화: 매출   | 매출·체험 전환은?                            | 일 매출 · 신규 구매 수 · 체험 시작 수 · 체험→유료 전환                                                      | `purchase`(value), `rc_trial_start`                                                                                                 | 개요 카드 + 수익 창출 기본 보고서 |
| 이탈·결제 문제 | 왜 떠나나, 결제 실패 규모는?                 | 주간 `rc_cancellation`·`rc_expiration`·`rc_billing_issue` 사용자 수 · 해지 전 30일 활동량                   | RC 이벤트 + `subscription_status`                                                                                                   | 자유형식 + 위험 잠재고객          |

## 5. GA 콘솔 설정

키 이벤트·커스텀 측정기준·잠재고객·퍼널·개요 카드·보관·내부 트래픽 설정값은 [GA 콘솔 설정](./analytics-ga-console.md)에 있다. 콘솔 상태는 코드로 확인할 수 없어 콘솔을 바꿀 때 그 값을 기준으로 삼는다.

## 6. 열린 항목

대시보드 의존을 확인한 뒤 바꾼다. 이름을 바꾸면 이력이 끊긴다. 이벤트 이름 40자·값 100자·예약 접두사(`firebase_`·`google_`·`ga_`) 한도는 지금 넘지 않는다(가장 긴 이름 `weather_location_permission_result` 34자).

| 현재                                                    | 제안                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `todo_completed{is_completed}`(해제도 completed)        | 유지. GA에선 항상 `is_completed=true` 필터                                               |
| `notification_center_opened`(실제로는 항목 탭)          | `notification_center_item_tapped`(새 이름 병행 뒤 옛 이름 제거)                          |
| `remind_nudge_sent`                                     | `nudge_remind_sent`                                                                      |
| `badge_opened_from_notification`                        | 제거(`push_notification_opened{type=WEEKLY_ACHIEVEMENT}`과 같은 뜻)                      |
| `memo_converted_to_todos`                               | 대시보드를 `voice_plan_applied{source=memo}`로 옮긴 뒤 제거                              |
| `subscription_started`                                  | 결제 UI 단계로만 본다. 매출은 RC `purchase`, 자동 `in_app_purchase`는 키 이벤트에서 해제 |
| `todo_edited.field`(콤마 조합, 값 100자를 넘을 수 있다) | 다중 필드면 `multiple` 버킷 또는 첫 필드만                                               |
| `local_day_changed`                                     | Sentry breadcrumb로만 이동 검토                                                          |
| `voice_plan_failed`의 `consent-required`                | 동의 안내로 빠져 보내지 않는다(동의 이탈은 `ai_consent_prompt_dismissed`)                |
