# Aido GA4(Firebase) 측정 계획

**기준**: 앱 1.15.0 · Firebase 프로젝트 `aido-997b5` · 코드 대조 2026-11-06. 실제 수집은 배포 후 DebugView로 검증한다.

**원칙**: 이벤트 이름과 파라미터의 단일 원본은 feature의 `constants/{feature}.events.ts`와 앱 공통 이벤트를 담은 `src/shared/analytics/event-map.ts`(`AppEventMap`)다. 이 문서는 무엇을 보고 어떤 결정을 내리는지와 GA 콘솔 설정값을 적는다. 남기는 규칙은 [observability.md](../.claude/observability.md)를 따른다.

말한 내용·전사·할 일 제목·메모 내용은 어떤 이벤트에도 싣지 않는다.

---

## 1. 이벤트 카탈로그

전송 경로: `track()`·`useTrack().trackEvent()` → `createFirebaseAnalytics` → `logEvent`. 자동 화면 수집은 꺼져 있고(`firebase.json`), `useScreenTracking`이 경로가 바뀔 때마다 `screen_view`를 보낸다.

### 1-1. 사용자 식별·속성 (`bootstrap/hooks/use-sync-user-identity.ts`)

| 항목                  | 값                                       | 비고                                                                 |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| `setUserId`           | 내부 계정 id(`me.id`), 비인증이면 `null` | 이메일은 넣지 않는다                                                 |
| `is_premium`          | `"true"`·`"false"`                       | ADMIN과 보상 기간(GRANT)을 포함한다. 대시보드 연속성 때문에 유지한다 |
| `subscription_status` | `SUBSCRIPTION_STATUS` 값                 | 유지                                                                 |
| `premium_source`      | `store`·`grant`·`admin`·`none`           | 유료 전환은 `store`로 센다                                           |

비인증이면 `Analytics.clearUser()`가 id와 속성을 모두 지운다.

### 1-2. 이벤트 (기능별)

`id` 표기는 숫자 엔터티 id다. 개인정보는 아니지만 고카디널리티라 커스텀 측정기준으로 등록하지 않는다.

**화면**

| 이벤트        | 파라미터                                                         | 의미      |
| ------------- | ---------------------------------------------------------------- | --------- |
| `screen_view` | `screen_name` = `screen_class` = 라우트 템플릿(`/todo/[todoId]`) | 모든 화면 |

**인증 / 세션**

| 이벤트                                        | 파라미터                                                                 | 발생 위치                                | 의미            |
| --------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------- | --------------- |
| `auth_signup`                                 | `method`: `email`·`google`·`apple`·`kakao`·`naver`                       | 이메일 가입, 소셜 신규 가입(`isNewUser`) | 가입            |
| `auth_login`                                  | `method`: 위와 같다                                                      | 이메일 로그인, 소셜 기존 계정            | 로그인          |
| `auth_logout` / `auth_account_deleted`        | –                                                                        | 로그아웃 / 탈퇴                          | 이탈 신호       |
| `auth_social_linked` / `auth_social_unlinked` | `provider`                                                               | 계정 연결 설정                           | 계정 연동       |
| `session_expired`                             | `reason`: `refresh-rejected`·`invalid-refresh-response`·`tokens-missing` | `use-auth-boot`                          | 비자발 로그아웃 |

**할 일 / 카테고리**

| 이벤트                                       | 파라미터                                                                                                                                                                                                                 | 의미                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `todo_created`                               | `source` · `creation_entry` · `is_recurring`·`has_scheduled_time`·`is_all_day`(bool) · `visibility`: `PUBLIC`·`PRIVATE` · 반복이면 `repeat_frequency`: `DAILY`·`WEEKLY`·`MONTHLY`, `repeat_end`: `NEVER`·`UNTIL`·`COUNT` | 할 일 추가 시트에서 만들었을 때                    |
| `todo_completed`                             | `todo_id`(id) · `is_completed`(bool)                                                                                                                                                                                     | 체크 토글(완료·해제 모두)                          |
| `todo_edited`                                | `todo_id`(id) · `field`(키 콤마 결합)                                                                                                                                                                                    | 수정·카테고리 변경                                 |
| `todo_deleted`                               | `todo_id`(id)                                                                                                                                                                                                            | 삭제                                               |
| `todo_series_edited` / `todo_series_deleted` | `scope`: `THIS_ONLY`·`THIS_AND_FOLLOWING`·`ALL`                                                                                                                                                                          | 반복 할 일 범위 수정·삭제                          |
| `todo_series_stopped`                        | –                                                                                                                                                                                                                        | 반복 끝내기                                        |
| `todo_item_added` / `todo_item_reordered`    | `todo_id`(id)                                                                                                                                                                                                            | 하위 할 일 추가·순서 변경                          |
| `todo_item_updated` / `todo_item_deleted`    | `todo_id`·`item_id`(id)                                                                                                                                                                                                  | 하위 할 일 수정·삭제                               |
| `todo_item_completed`                        | `todo_id`·`item_id`(id) · `is_completed`                                                                                                                                                                                 | 하위 할 일 체크                                    |
| `todo_reordered`                             | `source`: `feed`                                                                                                                                                                                                         | 피드 순서 변경                                     |
| `category_created`                           | `color`(hex)                                                                                                                                                                                                             | 카테고리 생성                                      |
| `category_updated`                           | `field`: `name`·`color`                                                                                                                                                                                                  | 카테고리 수정                                      |
| `category_delete_sheet_viewed`               | `todo_count_bucket`: `0`·`1_9`·`10_49`·`50_plus` · `has_series`(bool)                                                                                                                                                    | 할 일·반복이 있는 카테고리의 삭제 시트가 보였을 때 |
| `category_delete_cancelled`                  | `todo_count_bucket`                                                                                                                                                                                                      | 삭제 시트를 지우지 않고 닫았을 때                  |
| `category_deleted`                           | `todo_handling`: `move`·`delete`·`empty` · `todo_count_bucket`                                                                                                                                                           | 카테고리 삭제(옛 서버로 옮긴 것도 `move`)          |
| `category_reordered`                         | `source`: `settings`                                                                                                                                                                                                     | 카테고리 순서 변경                                 |

