# Aido GA4(Firebase) 측정 계획

**기준**: 앱 1.14.0 · Firebase 프로젝트 `aido-997b5` · 작성 2026-11-03
**원칙**: 이벤트 정의의 단일 원본은 `src/shared/observability/telemetry-keys.ts`(`AppEventMap`). 이 문서는 "무엇을 보고 어떤 결정을 내리나"와 GA 콘솔 설정값을 정리한다. 규칙은 `.claude/observability.md`를 따른다.

---

## 0. 요약 — 바로 고칠 것

| 우선 | 항목                                                                                                | 왜                                                                          |
| ---- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| P0   | `screen_view.screen_name`이 실제 경로(`/invite/ABC123`, `/users/{id}/report`, `/todo/123`)          | 초대 코드·사용자 id 유출 + 화면 수 폭증(GA `(other)` 행). 라우트 템플릿으로 |
| P0   | 개발·프리뷰 트래픽이 운영 속성 `aido-997b5`에 섞임                                                  | 모든 지표 오염. §5-h                                                        |
| P0   | 구매 이벤트가 3중(`subscription_started` + RevenueCat `purchase` + Firebase 자동 `in_app_purchase`) | 매출·전환 이중 집계. RevenueCat `purchase`만 원본으로                       |
| P1   | 소셜 가입이 `auth_signup`이 아닌 `auth_login`으로만 남음 → 1.14.1 반영(§6)                          | 가입·활성화 퍼널 분모 왜곡                                                  |
| P1   | 페이월 퍼널 중간 단계 없음(게이트 → 구독하기 탭 → 구독 화면 → 결제 시도/실패)                       | 게이트별 전환율 계산 불가                                                   |
| P1   | `is_premium`에 ADMIN·초대 보상(GRANT) 포함, `subscription_status`는 FREE                            | 유료 전환율 왜곡. `premium_source` 추가                                     |

---

## 1. 현재 이벤트 인벤토리

전송 경로: `track()` / `useTrack().trackEvent()` → `createFirebaseAnalytics` → `logEvent`. 자동 화면 수집은 꺼져 있고(`firebase.json`), `useScreenTracking`이 경로 변경마다 `screen_view`를 보낸다.

### 1-1. 사용자 식별·속성 (`bootstrap/hooks/use-user-identity.ts`)

| 항목                  | 값                                          | 비고                                               |
| --------------------- | ------------------------------------------- | -------------------------------------------------- |
| `setUserId`           | 내부 계정 id(`me.id`), 로그아웃 시 `null`   | PII 아님(내부 id) → 허용. 이메일 금지 유지         |
| `is_premium`          | `"true"`/`"false"` (문자열)                 | ADMIN·GRANT(초대 보상) 포함 ⚠                      |
| `subscription_status` | `FREE` / `ACTIVE` / `EXPIRED` / `CANCELLED` | 로그아웃 시 초기화 안 됨 → 다음 계정에 잔존 가능 ⚠ |

### 1-2. 이벤트 (기능별)

`id` 표기 = 숫자 엔터티 id(PII는 아니나 고카디널리티 → **커스텀 측정기준 등록 금지**).

**인증 / 세션**

| 이벤트                                        | 파라미터                                                                       | 발생 위치                                          | 의미                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------- |
| `auth_signup`                                 | `method`: `email`·`google`·`apple`·`kakao`·`naver`                             | 이메일 가입 / 소셜 신규 가입(`isNewUser`, 1.14.1~) | 가입                                   |
| `auth_login`                                  | `method`: `email`·`google`·`apple`·`kakao`·`naver` 등(`OAuthProviderSlug`)     | 이메일 로그인 / 소셜 기존 계정                     | 로그인(1.14.0 이하는 소셜 가입 포함 ⚠) |
| `auth_logout` / `auth_account_deleted`        | –                                                                              | 로그아웃 / 탈퇴                                    | 이탈 신호                              |
| `auth_social_linked` / `auth_social_unlinked` | `provider`                                                                     | 계정 연결 설정                                     | 계정 연동                              |
| `session_expired`                             | `reason`: `no-refresh-token`·`refresh-rejected-401`·`invalid-refresh-response` | `auth-provider`                                    | 비자발 로그아웃                        |

**할 일 / 카테고리**

| 이벤트                                                            | 파라미터                                                                                                                                                                                                              | 발생 위치            | 의미                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| `todo_created`                                                    | `source`: `manual`·`ai` · `creation_entry`: `manual`·`ai_parse`·`recurring`·`memo_single`·`memo_ai_multi`·`ai_suggestion` · `is_recurring`·`has_scheduled_time`·`is_all_day`(bool) · `visibility`: `PUBLIC`·`PRIVATE` | 할 일 생성/반복 생성 | 핵심 행동(생성)             |
| `todo_completed`                                                  | `todo_id`(id) · `is_completed`(bool)                                                                                                                                                                                  | 체크 토글            | 핵심 행동(완료/해제) ⚠ 이름 |
| `todo_edited`                                                     | `todo_id`(id) · `field`(키 콤마 결합 문자열)                                                                                                                                                                          | 수정·카테고리 변경   | 수정                        |
| `todo_deleted`                                                    | `todo_id`(id)                                                                                                                                                                                                         | 삭제                 |                             |
| `todo_item_added`/`_completed`/`_updated`/`_deleted`/`_reordered` | `todo_id`·`item_id`(id) · `is_completed`                                                                                                                                                                              | 하위 할 일           | 세부 기능 사용              |
| `todo_reordered`                                                  | `source`: `feed`                                                                                                                                                                                                      | 피드 순서 변경       |                             |
| `category_created`                                                | `color`(hex)                                                                                                                                                                                                          | 카테고리 생성        |                             |
| `category_updated`                                                | `field`: `name`·`color`                                                                                                                                                                                               |                      |                             |
| `category_deleted`                                                | –                                                                                                                                                                                                                     |                      |                             |
| `category_reordered`                                              | `source`: `settings`                                                                                                                                                                                                  |                      |                             |

