# GA 콘솔 설정

GA4 콘솔(키 이벤트, 커스텀 측정기준·측정항목, 잠재고객, 퍼널, 보고서, 보관, 내부 트래픽)을 바꿀 때 읽는다. 무엇을 보고 결정하는지는 [측정 계획](./analytics-measurement-plan.md), 이벤트 이름·파라미터는 코드의 `AppEventMap`이 원본이다.

콘솔 상태는 코드로 확인할 수 없다. 콘솔을 바꿀 때 이 값을 기준으로 삼는다.

## (a) 키 이벤트 (6개)

| 이벤트                 | 이유                   |
| ---------------------- | ---------------------- |
| `auth_signup`          | 획득                   |
| `activation_completed` | 활성화 북극성          |
| `invite_link_shared`   | 바이럴 행동            |
| `invite_redeemed`      | 바이럴 성과            |
| `rc_trial_start`       | 수익화 선행            |
| `purchase`             | 매출 (RevenueCat 원본) |

해제: `in_app_purchase`(자동 수집, 기본 키 이벤트로 잡혀 있으면 끈다), `subscription_started`(키 이벤트로 지정하지 않는다).

## (b) 커스텀 측정기준

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
| `campaign_id`    | 캠페인          | feature_hub_*, feature_card_cta, feature_action_success                                                 |
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

등록하지 않음: `*_id`(엔터티 id), `field`, `value`, `color`, `week_label`, `query_length_bucket`·`hint`·`trigger`·`screen_name`·`view`·`is_renewal`·`category`(필요하면 추가).

## (c) 커스텀 측정항목 (3)

| 파라미터            | 표시 이름          | 단위 | 용도                  |
| ------------------- | ------------------ | ---- | --------------------- |
| `moved_count`       | 날씨 옮긴 할 일 수 | 표준 | 날씨 옮기기 효과      |
| `todo_count`        | 대상 할 일 수      | 표준 | 옮기기 대상·AI 변환량 |
| `days_since_signup` | 가입 후 경과일     | 표준 | 활성화 소요일 평균    |

## (c-1) 댓글 측정기준·측정항목

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

## (d) 잠재고객

| 이름             | 조건                                                                              | 용도                    |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------- |
| 프리미엄(스토어) | `premium_source = store`                                                          | 유료 사용자 행동 비교   |
| 활성화 사용자    | `activation_completed` 1회 이상 (멤버십 540일)                                    | 활성 vs 비활성 리텐션   |
| 미활성 신규      | 최근 7일 `first_open` AND NOT `activation_completed`                              | 온보딩 개선 타깃        |
| 게이트 경험 무료 | `premium_gate_shown` ≥2회 (최근 14일) AND `is_premium = false`                    | 페이월 메시지 실험 대상 |
| 이탈 위험 유료   | `rc_cancellation` 또는 `rc_billing_issue` (최근 30일) AND NOT `rc_uncancellation` | 이탈 방지               |
| 휴면 위험        | 지난 30일 활성 AND 최근 7일 `todo_completed` 없음 (시퀀스/제외 조건)              | 윈백 효과 비교          |
| 날씨 사용자      | `weather_opened` 또는 `weather_reschedule_applied` (최근 30일)                    | 날씨 리텐션 영향        |

## (e) 유입경로 탐색

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

## (f) 보고서 컬렉션 "Aido 핵심 지표": 개요 카드

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

## (g) 데이터 보관

관리 → 데이터 설정 → 데이터 보관: 이벤트 데이터 14개월, "새 활동 시 사용자 데이터 재설정" 켬. 무료 속성 최대치다. 장기 비교가 필요하면 BigQuery 내보내기를 연결한다.

## (h) 개발·내부 트래픽 제외

같은 속성 `aido-997b5`에 운영·개발·프리뷰 스트림을 쓴다(`app.config.ts`의 `GoogleService-Info*.plist`). GA4 데이터 필터는 스트림 단위 제외를 지원하지 않는다.

| 단계 | 방법                                                                                                                                           | 효과                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 코드 | 운영이 아닌 빌드는 JS 이벤트를 console로만 남기고, 네이티브 자동 수집 이벤트에 `traffic_type=internal`을 건다(`markFirebaseTrafficAsInternal`) | 적용됨. 첫 `first_open`은 예외 |
| 콘솔 | 데이터 필터 "내부 트래픽"(값 `internal`)을 테스트 → 활성. 수집 시점에 영구 제외되고 소급은 안 된다                                             | 속성 전체 정리                 |
| 콘솔 | 데이터 필터 "개발자 트래픽" 활성(DebugView `debug_mode` 이벤트 제외)                                                                           | 디버그 세션 제외               |
| 장기 | 개발·프리뷰를 별도 Firebase 프로젝트로 분리                                                                                                    | 가장 깨끗. RC 샌드박스도 격리  |