`todo_created.source`는 `manual`, `creation_entry`는 `manual`·`recurring`이다. 계획 저장은 `todo_created`를 보내지 않고 `voice_plan_applied`를 보낸다. AI 제안 수락은 `ai_suggestion_acted`만 보낸다.

**댓글**

| 이벤트                          | 파라미터                                              | 시점                                               |
| ------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `todo_comment_created`          | `todo_id`(id) · `is_reply` · `chain_size`(int)        | 댓글·답글 게시 성공                                |
| `todo_comment_deleted`          | `todo_id` · `is_reply`                                | 삭제 성공                                          |
| `todo_comment_liked`            | `todo_id` · `is_liked` · `via`: `button`·`double_tap` | 좋아요 요청 성공(이미 좋아요면 더블탭해도 안 보냄) |
| `todo_comment_replies_expanded` | `todo_id` · `loaded_count`(int)                       | 답글 펼침·더 보기로 받은 페이지 도착               |
| `todo_comment_reply_started`    | `todo_id` · `target`: `comment`·`reply`               | "답글 달기"를 누를 때                              |
| `todo_comment_hint_dismissed`   | `kind`: `double_tap` · `reason`: `close`·`used`       | 더블탭 안내를 닫거나 처음 더블탭했을 때            |
| `todo_comment_sorted`           | `todo_id` · `sort`: `POPULAR`·`LATEST`                | 정렬 변경                                          |

**친구 / 재촉 / 신고**

| 이벤트                                                                                           | 파라미터                                       | 의미                    |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------- |
| `friend_request_sent`/`_cancelled`/`_accepted`/`_rejected`, `friend_removed`, `friend_reordered` | –                                              | 친구 그래프             |
| `friend_search_submitted`                                                                        | `query_length_bucket`: `2_3`·`4_7`·`8_plus`    | 검색어는 보내지 않음    |
| `friend_strip_hint_dismissed`                                                                    | `hint`: `invite`·`search`                      |                         |
| `nudge_sent` / `remind_nudge_sent`                                                               | –                                              | 재촉                    |
| `nudge_replied`                                                                                  | `reply_kind`(`ReplyToNudgeInput['replyKind']`) |                         |
| `nudge_thanks_sent`                                                                              | `recipient_count`(int)                         |                         |
| `user_blocked` / `user_unblocked`                                                                | –                                              | 상대 id는 보내지 않음   |
| `content_reported`                                                                               | `target_type` · `reason`(서버 enum)            | 신고 상세는 보내지 않음 |

**친구 초대 (바이럴 루프)**

사용자 id·초대 코드는 보내지 않는다.

| 이벤트                 | 파라미터                                                                                                                   | 시점                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `invite_entry_tapped`  | `entry`: `friends_empty`·`friend_strip_empty`·`friend_limit_dialog`·`mypage_card`·`activation_checklist`·`all_done_banner` | 초대 진입점 탭                                                           |
| `invite_link_shared`   | `channel`(`InviteShareChannel`)                                                                                            | 공유 완료                                                                |
| `invite_link_opened`   | `source`: `universal_link`·`app_scheme`·`kakao`·`install_referrer`·`code_entry`                                            | 링크가 착지한 화면에서 `source+openedAt`당 한 번, 설치 리퍼러, 코드 입력 |
| `invite_redeemed`      | `outcome`(`RedeemOutcome`) · `friendship`(`InviteFriendship`·`NONE`)                                                       | 초대 코드 사용 성공                                                      |
| `invite_redeem_failed` | `reason`: `invalid_code`·`not_found`·`rotated`·`self`·`already_redeemed`·`disabled`·`friend_limit`·`blocked`·`unknown`     | 사용 실패                                                                |

**기능 발견 / 활성화**