**댓글 / 친구 / 재촉 / 신고**

| 이벤트                                                                                           | 파라미터                                              | 의미                                   |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------- |
| `todo_comment_created`                                                                           | `todo_id`(id) · `is_reply` · `chain_size`(int)        | 댓글·답글 2단계(1.14.1+, `depth` 제거) |
| `todo_comment_deleted`                                                                           | `todo_id` · `is_reply`                                |                                        |
| `todo_comment_liked`                                                                             | `todo_id` · `is_liked` · `via`: `button`·`double_tap` | 더블탭 하트 비중                       |
| `todo_comment_replies_expanded`                                                                  | `todo_id` · `loaded_count`(int)                       | 답글 펼침·더 보기                      |
| `todo_comment_reply_started`                                                                     | `todo_id` · `target`: `comment`·`reply`               | 답글 달기 진입                         |
| `todo_comment_hint_dismissed`                                                                    | `kind`: `double_tap` · `reason`: `close`·`used`       | 더블탭 안내 종료                       |
| `todo_comment_sorted`                                                                            | `todo_id` · `sort`: `POPULAR`·`LATEST`                |                                        |
| `friend_request_sent`/`_cancelled`/`_accepted`/`_rejected`, `friend_removed`, `friend_reordered` | –                                                     | 친구 그래프                            |
| `friend_search_submitted`                                                                        | `query_length_bucket`: `2_3`·`4_7`·`8_plus`           | 검색어 미전송(좋음)                    |
| `friend_strip_hint_dismissed`                                                                    | `hint`: `invite`·`search`                             |                                        |
| `nudge_sent` / `remind_nudge_sent`                                                               | –                                                     | 재촉                                   |
| `nudge_replied`                                                                                  | `reply_kind`(`ReplyToNudgeInput['replyKind']`)        |                                        |
| `nudge_thanks_sent`                                                                              | `recipient_count`(int)                                |                                        |
| `user_blocked` / `user_unblocked`                                                                | –                                                     | 모더레이션                             |
| `content_reported`                                                                               | `target_type` · `reason`(서버 enum)                   |                                        |

**친구 초대 (바이럴 루프)**

| 이벤트                 | 파라미터                                                                                                                   | 발생 위치                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `invite_entry_tapped`  | `entry`: `friends_empty`·`friend_strip_empty`·`friend_limit_dialog`·`mypage_card`·`activation_checklist`·`all_done_banner` | 초대 진입점 탭                   |
| `invite_link_shared`   | `channel`: `kakao`·`copy_link`·`system`                                                                                    | 공유 완료                        |
| `invite_link_opened`   | `source`: `universal_link`·`app_scheme`·`kakao`·…(`InviteLinkSource`)                                                      | 링크로 앱 열림(설치 리퍼러 포함) |
| `invite_redeemed`      | `outcome`(`RedeemOutcome`) · `friendship`(`InviteFriendship`·`NONE`)                                                       | 초대 코드 사용 성공              |
| `invite_redeem_failed` | `reason`: `invalid_code`·`not_found`·`rotated`·`self`·`already_redeemed`·`disabled`…                                       | 사용 실패                        |

**기능 발견 / 활성화**

| 이벤트                   | 파라미터                                                                                                                          | 의미                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `feature_hub_impression` | `campaign_id`(문자열) · `source`: `auto`·`feed_reentry`·`mypage`                                                                  | 기능 소개 허브 노출                        |
| `feature_hub_dismissed`  | 동일                                                                                                                              | 닫음                                       |
| `feature_card_cta`       | `campaign_id` · `feature`: `memo_ai`·`friend_search`·`todo_reorder`·`category_reorder`·`todo_creation`·`friend_invite` · `source` | 카드 CTA                                   |
| `feature_action_success` | `campaign_id` · `feature`                                                                                                         | CTA 후 7일 내 실제 성공(귀속)              |
| `activation_completed`   | `campaign_id` · `days_since_signup`(int)                                                                                          | 활성화 체크리스트 완료(첫 할 일 생성→완료) |

**AI / 메모**