| 이벤트                                    | 파라미터                                                                                                                                                     | 의미                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| `feature_hub_impression`                  | `campaign_id` · `source`: `auto`·`feed_reentry`·`mypage`                                                                                                     | 새로운 기능 흐름 열림      |
| `feature_hub_dismissed`                   | 위와 같다                                                                                                                                                    | CTA·완료 없이 화면을 떠남  |
| `feature_card_cta`                        | `campaign_id` · `feature`: `memo_ai`·`friend_search`·`todo_reorder`·`category_reorder`·`todo_creation`·`friend_invite`·`voice_quick`·`voice_note` · `source` | 단계 CTA                   |
| `feature_action_success`                  | `campaign_id` · `feature`                                                                                                                                    | CTA 뒤 실제 성공(귀속)     |
| `whats_new_step_viewed`                   | `release_id` · `step` · `index`(int) · `source`                                                                                                              | 흐름 한 번에 단계당 한 번  |
| `whats_new_completed`                     | `release_id` · `source`                                                                                                                                      | 마지막 단계에서 완료       |
| `whats_new_cta_pressed`                   | `release_id` · `step`                                                                                                                                        | 단계 CTA 누름              |
| `activation_completed`                    | `campaign_id` · `days_since_signup`(int)                                                                                                                     | 활성화 체크리스트 완료     |
| `coachmark_shown` / `coachmark_dismissed` | `kind`(`CoachmarkKind`)                                                                                                                                      | 기능 안내 말풍선 노출·닫기 |

**AI / 메모**