| 이벤트                                       | 파라미터                                                                | 의미                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ai_parse_used`                              | `success`(bool)                                                         | 할 일·메모 AI 파싱(어느 쪽인지 구분 없음 ⚠)                                                                   |
| `ai_suggestion_acted`                        | `action`: `accept`·`dismiss`                                            | AI 제안 처리                                                                                                  |
| `ai_report_viewed`                           | `report_id`(id) · `report_type`(string)                                 | **정의만 있고 호출 없음** ⚠                                                                                   |
| `ai_data_sharing_consent_changed`            | `agreed`(bool)                                                          |                                                                                                               |
| `memo_created`                               | –                                                                       |                                                                                                               |
| `memo_updated`/`_deleted`/`memo_pin_toggled` | `memo_id`(id) · `is_pinned`                                             |                                                                                                               |
| `memo_converted_to_todo`                     | `memo_id`                                                               | 수동 1건 변환                                                                                                 |
| `memo_converted_to_todos`                    | `memo_id` · `todo_count`(int) · `source`: `ai`(string 타입 ⚠)           | AI 다건 변환(1.15.0부터 메모 AI 검토 저장 시 `voice_plan_applied`와 함께 보낸다. 대시보드를 옮길 때까지 유지) |
| `voice_plan_applied`                         | `source` · `todo_count`(int) · `memo_count`(int) · `skipped_count`(int) | 계획 카드 저장(말한 내용·제목은 보내지 않음)                                                                  |
| `voice_capture_started`                      | `mode` · `entry` · `locale` · `on_device`(bool)                         | 인식 시작. `mode`는 `quick`·`note`, `on_device`로 기기 인식 비율을 본다                                       |
| `voice_capture_finished`                     | `mode` · `outcome` · `duration_bucket` · `pause_count`(int)             | 끝내기·취소. `outcome: upgraded`는 90초 제안에서 말로 메모하기로 넘어간 것, 길이는 구간으로만 보낸다          |
| `voice_capture_failed`                       | `mode` · `reason`                                                       | 복구할 수 없는 인식 오류                                                                                      |
| `voice_capture_resumed`                      | `mode` · `cause`: `app_background`·`interrupted`·`user`·`limit`         | 이어 듣기                                                                                                     |
| `voice_offline_model_requested`              | `locale` · `result`                                                     | Android 기기 인식 언어 모델 받기. 거절하면 `declined`                                                         |
| `voice_note_key_point_played`                | `position_bucket`                                                       | 핵심 포인트를 눌러 그 지점부터 듣기                                                                           |

**알림 / 배지 / 설정 / 생명주기**

| 이벤트                                                         | 파라미터                                                                                      | 의미                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `push_notification_opened`                                     | `type`(`NOTIFICATION_TYPE` 31종) · `action` · `campaign_key?` · `variant_id?` · `purpose?`    | 푸시 탭                                                                                         |
| `notification_center_opened`                                   | `type` · `destination`                                                                        | 알림함 항목 탭 ⚠ 이름(“열림”이 아니라 항목 탭)                                                  |
| `marketing_push_opted_in` / `_opted_out` / `_prompt_dismissed` | `source`: `feed_banner`·`push_action`                                                         | 마케팅 수신 동의                                                                                |
| `badge_summary_viewed`                                         | `badge_type`: `perfect`·`almost`·`completed` · `completion_rate`(num) · `week_label`(string)  | 주간 배지                                                                                       |
| `badge_item_tapped` / `badge_share_attempted`                  | `badge_type` · `completion_rate` · `year` · `week`                                            |                                                                                                 |
| `badge_empty_cta_tapped` / `badge_opened_from_notification`    | –                                                                                             | `badge_opened_from_notification`은 `push_notification_opened{type=WEEKLY_ACHIEVEMENT}`와 중복 ⚠ |
| `profile_edited`                                               | `field`(키 콤마 결합)                                                                         |                                                                                                 |
| `settings_changed`                                             | `setting`(예 `pushEnabled`·`weatherMorningEnabled`·`morningReminderHour`) · `value`(문자열화) | 서버 선호 설정 변경                                                                             |
| `local_day_changed`                                            | `trigger`: `midnight_timer`·`foreground`·`calendar_change`                                    | 진단성 — 제품 지표 가치 낮음                                                                    |

**날씨 v2 (1.14.0)**

| 이벤트                               | 파라미터                                                 | 발생 위치                            |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------------ |
| `weather_location_permission_result` | `result`: `granted`·`needs_permission`·`denied`          | 위치 권한 요청 결과                  |
| `weather_alert_opened`               | `severity`(`WeatherAlertSeverity`)                       | 기상 특보 열람                       |
| `weather_reschedule_opened`          | `todo_count`(int) · `reason`(`WeatherRescheduleReason`)  | 브리핑 → “맑은 시간으로 옮기기” 시트 |
| `weather_reschedule_applied`         | `moved_count`(int) · `reason`(`WeatherRescheduleReason`) | 옮기기 적용                          |
| `weather_reschedule_undone`          | `moved_count`(int) · `reason`(`WeatherRescheduleReason`) | 실행 취소                            |
| `weather_todo_suggestion_opened`     | `reason`: `rain_later`·`clear`                           | 날씨 기반 할 일 제안 열기            |

**구독**

| 이벤트                  | 파라미터                                                                                                                   | 의미                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `premium_gate_shown`    | `feature`: `ai_parse`·`ai_report`·`ai_suggestion`·`app_icon`·`category_limit`·`friend_limit`·`nudge_limit`·`reminder_time` | 무료 사용자 게이트 노출                         |
| `subscription_started`  | `product_id`(string)                                                                                                       | 클라 구매 성공 — RevenueCat `purchase`와 중복 ⚠ |
| `subscription_restored` | –                                                                                                                          | 복원                                            |
| `screen_view`           | `screen_name` = `screen_class` = 정규화된 pathname                                                                         | 모든 화면 ⚠ 동적 세그먼트 미치환                |

### 1-3. 점검 결과

| 분류             | 내용                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PII / 민감**   | `screen_view`의 `/invite/[inviteCode]`(초대 코드), `/users/[userId]/*`·`/invite-welcome/[friendId]`(타 사용자 id). 그 외 이벤트 파라미터엔 이메일·본문·좌표 없음(양호)                                                                                                                   |
| **고카디널리티** | `todo_id`·`item_id`·`memo_id`·`report_id`(이벤트 파라미터로 수집은 무해하나 측정기준 등록 금지), `screen_name`(경로 id), `todo_edited.field`/`profile_edited.field`(콤마 조합), `settings_changed.value`(시·분 값), `category_created.color`, `week_label`                               |
| **GA 한도**      | 이벤트명 ≤40자: 최장 `weather_location_permission_result`(34) 통과. 파라미터 ≤25개/이벤트 통과. 값 ≤100자: `field` 조합이 이론상 초과 가능(낮음). 사용자 속성명 ≤24자·값 ≤36자 통과. 예약 접두사(`firebase_`·`google_`·`ga_`) 충돌 없음                                                  |
| **이름 불일치**  | 대부분 `object_verb(과거형)`. 예외: `todo_completed{is_completed:false}`(해제도 completed), `notification_center_opened`(항목 탭), `ai_parse_used`(현재형·대상 불명), `premium_gate_shown`/`subscription_started`(시제는 OK, 결과·시작 혼재), `remind_nudge_sent`(→ `nudge_remind_sent`) |
| **중복 의미**    | `subscription_started` ↔ RC `purchase` ↔ 자동 `in_app_purchase` · `badge_opened_from_notification` ↔ `push_notification_opened{type=WEEKLY_ACHIEVEMENT}` · `memo_converted_to_todo(s)` ↔ `todo_created{creation_entry=memo_*}`                                                           |
| **타입 느슨**    | `memo_converted_to_todos.source: string`, `ai_report_viewed.report_type: string`, `push.type/action: string` → 도메인 union으로                                                                                                                                                          |
| **죽은 정의**    | `ai_report_viewed` 호출부 없음                                                                                                                                                                                                                                                           |

---

## 2. RevenueCat → GA 이벤트 (Firebase 연동)

앱은 `revenuecat-sdk-manager.ts`에서 `Purchases.setFirebaseAppInstanceID()`로 연결한다. RevenueCat이 Measurement Protocol로 아래 이벤트를 보낸다(출처: RevenueCat Firebase 연동 문서, 2026-11 확인).

| RevenueCat 이벤트              | GA 이벤트명              | 비고                                                             |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------- |
| Initial Purchase               | `purchase`               | 신규 결제                                                        |
| Trial Started                  | `rc_trial_start`         |                                                                  |
| Renewal(체험 → 유료 전환 포함) | `purchase`               | **신규와 같은 이름** — 구분 파라미터는 RevenueCat 문서 확인 필요 |
| Non-subscription Purchase      | `purchase`               | 현재 비구독 상품 없음                                            |
| Cancellation(체험 중 포함)     | `rc_cancellation`        | 자동갱신 해제 = 이탈 예고                                        |
| Uncancellation                 | `rc_uncancellation`      | 해제 철회                                                        |
| Expiration                     | `rc_expiration`          | 실제 이탈                                                        |
| Billing Issue                  | `rc_billing_issue`       | 결제 실패                                                        |
| Product Change                 | `rc_product_change`      | 월↔연 변경                                                       |
| Subscription Paused            | `rc_subscription_paused` | Play 전용                                                        |
| Transfer                       | `rc_transfer_event`      | 계정 간 이전(2건 전송)                                           |

- 요청서의 `rc_initial_purchase_event` 같은 이름은 **존재하지 않음**. 이벤트 파라미터 상세(`product_id`·`period_type`·`value`·`currency` 등이 GA에 그대로 가는지)는 **RevenueCat 문서 확인 필요** — DebugView/실시간으로 1회 검증할 것.
- **샌드박스 이벤트도 전송된다**고 문서에 명시 → RC 대시보드에서 샌드박스 제외 옵션 유무 확인. 없으면 GA 탐색에서 `environment`류 파라미터로 제외(파라미터 존재 여부 확인 필요).
- RC 연동엔 스트림별 **Firebase App ID + API secret**을 넣는다. 운영 App ID만 등록돼 있으면 dev/preview 빌드의 app instance id는 매칭되지 않아 누락/오귀속 가능 — 운영만 대상으로 두는 게 맞다.
- 매출 통화(구매 통화 vs USD)·총액/순액 옵션은 RC에서 **USD 순액(수수료·세금 제외)** 권장 — 대시보드 수치를 결정용 매출과 맞춘다.

---

## 3. 서버(apps/api) 비즈니스 이벤트 — GA로 보낼까?

서버는 pino 로그 키(`*-log.events.ts`)와 DB 테이블(Drizzle `Notification.openedAt`, 푸시 전송 상태, 리텐션 실험 variant, 초대·보상)로 남긴다.

| 서버 신호                              | 로그 키 / 원천                                                                                   | 결정                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 푸시 발송·전달·오픈                    | `notification.delivery.push-notification-delivery.*-sent`, `Notification.openedAt`, push receipt | **서버 지표 유지**. 발송 분모는 서버만 정확. GA에는 오픈만(`push_notification_opened`). 오픈율 = 서버 SQL |
| 리텐션·윈백 실험(variant)              | `notification.retention.*`, retention experiment 테이블                                          | **서버 지표**. GA는 `push_notification_opened.variant_id`로 오픈 후 행동만 비교                           |
| 초대 qualified / 보상 지급 / 보상 실패 | `social.invite.qualified`, `social.invite.rewards.granted`, `…reward.apply.failed`               | **서버 지표**(원천·정합성). 앱 루프 퍼널은 GA `invite_redeemed`까지. 보상 지급률은 서버 SQL               |
| 프리미엄 보상 기간(GRANT) 시작·종료    | `billing.premium-grant.recorded/swept`                                                           | 서버 지표 + **사용자 속성 `premium_source`로 GA에 반영**(클라에서 `me.premiumAccess.source`)              |
| RevenueCat 웹훅 처리                   | `billing.subscription.webhook.*`                                                                 | 운영 지표. 비즈니스 이벤트는 RC→GA가 이미 담당                                                            |
| AI 쿼터 소진·생성 실패                 | `access.ai-quota.*`, `ai-assistance.*`                                                           | 서버 지표(비용·품질). GA는 앱 노출 결과(`premium_gate_shown{feature=ai_*}`)만                             |
| 날씨 리포트 생성·프로바이더 실패       | `weather.*`, `weatherkit.*`                                                                      | 서버 지표(Sentry/로그)                                                                                    |

**Measurement Protocol(서버 → GA)은 도입하지 않는다.** 위 신호는 SQL로 더 정확히 계산되고, GA로 보내면 app_instance_id 매핑·중복·세션 왜곡만 생긴다. 예외 후보는 없음.

---

## 4. 의사결정 프레임 — 핵심 질문 → KPI → 소스 → 리포트

| 영역            | 질문                                         | KPI 정의                                                                                                          | GA 소스                                                                                                                            | 리포트                            |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 획득            | 가입이 늘고 있나, 어떤 방식으로?             | 일별 가입 수 · 방식 비율                                                                                          | `auth_signup.method` (1.14.1부터 소셜 포함)                                                                                        | 개요 카드                         |
| 활성화          | 가입자가 가치를 경험하나?                    | 가입 7일 내 `activation_completed` 사용자 / 가입자                                                                | `auth_signup` → `todo_created` → `todo_completed{is_completed=true}` → `activation_completed`                                      | 유입경로(퍼널) 탐색               |
| 리텐션          | 돌아오나?                                    | D1·D7·D30 재방문(첫 방문 코호트), 주간 활성 중 `todo_created` 수행 비율                                           | `first_open`(자동) 코호트 · 반환 기준 `todo_created`                                                                               | 코호트 탐색                       |
| 핵심 사용 빈도  | 얼마나 쓰나?                                 | 활성 사용자당 주간 `todo_completed{is_completed=true}`                                                            | 이벤트 수 / 활성 사용자                                                                                                            | 개요 카드                         |
| 날씨 v2 채택    | 1.14.0 날씨를 쓰고 행동이 바뀌나?            | ① `/weather` 도달 사용자 비율 ② 위치 권한 `granted` 비율 ③ 옮기기 열기→적용 전환율(취소 제외) ④ 날씨 알림 켠 비율 | `screen_view{/weather}`, `weather_location_permission_result`, `weather_reschedule_*`, `settings_changed{setting=weather*Enabled}` | 퍼널 + 자유형식(앱 버전 비교)     |
| AI 채택         | AI가 할 일 생산성을 높이나?                  | `todo_created` 중 `creation_entry ∈ {ai_parse, memo_ai_multi, ai_suggestion}` 비율 · 파싱 성공률 · 제안 수락률    | `todo_created.creation_entry`, `ai_parse_used.success`, `ai_suggestion_acted.action`                                               | 자유형식                          |
| 바이럴 루프     | 초대가 사용자를 데려오나?                    | 진입점별 공유율 · 공유당 링크 오픈 · 오픈당 사용 성공 · 실패 사유                                                 | `invite_entry_tapped.entry` → `invite_link_shared.channel` → `invite_link_opened` → `invite_redeemed`/`_failed.reason`             | 퍼널(열린 퍼널: 공유자≠수신자)    |
| 알림            | 알림이 재방문을 만드나?                      | 유형별 오픈 수 · 오픈 후 같은 세션 `todo_completed` 비율 · 마케팅 동의율 / 해지율 (오픈율 분모는 서버)            | `push_notification_opened.type/campaign_key/variant_id`, `marketing_push_*`                                                        | 자유형식 + 서버 SQL               |
| 수익화 — 게이트 | 어떤 기능이 업그레이드를 가장 많이 유도하나? | 게이트 기능별 노출 → 구독 화면 → 체험/구매 전환율                                                                 | `premium_gate_shown.feature` → `screen_view{/settings/subscription}` → `rc_trial_start`/`purchase`                                 | 퍼널(분류 기준 `feature`)         |
| 수익화 — 매출   | 매출·체험 전환은?                            | 일 매출 · 신규 구매 수 · 체험 시작 수 · 체험→유료 전환                                                            | `purchase`(value), `rc_trial_start`                                                                                                | 개요 카드 + 수익 창출 기본 보고서 |
| 이탈·결제 문제  | 왜 떠나나, 결제 실패 규모는?                 | 주간 `rc_cancellation`·`rc_expiration`·`rc_billing_issue` 사용자 수 · 해지 전 30일 활동량                         | RC 이벤트 + `subscription_status`                                                                                                  | 자유형식 + 위험 잠재고객          |

---

## 5. GA 콘솔 설정 스펙

### (a) 키 이벤트 (6개)

| 이벤트                 | 이유                        |
| ---------------------- | --------------------------- |
| `auth_signup`          | 획득 (1.14.1부터 소셜 포함) |
| `activation_completed` | 활성화 북극성               |
| `invite_link_shared`   | 바이럴 행동                 |
| `invite_redeemed`      | 바이럴 성과                 |
| `rc_trial_start`       | 수익화 선행                 |
| `purchase`             | 매출 (RevenueCat 원본)      |

해제: `in_app_purchase`(자동 수집, 기본 키 이벤트로 잡혀 있으면 끔) · `subscription_started`(키 이벤트로 지정하지 않음).

### (b) 커스텀 측정기준

**사용자 범위 (3 / 25)**

| 사용자 속성           | 표시 이름     | 상태            |
| --------------------- | ------------- | --------------- |
| `is_premium`          | 프리미엄 여부 | 현재 전송 중    |
| `subscription_status` | 구독 상태     | 현재 전송 중    |
| `premium_source`      | 프리미엄 출처 | 1.14.0부터 전송 |

**이벤트 범위 (22 / 50)**

| 파라미터         | 표시 이름       | 주로 쓰는 이벤트                                                      |
| ---------------- | --------------- | --------------------------------------------------------------------- |
| `method`         | 인증 방식       | auth_signup, auth_login                                               |
| `creation_entry` | 할 일 생성 경로 | todo_created                                                          |
| `source`         | 유입 출처       | todo_created, feature_hub_*, invite_link_opened 등                    |
| `is_completed`   | 완료 여부       | todo_completed                                                        |
| `is_recurring`   | 반복 여부       | todo_created                                                          |
| `visibility`     | 공개 범위       | todo_created                                                          |
| `feature`        | 기능            | premium_gate_shown, feature_card_cta, feature_action_success          |
| `campaign_id`    | 캠페인          | feature_hub_*, activation_completed                                   |
| `entry`          | 초대 진입점     | invite_entry_tapped                                                   |
| `channel`        | 공유 채널       | invite_link_shared                                                    |
| `outcome`        | 초대 결과       | invite_redeemed                                                       |
| `reason`         | 사유            | invite_redeem_failed, weather_*, session_expired                      |
| `success`        | 성공 여부       | ai_parse_used                                                         |
| `action`         | 동작            | ai_suggestion_acted, push_notification_opened                         |
| `type`           | 알림 유형       | push_notification_opened, notification_center_opened                  |
| `campaign_key`   | 푸시 캠페인     | push_notification_opened                                              |
| `variant_id`     | 실험 변형       | push_notification_opened                                              |
| `purpose`        | 알림 목적       | push_notification_opened                                              |
| `setting`        | 설정 항목       | settings_changed                                                      |
| `result`         | 권한 결과       | weather_location_permission_result                                    |
| `severity`       | 특보 등급       | weather_alert_opened                                                  |
| `product_id`     | 상품 ID         | subscription_started (RC `purchase`의 상품 파라미터명은 확인 후 추가) |

등록하지 않음: `*_id`(엔터티 id), `field`, `value`, `color`, `week_label`, `query_length_bucket`·`hint`·`trigger`(필요 시 추가).

### (c) 커스텀 측정항목 (3)

| 파라미터            | 표시 이름          | 단위 | 용도                  |
| ------------------- | ------------------ | ---- | --------------------- |
| `moved_count`       | 날씨 옮긴 할 일 수 | 표준 | 날씨 옮기기 효과      |
| `todo_count`        | 대상 할 일 수      | 표준 | 옮기기 대상·AI 변환량 |
| `days_since_signup` | 가입 후 경과일     | 표준 | 활성화 소요일 평균    |

### (c-1) 1.14.1 신규 측정기준/측정항목 (댓글 2단계·더블탭)

이벤트 이름은 그대로 두고 매개변수만 바뀐다. `todo_comment_created`·`_deleted`의 `depth`는 1.14.1부터 보내지 않는다.

| 파라미터       | 범위     | 표시 이름      | 값                            | 이벤트                                     |
| -------------- | -------- | -------------- | ----------------------------- | ------------------------------------------ |
| `is_reply`     | 측정기준 | 답글 여부      | `true`·`false`                | todo_comment_created, todo_comment_deleted |
| `via`          | 측정기준 | 좋아요 방식    | `button`·`double_tap`         | todo_comment_liked                         |
| `is_liked`     | 측정기준 | 좋아요 상태    | `true`·`false`                | todo_comment_liked                         |
| `target`       | 측정기준 | 답글 대상      | `comment`·`reply`             | todo_comment_reply_started                 |
| `kind`         | 측정기준 | 안내 종류      | `double_tap`                  | todo_comment_hint_dismissed                |
| `reason`       | 측정기준 | 사유(기존)     | `close`·`used`                | todo_comment_hint_dismissed                |
| `sort`         | 측정기준 | 댓글 정렬      | `LATEST`·`POPULAR`            | todo_comment_sorted                        |
| `chain_size`   | 측정항목 | 이어 쓴 글 수  | 1~5 (표준)                    | todo_comment_created                       |
| `loaded_count` | 측정항목 | 불러온 답글 수 | 페이지 도착 뒤 실제 수 (표준) | todo_comment_replies_expanded              |

### (d) 잠재고객

| 이름             | 조건                                                                               | 용도                    |
| ---------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| 프리미엄(스토어) | `subscription_status = ACTIVE` (1.14.0+ `premium_source = store`)                  | 유료 사용자 행동 비교   |
| 활성화 사용자    | `activation_completed` 1회 이상 (멤버십 540일)                                     | 활성 vs 비활성 리텐션   |
| 미활성 신규      | 최근 7일 `first_open` AND NOT `activation_completed`                               | 온보딩 개선 타깃        |
| 게이트 경험 무료 | `premium_gate_shown` ≥2회 (최근 14일) AND `is_premium = false`                     | 페이월 메시지 실험 대상 |
| 이탈 위험 유료   | `rc_cancellation` 또는 `rc_billing_issue` (최근 30일) AND NOT `rc_uncancellation`  | 이탈 방지               |
| 휴면 위험        | 지난 30일 활성 AND 최근 7일 `todo_completed` 없음 (시퀀스/제외 조건)               | 윈백 효과 비교          |
| 날씨 사용자      | `screen_view.screen_name = /weather` 또는 `weather_reschedule_applied` (최근 30일) | 날씨 v2 리텐션 영향     |

### (e) 유입경로 탐색 (정확한 단계)

| 퍼널         | 단계                                                                                                                   | 설정                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 활성화       | 1 `auth_signup` → 2 `todo_created` → 3 `todo_completed` (`is_completed = true`) → 4 `activation_completed`             | 닫힌 퍼널, 7일 내, 분류 `method`                |
| 초대(공유자) | 1 `invite_entry_tapped` → 2 `invite_link_shared`                                                                       | 닫힌 퍼널, 분류 `entry`·`channel`               |
| 초대(수신자) | 1 `invite_link_opened` → 2 `auth_signup` 또는 `auth_login` → 3 `invite_redeemed`                                       | 열린 퍼널, 1일 내, 분류 `source`                |
| 페이월       | 1 `premium_gate_shown` → 2 `screen_view` (`screen_name = /settings/subscription`) → 3 `rc_trial_start` 또는 `purchase` | 닫힌 퍼널, 1일 내, 분류 `feature`               |
| 날씨 옮기기  | 1 `screen_view` (`/weather`) → 2 `weather_reschedule_opened` → 3 `weather_reschedule_applied`                          | 열린 퍼널, 분류 `reason`, 필터 앱 버전 ≥ 1.14.0 |
| 날씨 위치    | 1 `screen_view` (`/weather`) → 2 `weather_location_permission_result` (`result = granted`)                             | 닫힌 퍼널                                       |
| 기능 발견    | 1 `feature_hub_impression` → 2 `feature_card_cta` → 3 `feature_action_success`                                         | 닫힌 퍼널, 7일 내, 분류 `feature`               |

(1.14.0부터 페이월 퍼널 2단계는 `premium_gate_cta_tapped` → `paywall_viewed`로 본다. 이전 버전 비교에만 `screen_view`를 쓴다.)

### (f) 보고서 컬렉션 "Aido 핵심 지표" — 개요 카드

라이브러리 → 새 컬렉션 → 개요 보고서 1개 + 상세 보고서 링크.

| 순서 | 카드                      | 측정                                                         |
| ---- | ------------------------- | ------------------------------------------------------------ |
| 1    | 활성 사용자 (DAU/WAU/MAU) | 기본 사용자 카드                                             |
| 2    | 신규 가입                 | `auth_signup` 이벤트 수, 측정기준 인증 방식                  |
| 3    | 활성화 완료               | `activation_completed` 키 이벤트 수 · 신규 대비 비율         |
| 4    | 할 일 완료                | `todo_completed` 이벤트 수(필터 완료 여부 = true)            |
| 5    | 사용자 리텐션             | 기본 리텐션 카드(D1/D7)                                      |
| 6    | AI 생성 비율              | `todo_created` × 할 일 생성 경로                             |
| 7    | 날씨 사용                 | `screen_view` /weather 사용자 · `weather_reschedule_applied` |
| 8    | 초대 공유 → 사용          | `invite_link_shared` · `invite_redeemed`                     |
| 9    | 게이트 노출(기능별)       | `premium_gate_shown` × 기능                                  |
| 10   | 매출 · 체험 시작          | `purchase` 수익 · `rc_trial_start`                           |
| 11   | 해지·결제 문제            | `rc_cancellation` · `rc_billing_issue` · `rc_expiration`     |
| 12   | 앱 버전별 사용자          | 측정기준 앱 버전 (1.14.0 채택률)                             |

### (g) 데이터 보관

관리 → 데이터 설정 → 데이터 보관: **이벤트 데이터 14개월**, "새 활동 시 사용자 데이터 재설정" 켬. (무료 속성 최대치. 장기 비교가 필요하면 BigQuery 내보내기 연결 권장 — 일일 내보내기 무료 한도 내)

### (h) 개발·내부 트래픽 제외

현황: 같은 속성 `aido-997b5`에 운영(`com.aido.mobile`)·개발(`com.aido.mobile.dev`) 스트림이 공존, 프리뷰(`.preview`)용 `GoogleService-Info.preview.plist`도 참조된다(로컬 파일 없음 — 스트림 존재 여부 확인 필요). GA4 데이터 필터는 **스트림 단위 제외를 지원하지 않는다**.

| 단계 | 방법                                                                                                                                                                  | 효과                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 즉시 | 컬렉션·탐색에 비교/필터 "**스트림 이름 = Aido (iOS/Android 운영)**" 고정. 잠재고객·키 이벤트 수치는 오염됨을 감안                                                     | 보고서만 정리                 |
| 즉시 | 데이터 필터 "**개발자 트래픽**" 활성(DebugView `debug_mode` 이벤트 제외)                                                                                              | 디버그 세션 제외              |
| 권장 | dev/preview 빌드에서 `setDefaultEventParameters({ traffic_type: 'internal' })` 후 데이터 필터 "**내부 트래픽**"(값 `internal`)을 테스트 → 활성. 수집 시점에 영구 제외 | 속성 전체 정리(소급 불가)     |
| 장기 | 개발·프리뷰를 **별도 Firebase 프로젝트**로 분리                                                                                                                       | 가장 깨끗. RC 샌드박스도 격리 |

---

## 6. 코드 후속 작업

### 1.14.0에 반영함

| 항목                           | 반영                                                                                                                                                               | 비고                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 `screen_view` 라우트 템플릿 | `toScreenName(useSegments())`(`shared/utils/screen-name.ts`)                                                                                                       | 그룹·`index` 제거, Sentry breadcrumb도 템플릿. **GA의 기존 `screen_name` 값(실제 경로)과 이어지지 않는다** — 1.14.0 이후는 템플릿 기준으로 본다                  |
| P0 dev/preview 트래픽          | 비운영 빌드는 JS 이벤트가 원래 console 어댑터(Firebase 미전송). 네이티브 자동 수집 이벤트에 `traffic_type=internal` 기본 파라미터(`markFirebaseTrafficAsInternal`) | GA 데이터 필터 "내부 트래픽" 테스트 → 활성은 콘솔 작업. 첫 실행 `first_open`은 JS 전이라 미표시                                                                  |
| P0 구매 단일 원본              | `subscription_started` 이름 유지(대시보드 이력), 카탈로그에 "UI 퍼널 단계, 매출 아님" 명시. 예약 이름(`purchase`·`in_app_purchase`·`refund`) 사용 시 컴파일 오류   | 매출 = RC `purchase`. 자동 `in_app_purchase`는 iOS에서 끌 수 없어 키 이벤트 해제만                                                                               |
| P1 사용자 속성                 | `premium_source`(`store`·`grant`·`admin`·`none`, 소문자) 추가, `is_premium`·`subscription_status` 유지. 비인증이면 `Analytics.clearUser()`로 id·속성 null          | §5-d 잠재고객 조건은 `premium_source = store`(소문자)                                                                                                            |
| P1 페이월 퍼널                 | `premium_gate_cta_tapped{feature}` · `paywall_viewed{view}` · `purchase_failed{reason}`                                                                            | `paywall_viewed`에 진입 `source`는 없다(구독 화면 경로가 7곳이라 범위 밖). 게이트별 전환은 `premium_gate_cta_tapped.feature` → `paywall_viewed` 닫힌 퍼널로 본다 |
| P1 `ai_report_viewed`          | 이미 `/reports/[id]` 상세에서 전송 중이었다(점검 오류). `report_type`을 `WEEKLY`·`MONTHLY`로 좁힘                                                                  |                                                                                                                                                                  |
| P1 Apple 로그인                | iOS 네이티브 Apple 로그인이 `auth_login`을 보내지 않던 누락을 채움(`method: apple`)                                                                                |                                                                                                                                                                  |
| P1 날씨·오프라인               | `weather_opened{entry}` · `weather_briefing_shown{kind}` · `weather_location_registered{result}` · `weather_report_failed{cause}` · `offline_banner_shown`         | 값·시점은 `.claude/observability.md` 표. `entry`는 `/weather?entry=`(피드 배지·알림), 없으면 `other`                                                             |

### 1.14.1에 반영함

- **소셜 가입 `auth_signup`**: 서버가 `POST v1/auth/exchange`·소셜 네이티브 콜백(Apple·Google·Kakao·Naver) 응답(`authTokensSchema`)에 `isNewUser`(optional boolean)를 싣는다. 이번 요청에서 사용자를 새로 만들었을 때만 true이고, 기존 계정·이메일 자동 연결·탈퇴 유예 복구는 false다. 앱은 성공 한 번에 `isNewUser`면 `auth_signup{method}`, 아니면 `auth_login{method}` 하나만 보낸다. 구 앱은 필드를 버려 계속 `auth_login`만 보내므로, 가입 추이는 앱 버전 1.14.1 이상에서 본다.
- **`paywall_viewed` 점검**: 이미 `app/(app)/settings/subscription.tsx`의 `Paywall`이 요금제를 받은 뒤 마운트·`view`당 한 번 보내고 있었다(점검 오류). 코드 변경 없음.

### 남은 앱 작업

| 항목                              | 메모                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `premium_gate_shown` 날씨 feature | 날씨 프리미엄 기능이 생기면 `PremiumFeature`에 추가          |
| `paywall_viewed.source`           | 필요하면 `subscriptionHref({ source })`로 진입 경로를 싣는다 |

### P2 — 이름·타입 정리 (대시보드 의존 확인 후)

| 현재                                         | 제안                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `todo_completed{is_completed}`               | 유지하되 GA에선 항상 `is_completed=true` 필터 (이름 변경 시 이력 단절) |
| `ai_parse_used{success}`                     | `target`: `todo`·`memo` 파라미터 추가                                  |
| `notification_center_opened`                 | `notification_center_item_tapped` (신규 이름 병행 후 구 이름 제거)     |
| `remind_nudge_sent`                          | `nudge_remind_sent`                                                    |
| `badge_opened_from_notification`             | 제거(푸시 오픈 `type`으로 대체)                                        |
| `memo_converted_to_todos.source: string`     | `'ai'` 리터럴 union                                                    |
| `push_notification_opened.type: string`      | `NotificationType` union                                               |
| `todo_edited.field` / `profile_edited.field` | 다중 필드 시 `multiple` 버킷 or 첫 필드만                              |
| `local_day_changed`                          | Sentry breadcrumb로만 이동 검토(제품 결정에 미사용)                    |