| 이벤트                            | 파라미터                                            | 의미                                                                                 |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ai_parse_used`                   | `success`(bool)                                     | 메모 AI 나누기 결과. 할 일 쪽은 `voice_plan_*`로 본다                                |
| `ai_suggestion_acted`             | `action`: `accept`·`dismiss`                        | AI 제안 처리                                                                         |
| `ai_report_viewed`                | `report_id`(id) · `report_type`: `WEEKLY`·`MONTHLY` | 저장된 리포트 상세                                                                   |
| `ai_data_sharing_consent_changed` | `agreed`(bool)                                      | AI 데이터 제공 동의 변경                                                             |
| `memo_created`                    | –                                                   |                                                                                      |
| `memo_updated` / `memo_deleted`   | `memo_id`(id)                                       |                                                                                      |
| `memo_pin_toggled`                | `memo_id` · `is_pinned`                             |                                                                                      |
| `memo_converted_to_todo`          | `memo_id`                                           | 수동 1건 변환                                                                        |
| `memo_converted_to_todos`         | `memo_id` · `todo_count`(int) · `source`: `ai`      | 메모 AI 검토 저장 때 `voice_plan_applied`와 함께 보낸다. 대시보드를 옮길 때까지 유지 |

**음성**

빠른 말하기(`quick`)와 말로 메모하기(`note`)가 같은 이벤트를 쓰고 `mode`로 구분한다. 받아쓰기(`dictation`)는 보내지 않는다. 길이는 구간(`lt_30s`·`30s_3m`·`3m_10m`·`10m_30m`)으로만 보낸다.

| 이벤트                          | 파라미터                                                                                                                                               | 시점과 의미                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `voice_capture_started`         | `mode` · `entry`: `add_todo_sheet`·`memo_tab`·`quick_voice_upgrade` · `locale` · `on_device`(bool)                                                     | 인식 시작. `on_device`는 아래를 본다                                                                                    |
| `voice_capture_finished`        | `mode` · `outcome`: `completed`·`cancelled`·`empty`·`upgraded` · `duration_bucket` · `pause_count`(int)                                                | 끝내기·취소. `upgraded`는 들은 글자를 말로 메모하기로 넘긴 것                                                           |
| `voice_capture_failed`          | `mode` · `reason`: 인식 오류 코드(`SPEECH_ERROR_CODES`)·`planning-failed`                                                                              | 복구할 수 없는 오류                                                                                                     |
| `voice_capture_resumed`         | `mode` · `cause`: `app_background`·`interrupted`·`user`·`limit`                                                                                        | 멈춘 뒤 이어 듣기                                                                                                       |
| `voice_capture_locale_changed`  | `mode` · `locale` · `on_device`(bool)                                                                                                                  | 듣는 중 인식 언어 변경. `voice_capture_started.locale`은 시작 값 그대로다                                               |
| `voice_recognizer_stalled`      | `mode` · `on_device`(bool)                                                                                                                             | 글자 없이 6초가 지났고 그동안 말소리 크기로 3초 넘게 들려 인식기를 다시 열었을 때. 글자 없이 연달아 멈춰도 30초에 한 번 |
| `voice_offline_model_requested` | `locale` · `result`: `downloaded`·`scheduled`·`dialog-opened`·`unavailable`·`declined`                                                                 | Android 기기 인식 언어 모델 받기                                                                                        |
| `voice_plan_generated`          | `source`: `quick_voice`·`quick_text`·`voice_note`·`memo` · `todo_count`·`memo_count`·`duplicate_count`(int) · `charged`(bool, 메모 나누기에는 없음)    | 계획 도착                                                                                                               |
| `voice_plan_failed`             | `source` · `cause`: `network`·`limit`·`too-long`·`in-progress`·`rejected`·`key-conflict`·`source-memo-missing`·`memo-limit`·`ai-unavailable`·`unknown` | 계획 실패. 동의가 필요해 막힌 경우(`AI_1311`)는 보내지 않는다                                                           |
| `voice_plan_applied`            | `source` · `todo_count`·`memo_count`·`skipped_count`(int)                                                                                              | 저장. 핵심 전환                                                                                                         |
| `voice_note_key_point_played`   | `position_bucket`                                                                                                                                      | 핵심 포인트를 눌러 그 지점부터 들음                                                                                     |

`on_device` 값은 `expo-speech-recognizer.ts`의 `shouldRecognizeOnDevice`가 정한다.

| 플랫폼·모드       | 값                                                 | 이유                                                                                                                      |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| iOS 빠른 말하기   | 항상 `false`                                       | iOS 한국어는 서버 인식이 더 정확하다(2026-11 실기기 비교)                                                                 |
| iOS 말로 메모하기 | 설치된 언어이고 기기 기본 언어와 같으면 `true`     | 끊기지 않게 기기 인식을 우선한다. 확인 안 된 언어를 기기 인식으로 시작하면 SDK가 네트워크로 넘어가 권한 오류(1700)가 난다 |
| Android           | 기기 인식을 지원하고 언어 모델이 설치됐으면 `true` |                                                                                                                           |

**한도·결제 유도 / 구독**

`feature` 값은 `ai_parse`·`cheer_limit`·`nudge_limit`·`friend_limit`·`category_limit`·`ai_report`·`ai_suggestion`·`reminder_time`·`app_icon`·`voice_note`다. 빠른 말하기와 메모 AI는 `ai_parse`, 긴 녹음은 `voice_note`로 센다. `surface`(`EntitlementGateSurface`)는 `add_todo_sheet`·`memo_detail`·`category_create`·`friend_request`·`poke_banner`·`todo_nudge`·`suggestions`·`notification_center`·`app_icon_settings`·`reminder_settings`·`voice_note`다. `presentation`(`UpsellPresentation`)은 `sheet`·`toast`다. 같은 기능을 그날 시트에서 [나중에]로 닫았으면 `toast`다.

| 이벤트                        | 파라미터                                                                                  | 시점과 의미                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `premium_gate_shown`          | `feature` · `surface` · `presentation`                                                    | 한도·프리미엄 안내 시트·토스트(`useEntitlementGate`)                    |
| `premium_gate_cta_tapped`     | `feature` · `surface` · `presentation`                                                    | 그 시트·토스트에서 프리미엄 보기                                        |
| `premium_upsell_dismissed`    | `feature` · `surface`                                                                     | 시트를 [나중에]·밀어 닫기로 닫음. 그날은 토스트로 바뀐다                |
| `limit_reached_shown`         | `feature` · `surface` · `trigger`: `precheck`·`server`                                    | 횟수·개수 한도 안내                                                     |
| `limit_reached_cta_tapped`    | `feature` · `surface`                                                                     | 한도 안내에서 프리미엄 보기                                             |
| `paywall_viewed`              | `view`: `status`·`plans` · `feature?`                                                     | 요금제를 받아 페이월이 보였을 때. 막혀서 들어왔으면 `feature`           |
| `paywall_plan_selected`       | `plan_type`: `annual`·`monthly` · `is_trial`                                              | 고른 요금제를 바꿨을 때. 처음 골라 둔 연간은 세지 않는다                |
| `trial_timeline_viewed`       | `plan_type`                                                                               | 체험 일정을 페이월에서 처음 보였을 때. 요금제를 오가도 페이월마다 한 번 |
| `paywall_benefit_viewed`      | `feature` · `index`: 혜택 칩 번호(1부터)                                                  | 혜택 장을 보였을 때. 처음 장을 포함해 페이월마다 장별로 한 번           |
| `plan_comparison_term_opened` | `feature`                                                                                 | 비교표 이름을 눌러 설명(Popover)을 열었을 때                            |
| `checkout_step_viewed`        | `step`: `status`·`welcome`                                                                | 구독 화면 단계가 보였을 때. `welcome`은 결제 직후 시작 화면             |
| `premium_quickstart_tapped`   | `action`: `voice_note`·`ai_report`·`app_icon`                                             | 시작 화면에서 바로 해 볼 기능을 눌렀을 때                               |
| `purchase_failed`             | `reason`: `network`·`server`·`store_unavailable`·`store_error` · `plan_type` · `is_trial` | 문의로 안내한 결제 실패. 취소·승인 대기는 세지 않는다                   |
| `purchase_cancelled`          | `plan_type` · `is_trial`                                                                  | 스토어 결제 창에서 직접 취소                                            |
| `subscription_started`        | `product_id` · `plan_type` · `is_trial`                                                   | 결제 UI 단계. 매출에 쓰지 않는다                                        |
| `subscription_restored`       | –                                                                                         | 복원                                                                    |

`is_trial`은 스토어가 그 요금제에 무료 체험을 줄 수 있다고 했는지다(결제 전 값). 실제로 체험이 시작됐는지는 서버 `/me`의 `premiumIsTrial`과 RevenueCat `rc_trial_start`가 원천이다.

**업셀 퍼널** — 한 번의 사용자 행동에 이벤트는 한 번이다. 시트 버튼을 여러 번 눌러도 답은 처음 하나로 끝나고, 페이월 조회는 요금제를 받은 뒤 한 번이다.

| 단계              | 이벤트                                                            | 파라미터                                                |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| 1. 막힘           | `limit_reached_shown`(횟수·개수 한도만)                           | `feature` · `surface` · `trigger`                       |
| 2. 안내 노출      | `premium_gate_shown`                                              | `feature` · `surface` · `presentation`(`sheet`·`toast`) |
| 3a. 프리미엄 보기 | `premium_gate_cta_tapped`(+ 한도면 `limit_reached_cta_tapped`)    | `feature` · `surface` · `presentation`                  |
| 3b. 나중에        | `premium_upsell_dismissed`                                        | `feature` · `surface`                                   |
| 4. 페이월         | `paywall_viewed`                                                  | `view` · `feature?`                                     |
| 5. 요금제 바꿈    | `paywall_plan_selected`                                           | `plan_type` · `is_trial`                                |
| 6. 결제           | `subscription_started` / `purchase_cancelled` / `purchase_failed` | `plan_type` · `is_trial`(+ `product_id` / `reason`)     |
| 7. 매출           | RevenueCat `purchase`·`rc_trial_start`                            | RC 정의                                                 |

**알림 / 배지 / 설정 / 생명주기**

| 이벤트                             | 파라미터                                                                                                                                   | 의미                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `push_notification_opened`         | `type`(`NOTIFICATION_TYPE` 31종) · `action` · `app_state`(`cold`·`background`·`foreground`) · `campaign_key?` · `variant_id?` · `purpose?` | 푸시 탭. 탭 하나에 한 번. `cold`는 꺼진 앱을 연 탭, `background`는 뒤에 있던 앱(앞으로 온 지 1초 안 포함)을 연 탭이다 |
| `notification_center_opened`       | `type` · `destination`                                                                                                                     | 알림함 항목 탭                                                                                                        |
| `marketing_push_opted_in`          | `source`: `completion_sheet`                                                                                                               | 마케팅 수신 동의                                                                                                      |
| `marketing_push_prompt_shown`      | `source`: `completion_sheet`                                                                                                               | 첫 할 일 완료 뒤 혜택·소식 시트가 보였을 때                                                                           |
| `marketing_push_prompt_dismissed`  | `source`: `completion_sheet`                                                                                                               | 동의 안내 닫기                                                                                                        |
| `marketing_push_opted_out`         | `source`: `push_action`                                                                                                                    | 푸시 버튼으로 해지                                                                                                    |
| `push_permission_prompt_shown`     | `source`: `onboarding`·`todo_time`·`feed_card`·`settings`·`paywall` · `step`                                                               | 권한 안내가 보였을 때                                                                                                 |
| `push_permission_prompt_dismissed` | `source` · `step`                                                                                                                          | 안내를 닫음(가입 직후 화면은 헤더 닫기·Android 뒤로 가기, 카드는 14일 숨김)                                           |
| `push_permission_requested`        | `source` · `status`: 요청 뒤 `PushPermission.status`                                                                                       | 시스템 권한 창 결과                                                                                                   |
| `push_permission_settings_opened`  | `source`                                                                                                                                   | OS 설정 열기                                                                                                          |
| `badge_summary_viewed`             | `badge_type`: `perfect`·`almost`·`completed` · `completion_rate`(num) · `week_label`(string)                                               | 주간 배지                                                                                                             |
| `badge_item_tapped`                | `badge_type` · `completion_rate` · `year` · `week`                                                                                         |                                                                                                                       |
| `badge_share_attempted`            | `badge_type` · `year` · `week`                                                                                                             |                                                                                                                       |
| `badge_empty_cta_tapped`           | –                                                                                                                                          |                                                                                                                       |
| `badge_opened_from_notification`   | –                                                                                                                                          | `push_notification_opened{type=WEEKLY_ACHIEVEMENT}`와 겹친다                                                          |
| `profile_edited`                   | `field`(키 콤마 결합)                                                                                                                      |                                                                                                                       |
| `settings_changed`                 | `setting`(예 `pushEnabled`·`font_scale`·`language`·`theme`·`voice_storage`) · `value`(문자열)                                              | 설정 변경                                                                                                             |
| `local_day_changed`                | `trigger`: `midnight_timer`·`foreground`·`calendar_change`                                                                                 | 진단성. 제품 지표 가치는 낮다                                                                                         |
| `device_timezone_changed`          | `offset_bucket`: `same`·`under_3h`·`3h_to_8h`·`8h_plus` · `notice_shown`(bool)                                                             | 시간대 변경을 서버에 알린 뒤 한 번. 이름·도시는 보내지 않는다. 다음 버전 판단용: 여행 빈도, 기기 예약 전환의 가치     |
| `offline_banner_shown`             | –                                                                                                                                          | 오프라인 전환마다(`connectOnlineManager`)                                                                             |

**날씨**

| 이벤트                               | 파라미터                                                                                                  | 시점                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `weather_opened`                     | `entry`: `feed_badge`·`notification`·`other`                                                              | 날씨 화면 진입                                  |
| `weather_briefing_shown`             | `kind`: `rainy`·`stormy`·`snowy`·`hot`·`rain_later`·`clear`·`tomorrow_morning`·`dry`·`no_scheduled_todos` | 브리핑이 처음 보였을 때                         |
| `weather_location_registered`        | `result`: `located`·`denied`·`unavailable`                                                                | 화면에서 위치 확인이 처음 끝났을 때             |
| `weather_report_failed`              | `cause`: `no_location`·`provider_unavailable`·`offline`·`other`                                           | 리포트 실패 화면(위치 등록 대기 중 로딩은 제외) |
| `weather_location_permission_result` | `result`: `granted`·`needs_permission`·`denied`                                                           | 위치 권한 요청 결과                             |
| `weather_alert_opened`               | `severity`(`WeatherAlertSeverity`)                                                                        | 기상 특보 열람                                  |
| `weather_reschedule_opened`          | `todo_count`(int) · `reason`(`WeatherRescheduleReason`)                                                   | 브리핑에서 옮기기 시트                          |
| `weather_reschedule_applied`         | `moved_count`(int) · `reason`                                                                             | 옮기기 적용                                     |
| `weather_reschedule_undone`          | `moved_count`(int) · `reason`                                                                             | 실행 취소                                       |
| `weather_todo_suggestion_opened`     | `reason`: `rain_later`·`clear`                                                                            | 날씨 기반 할 일 제안 열기                       |

### 1-3. 점검 결과

| 분류           | 내용                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 개인정보       | 이벤트 파라미터에 이메일·본문·좌표·검색어·초대 코드가 없다. `screen_view`는 라우트 템플릿이라 id가 없다                                                                                                                |
| 고카디널리티   | `todo_id`·`item_id`·`memo_id`·`report_id`(측정기준 등록 금지), `todo_edited.field`·`profile_edited.field`(콤마 조합), `settings_changed.value`, `category_created.color`, `week_label`                                 |
| GA 한도        | 이벤트 이름 40자 이하: 최장 `weather_location_permission_result`(34). 예약 접두사(`firebase_`·`google_`·`ga_`) 충돌 없음. 값 100자 이하: `field` 조합이 이론상 넘을 수 있다                                            |
| 이름 불일치    | 대부분 `object_verb(과거형)`이다. 예외: `todo_completed{is_completed:false}`(해제도 completed), `notification_center_opened`(항목 탭), `ai_parse_used`(현재형), `remind_nudge_sent`                                    |
| 중복 의미      | `subscription_started` ↔ RC `purchase` ↔ 자동 `in_app_purchase`, `badge_opened_from_notification` ↔ `push_notification_opened{type=WEEKLY_ACHIEVEMENT}`, `memo_converted_to_todos` ↔ `voice_plan_applied{source=memo}` |
| 타입 느슨      | `push_notification_opened.type`·`action`, `notification_center_opened.type`, `push_permission_*.step`·`status`가 `string`이다                                                                                          |
| 보내지 않는 값 | `voice_plan_failed`의 `consent-required`                                                                                                                                                                               |

---

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

---

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

---

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

---

## 5. GA 콘솔 설정 스펙

콘솔 상태는 코드로 확인할 수 없다. 콘솔을 바꿀 때 이 값을 기준으로 삼는다.

### (a) 키 이벤트 (6개)

| 이벤트                 | 이유                   |
| ---------------------- | ---------------------- |
| `auth_signup`          | 획득                   |
| `activation_completed` | 활성화 북극성          |
| `invite_link_shared`   | 바이럴 행동            |
| `invite_redeemed`      | 바이럴 성과            |
| `rc_trial_start`       | 수익화 선행            |
| `purchase`             | 매출 (RevenueCat 원본) |

해제: `in_app_purchase`(자동 수집, 기본 키 이벤트로 잡혀 있으면 끈다), `subscription_started`(키 이벤트로 지정하지 않는다).

### (b) 커스텀 측정기준

**사용자 범위 (3 / 25)**

| 사용자 속성           | 표시 이름     |
| --------------------- | ------------- |
| `is_premium`          | 프리미엄 여부 |
| `subscription_status` | 구독 상태     |
| `premium_source`      | 프리미엄 출처 |

**이벤트 범위 (24 / 50)**

| 파라미터         | 표시 이름       | 주로 쓰는 이벤트                                                                                        |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `method`         | 인증 방식       | auth_signup, auth_login                                                                                 |
| `creation_entry` | 할 일 생성 경로 | todo_created                                                                                            |
| `source`         | 유입 출처       | todo_created, feature_hub_*, invite_link_opened 등                                                      |
| `is_completed`   | 완료 여부       | todo_completed                                                                                          |
| `is_recurring`   | 반복 여부       | todo_created                                                                                            |
| `visibility`     | 공개 범위       | todo_created                                                                                            |
| `feature`        | 기능            | premium_gate_shown, feature_card_cta, feature_action_success                                            |
| `campaign_id`    | 캠페인          | feature_hub_*, activation_completed                                                                     |
| `entry`          | 초대 진입점     | invite_entry_tapped                                                                                     |
| `channel`        | 공유 채널       | invite_link_shared                                                                                      |
| `outcome`        | 초대 결과       | invite_redeemed                                                                                         |
| `reason`         | 사유            | invite_redeem_failed, weather_*, session_expired                                                        |
| `success`        | 성공 여부       | ai_parse_used                                                                                           |
| `action`         | 동작            | ai_suggestion_acted, push_notification_opened                                                           |
| `type`           | 알림 유형       | push_notification_opened, notification_center_opened                                                    |
| `campaign_key`   | 푸시 캠페인     | push_notification_opened                                                                                |
| `variant_id`     | 실험 변형       | push_notification_opened                                                                                |
| `purpose`        | 알림 목적       | push_notification_opened                                                                                |
| `app_state`      | 탭할 때 앱 상태 | push_notification_opened                                                                                |
| `setting`        | 설정 항목       | settings_changed                                                                                        |
| `result`         | 권한 결과       | weather_location_permission_result                                                                      |
| `severity`       | 특보 등급       | weather_alert_opened                                                                                    |
| `product_id`     | 상품 ID         | subscription_started (RC `purchase`의 상품 파라미터명은 확인 후 추가)                                   |
| `presentation`   | 안내 모양       | premium_gate_shown, premium_gate_cta_tapped                                                             |
| `plan_type`      | 요금제 종류     | paywall_plan_selected, trial_timeline_viewed, subscription_started, purchase_cancelled, purchase_failed |
| `is_trial`       | 체험 제안 여부  | paywall_plan_selected, subscription_started, purchase_cancelled, purchase_failed                        |

등록하지 않음: `*_id`(엔터티 id), `field`, `value`, `color`, `week_label`, `query_length_bucket`·`hint`·`trigger`(필요하면 추가).

### (c) 커스텀 측정항목 (3)

| 파라미터            | 표시 이름          | 단위 | 용도                  |
| ------------------- | ------------------ | ---- | --------------------- |
| `moved_count`       | 날씨 옮긴 할 일 수 | 표준 | 날씨 옮기기 효과      |
| `todo_count`        | 대상 할 일 수      | 표준 | 옮기기 대상·AI 변환량 |
| `days_since_signup` | 가입 후 경과일     | 표준 | 활성화 소요일 평균    |

### (c-1) 댓글 측정기준·측정항목

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

| 이름             | 조건                                                                              | 용도                    |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------- |
| 프리미엄(스토어) | `premium_source = store`                                                          | 유료 사용자 행동 비교   |
| 활성화 사용자    | `activation_completed` 1회 이상 (멤버십 540일)                                    | 활성 vs 비활성 리텐션   |
| 미활성 신규      | 최근 7일 `first_open` AND NOT `activation_completed`                              | 온보딩 개선 타깃        |
| 게이트 경험 무료 | `premium_gate_shown` ≥2회 (최근 14일) AND `is_premium = false`                    | 페이월 메시지 실험 대상 |
| 이탈 위험 유료   | `rc_cancellation` 또는 `rc_billing_issue` (최근 30일) AND NOT `rc_uncancellation` | 이탈 방지               |
| 휴면 위험        | 지난 30일 활성 AND 최근 7일 `todo_completed` 없음 (시퀀스/제외 조건)              | 윈백 효과 비교          |
| 날씨 사용자      | `weather_opened` 또는 `weather_reschedule_applied` (최근 30일)                    | 날씨 리텐션 영향        |

### (e) 유입경로 탐색

| 퍼널         | 단계                                                                                                                                 | 설정                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 활성화       | 1 `auth_signup` → 2 `todo_created` 또는 `voice_plan_applied` → 3 `todo_completed` (`is_completed = true`) → 4 `activation_completed` | 닫힌 퍼널, 7일 내, 분류 `method`        |
| 초대(공유자) | 1 `invite_entry_tapped` → 2 `invite_link_shared`                                                                                     | 닫힌 퍼널, 분류 `entry`·`channel`       |
| 초대(수신자) | 1 `invite_link_opened` → 2 `auth_signup` 또는 `auth_login` → 3 `invite_redeemed`                                                     | 열린 퍼널, 1일 내, 분류 `source`        |
| 페이월       | 1 `premium_gate_shown` → 2 `premium_gate_cta_tapped` → 3 `paywall_viewed` → 4 `rc_trial_start` 또는 `purchase`                       | 닫힌 퍼널, 1일 내, 분류 `feature`       |
| 날씨 옮기기  | 1 `weather_opened` → 2 `weather_reschedule_opened` → 3 `weather_reschedule_applied`                                                  | 열린 퍼널, 분류 `reason`                |
| 날씨 위치    | 1 `weather_opened` → 2 `weather_location_permission_result` (`result = granted`)                                                     | 닫힌 퍼널                               |
| 기능 발견    | 1 `feature_hub_impression` → 2 `feature_card_cta` → 3 `feature_action_success`                                                       | 닫힌 퍼널, 7일 내, 분류 `feature`       |
| 음성         | 1 `voice_capture_started` → 2 `voice_capture_finished` (`outcome = completed`) → 3 `voice_plan_generated` → 4 `voice_plan_applied`   | 닫힌 퍼널, 1일 내(제안), 분류 `mode`    |
| 결제         | 1 `limit_reached_shown` → 2 `limit_reached_cta_tapped` → 3 `purchase`                                                                | 닫힌 퍼널, 1일 내(제안), 분류 `feature` |

음성·결제 퍼널의 기간 1일은 제안값이고 페이월 퍼널과 맞췄다. 결제 3단계는 RevenueCat `purchase` 원본이다. 음성·한도의 측정기준과 `skipped_count` 측정항목은 배포 후 사용자 확인을 받아 추가한다.

### (f) 보고서 컬렉션 "Aido 핵심 지표": 개요 카드

라이브러리 → 새 컬렉션 → 개요 보고서 1개 + 상세 보고서 링크.

| 순서 | 카드                      | 측정                                                     |
| ---- | ------------------------- | -------------------------------------------------------- |
| 1    | 활성 사용자 (DAU/WAU/MAU) | 기본 사용자 카드                                         |
| 2    | 신규 가입                 | `auth_signup` 이벤트 수, 측정기준 인증 방식              |
| 3    | 활성화 완료               | `activation_completed` 키 이벤트 수 · 신규 대비 비율     |
| 4    | 할 일 완료                | `todo_completed` 이벤트 수(필터 완료 여부 = true)        |
| 5    | 사용자 리텐션             | 기본 리텐션 카드(D1/D7)                                  |
| 6    | AI로 만든 할 일           | `voice_plan_applied` 이벤트 수 · `todo_count`            |
| 7    | 날씨 사용                 | `weather_opened` 사용자 · `weather_reschedule_applied`   |
| 8    | 초대 공유 → 사용          | `invite_link_shared` · `invite_redeemed`                 |
| 9    | 게이트 노출(기능별)       | `premium_gate_shown` × 기능                              |
| 10   | 매출 · 체험 시작          | `purchase` 수익 · `rc_trial_start`                       |
| 11   | 해지·결제 문제            | `rc_cancellation` · `rc_billing_issue` · `rc_expiration` |
| 12   | 앱 버전별 사용자          | 측정기준 앱 버전                                         |

### (g) 데이터 보관

관리 → 데이터 설정 → 데이터 보관: 이벤트 데이터 14개월, "새 활동 시 사용자 데이터 재설정" 켬. 무료 속성 최대치다. 장기 비교가 필요하면 BigQuery 내보내기를 연결한다.

### (h) 개발·내부 트래픽 제외

같은 속성 `aido-997b5`에 운영·개발·프리뷰 스트림을 쓴다(`app.config.ts`의 `GoogleService-Info*.plist`). GA4 데이터 필터는 스트림 단위 제외를 지원하지 않는다.

| 단계 | 방법                                                                                                                                           | 효과                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 코드 | 운영이 아닌 빌드는 JS 이벤트를 console로만 남기고, 네이티브 자동 수집 이벤트에 `traffic_type=internal`을 건다(`markFirebaseTrafficAsInternal`) | 적용됨. 첫 `first_open`은 예외 |
| 콘솔 | 데이터 필터 "내부 트래픽"(값 `internal`)을 테스트 → 활성. 수집 시점에 영구 제외되고 소급은 안 된다                                             | 속성 전체 정리                 |
| 콘솔 | 데이터 필터 "개발자 트래픽" 활성(DebugView `debug_mode` 이벤트 제외)                                                                           | 디버그 세션 제외               |
| 장기 | 개발·프리뷰를 별도 Firebase 프로젝트로 분리                                                                                                    | 가장 깨끗. RC 샌드박스도 격리  |

---

## 6. 열린 항목

대시보드 의존을 확인한 뒤 바꾼다. 이름을 바꾸면 이력이 끊긴다.

| 현재                                         | 제안                                                             |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `todo_completed{is_completed}`               | 유지. GA에선 항상 `is_completed=true` 필터                       |
| `notification_center_opened`                 | `notification_center_item_tapped` (새 이름 병행 뒤 옛 이름 제거) |
| `remind_nudge_sent`                          | `nudge_remind_sent`                                              |
| `badge_opened_from_notification`             | 제거(푸시 오픈 `type`으로 대체)                                  |
| `memo_converted_to_todos`                    | 대시보드를 `voice_plan_applied`로 옮긴 뒤 제거                   |
| `push_notification_opened.type`              | `NotificationType` union                                         |
| `todo_edited.field` / `profile_edited.field` | 다중 필드면 `multiple` 버킷 또는 첫 필드만                       |
| `local_day_changed`                          | Sentry breadcrumb로만 이동 검토                                  |
