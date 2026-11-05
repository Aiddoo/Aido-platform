import type { WeatherRescheduleReason } from '@aido/api';
import type {
  InviteFriendship,
  RedeemOutcome,
  ReplyToNudgeInput,
  UserReportReason,
  UserReportTargetType,
  WeatherAlertSeverity,
} from '@aido/api';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { SessionExpiredReason } from '@src/core/ports/telemetry-event';
import type { ReportType } from '@src/features/ai/domains/ai.model';
import type { OAuthProviderSlug } from '@src/features/auth/domains/oauth.model';
import type { CoachmarkKind } from '@src/features/feature-discovery/apis/coachmark.repository';
import type { InviteLinkSource } from '@src/features/invite/domains/invite-redemption.model';
import type { InviteShareChannel } from '@src/features/invite/domains/invite-share.model';
import type { RedeemFailureReason } from '@src/features/invite/domains/invite.error';
import type { TimezoneOffsetBucket } from '@src/features/notification/domains/device-timezone.model';
import type { SubscriptionView } from '@src/features/subscription/hooks/use-subscription-view-param';
import type { PremiumGateAnalyticsFeature } from '@src/features/subscription/utils/analytics/premium-gate-feature';
import type { PurchaseFailedReason } from '@src/features/subscription/utils/analytics/purchase-failed-reason';
import type { SubscriptionStatus } from '@src/features/user/domains/user.model';
import type { VoiceCaptureFailureReason } from '@src/features/voice/domains/voice-capture.model';
import type { VoicePlanFailureCause } from '@src/features/voice/domains/voice.error';
import type {
  WeatherBriefingKind,
  WeatherLocationRegisteredResult,
  WeatherOpenedEntry,
  WeatherReportFailedCause,
} from '@src/features/weather/utils/analytics/weather-analytics';
import type { TodoSuggestionReason } from '@src/features/weather/utils/view-models/weather-briefing.view-model';

// 관측 키의 단일 원본. Analytics 이벤트·Sentry feature/tag·breadcrumb 카테고리를 여기서만 정의한다.
// 포트(core/ports)는 이 파일의 타입만 import한다.

/** Sentry `feature` 태그 값. snake_case만 쓰고 새 값은 여기에 먼저 추가한다. */
export const SENTRY_FEATURES = [
  'app_icon',
  'app_version',
  'auth',
  'auth_cold_start',
  'draft',
  'entitlement',
  'error_boundary',
  'invite',
  'lifecycle',
  'subscription',
  'todo_comment',
  'todo_nudge',
  'voice',
  'weather_location',
  'widget',
] as const;
export type SentryFeature = (typeof SENTRY_FEATURES)[number];

/** Sentry 태그 키. `ErrorReporterContext` 필드명과 같은 이름으로 변환된다. */
export const SENTRY_TAGS = {
  FEATURE: 'feature',
  ERROR_CODE: 'errorCode',
  SERVER_ERROR_CODE: 'serverErrorCode',
  METHOD: 'method',
  ENDPOINT: 'endpoint',
  STATUS_CODE: 'statusCode',
  SOURCE: 'source',
} as const;

/**
 * Sentry breadcrumb 카테고리(벤더 중립).
 *
 * 이벤트/크래시 직전의 행적을 분류해 대시보드에서 필터할 수 있게 한다.
 * 자유 문자열 대신 union으로 고정해 오탈자·미정의 카테고리를 컴파일 타임에 막는다.
 */
export const BREADCRUMB_CATEGORIES = [
  'http',
  'navigation',
  'auth',
  'lifecycle',
  'ui',
  'widget',
  'invite',
  'network',
  'voice',
] as const;
export type BreadcrumbCategory = (typeof BREADCRUMB_CATEGORIES)[number];

/**
 * 개발·프리뷰 빌드의 모든 이벤트(네이티브 자동 수집 포함)에 붙이는 기본 파라미터.
 * GA 데이터 필터 "내부 트래픽"이 `traffic_type = internal`을 수집 시점에 제외한다.
 */
export const INTERNAL_TRAFFIC_EVENT_PARAMETERS = { traffic_type: 'internal' } as const;

/** 프리미엄 출처. `is_premium`은 ADMIN·보상 기간(GRANT)을 포함하므로 유료 전환은 `store`로만 센다 */
export type PremiumSourceProperty = 'store' | 'grant' | 'admin' | 'none';

/** Firebase 사용자 속성. 이름·값은 GA 커스텀 측정기준이므로 바꾸지 않는다 */
export interface UserPropertyMap {
  is_premium: boolean;
  subscription_status: SubscriptionStatus;
  premium_source: PremiumSourceProperty;
}

/** 로그아웃 시 다음 계정에 속성이 남지 않도록 모든 사용자 속성을 지우는 값 */
export const CLEARED_USER_PROPERTIES = {
  is_premium: null,
  subscription_status: null,
  premium_source: null,
} as const satisfies Record<keyof UserPropertyMap, null>;

/**
 * GA 예약 구매 이벤트. 매출 원본은 RevenueCat이 Firebase로 보내는 `purchase`이고,
 * Firebase가 스토어 결제를 자동 수집하는 `in_app_purchase`도 있으므로 앱은 이 이름을 쓰지 않는다.
 */
type GaReservedPurchaseEventName = 'purchase' | 'in_app_purchase' | 'refund';

// 새 이벤트는 해당 기능의 `*EventMap`에 먼저 정의한다 → `AppEventMap`으로 합쳐진다.

export type SocialProvider = OAuthProviderSlug;
export type AuthMethod = 'email' | SocialProvider;

export interface AuthEventMap {
  auth_login: { method: AuthMethod };
  auth_signup: { method: AuthMethod };
  auth_logout: undefined;
  auth_social_linked: { provider: SocialProvider };
  auth_social_unlinked: { provider: SocialProvider };
  auth_account_deleted: undefined;
  /** 비자발적 로그아웃(토큰 만료·거부·재사용 감지). reason별 severity는 Sentry 쪽에서 판정. */
  session_expired: { reason: SessionExpiredReason };
}

export type TodoCreationEntry =
  | 'manual'
  | 'ai_parse'
  | 'recurring'
  | 'memo_single'
  | 'memo_ai_multi'
  | 'ai_suggestion';

export interface TodoEventMap {
  todo_created: {
    source: 'manual' | 'ai';
    creation_entry: TodoCreationEntry;
    is_recurring: boolean;
    has_scheduled_time: boolean;
    is_all_day: boolean;
    visibility: 'PUBLIC' | 'PRIVATE';
    repeat_frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    repeat_end?: 'NEVER' | 'UNTIL' | 'COUNT';
  };
  todo_completed: { todo_id: number; is_completed: boolean };
  todo_deleted: { todo_id: number };
  todo_edited: { todo_id: number; field: string };
  todo_series_edited: { scope: 'THIS_ONLY' | 'THIS_AND_FOLLOWING' | 'ALL' };
  todo_series_deleted: { scope: 'THIS_ONLY' | 'THIS_AND_FOLLOWING' | 'ALL' };
  todo_series_stopped: undefined;
  todo_item_added: { todo_id: number };
  todo_item_completed: { todo_id: number; item_id: number; is_completed: boolean };
  todo_item_updated: { todo_id: number; item_id: number };
  todo_item_deleted: { todo_id: number; item_id: number };
  todo_item_reordered: { todo_id: number };
  category_created: { color: string };
  category_updated: { field: 'name' | 'color' };
  category_deleted: undefined;
}

export interface TodoCommentEventMap {
  /** 댓글·답글 2단계(1.14.1+). chain_size는 한 번에 이어 쓴 글 수다. */
  todo_comment_created: { todo_id: number; is_reply: boolean; chain_size: number };
  todo_comment_deleted: { todo_id: number; is_reply: boolean };
  todo_comment_liked: { todo_id: number; is_liked: boolean; via: 'button' | 'double_tap' };
  todo_comment_sorted: { todo_id: number; sort: 'POPULAR' | 'LATEST' };
  /** 묶음을 펼치거나 더 볼 때. loaded_count는 펼친 뒤 보이는 답글 수다. */
  todo_comment_replies_expanded: { todo_id: number; loaded_count: number };
  todo_comment_reply_started: { todo_id: number; target: 'comment' | 'reply' };
  todo_comment_hint_dismissed: { kind: 'double_tap'; reason: 'close' | 'used' };
}

export interface FriendEventMap {
  friend_request_sent: undefined;
  friend_request_cancelled: undefined;
  friend_request_accepted: undefined;
  friend_request_rejected: undefined;
  friend_removed: undefined;
  friend_reordered: undefined;
}

/** 차단·신고. 상대 사용자 id·신고 상세는 넣지 않는다 */
export interface ModerationEventMap {
  user_blocked: undefined;
  user_unblocked: undefined;
  content_reported: { target_type: UserReportTargetType; reason: UserReportReason };
}

export interface NudgeEventMap {
  nudge_sent: undefined;
  nudge_replied: { reply_kind: ReplyToNudgeInput['replyKind'] };
  nudge_thanks_sent: { recipient_count: number };
  remind_nudge_sent: undefined;
}

export const FEATURE_KEYS = [
  'memo_ai',
  'friend_search',
  'todo_reorder',
  'category_reorder',
  'todo_creation',
  'friend_invite',
  'voice_quick',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
/** 친구 초대로 들어온 곳. 누른 순간 invite_entry_tapped로 남긴다 */
export type InviteEntrySource =
  | 'friends_empty'
  | 'friend_strip_empty'
  | 'friend_limit_dialog'
  | 'mypage_card'
  | 'activation_checklist'
  | 'all_done_banner';
export type FeatureHubSource = 'auto' | 'feed_reentry' | 'mypage';
export type FriendSearchLengthBucket = '2_3' | '4_7' | '8_plus';

export function toFriendSearchLengthBucket(query: string): FriendSearchLengthBucket {
  const length = [...query.trim()].length;
  if (length <= 3) {
    return '2_3';
  }
  if (length <= 7) {
    return '4_7';
  }
  return '8_plus';
}

/**
 * 기능 발견·활성화 지표.
 *
 * 검색어, 메모/Todo 본문, 계정 ID는 payload에 넣지 않는다. 캠페인·기능·저카디널리티
 * 상태만 수집해 기능별 노출 → CTA → 실제 성공 퍼널을 계산한다.
 */
export interface GrowthEventMap {
  feature_hub_impression: {
    campaign_id: string;
    source: FeatureHubSource;
  };
  feature_hub_dismissed: {
    campaign_id: string;
    source: FeatureHubSource;
  };
  feature_card_cta: {
    campaign_id: string;
    feature: FeatureKey;
    source: FeatureHubSource;
  };
  feature_action_success: {
    campaign_id: string;
    feature: FeatureKey;
  };
  todo_reordered: {
    source: 'feed';
  };
  category_reordered: {
    source: 'settings';
  };
  friend_search_submitted: {
    query_length_bucket: FriendSearchLengthBucket;
  };
  friend_strip_hint_dismissed: {
    hint: 'invite' | 'search';
  };
  activation_completed: {
    campaign_id: string;
    days_since_signup: number;
  };
}

/**
 * 친구 초대 퍼널. 사용자 id·초대 코드는 넣지 않는다.
 * 사용 시작과 보상 지급은 서버 로그가 원천이다.
 */
export interface InviteEventMap {
  invite_link_shared: { channel: InviteShareChannel };
  invite_entry_tapped: { entry: InviteEntrySource };
  invite_link_opened: { source: InviteLinkSource };
  invite_redeemed: { outcome: RedeemOutcome; friendship: InviteFriendship | 'NONE' };
  invite_redeem_failed: { reason: RedeemFailureReason };
}

export type LocalDateChangeTrigger = 'midnight_timer' | 'foreground' | 'calendar_change';

/** 앱 생명주기 기반 제품 지표. 진단용 날짜 값은 Sentry breadcrumb에만 남긴다. */
export interface LifecycleEventMap {
  local_day_changed: {
    trigger: LocalDateChangeTrigger;
  };
  /** 시간대 이름·도시는 보내지 않고 바뀐 폭만 보낸다. 여행 빈도와 기기 예약 전환 판단에 쓴다. */
  device_timezone_changed: {
    offset_bucket: TimezoneOffsetBucket;
    notice_shown: boolean;
  };
}

export interface SubscriptionEventMap {
  /**
   * 앱에서 결제가 끝난 순간(UI·퍼널 단계). **매출·전환 집계에 쓰지 않는다** — 매출 원본은 RevenueCat `purchase`다.
   * 대시보드 이력을 지키려고 이름은 유지한다.
   */
  subscription_started: { product_id: string };
  subscription_restored: undefined;
  premium_gate_shown: { feature: PremiumGateAnalyticsFeature; surface: EntitlementGateSurface };
  /** 게이트 다이얼로그에서 구독하기를 눌렀다 */
  premium_gate_cta_tapped: {
    feature: PremiumGateAnalyticsFeature;
    surface: EntitlementGateSurface;
  };
  /** 요금제를 받아 페이월을 보여 줬다. `plans`는 보상 기간 영수증에서 요금제로 넘어온 경우다 */
  paywall_viewed: { view: SubscriptionView };
  /** 문의로 안내한 결제 실패. 직접 취소·승인 대기는 세지 않는다 */
  purchase_failed: { reason: PurchaseFailedReason };
}

/** 한도·프리미엄 안내를 띄운 화면. premium_gate_*·limit_reached_*가 같은 값을 쓴다 */
export type EntitlementGateSurface =
  | 'add_todo_sheet'
  | 'memo_detail'
  | 'category_create'
  | 'friend_request'
  | 'poke_banner'
  | 'todo_nudge'
  | 'suggestions'
  | 'notification_center'
  | 'app_icon_settings'
  | 'reminder_settings'
  | 'report_detail'
  | 'voice_note';

/** precheck: 시작 전에 남은 횟수 0을 보고 막았다 · server: 서버가 한도 오류로 막았다 */
export type LimitReachedTrigger = 'precheck' | 'server';

export interface EntitlementEventMap {
  /** 횟수·개수 한도에 닿아 안내를 띄웠다(premium_gate_shown과 함께 남는다) */
  limit_reached_shown: {
    feature: PremiumGateAnalyticsFeature;
    surface: EntitlementGateSurface;
    trigger: LimitReachedTrigger;
  };
  /** 한도 안내에서 구독하기를 눌렀다 */
  limit_reached_cta_tapped: {
    feature: PremiumGateAnalyticsFeature;
    surface: EntitlementGateSurface;
  };
}

export type VoiceCaptureMode = 'quick' | 'note';
export type VoiceCaptureEntry = 'add_todo_sheet' | 'memo_tab' | 'quick_voice_upgrade';
export type VoiceCaptureOutcome = 'completed' | 'cancelled' | 'empty' | 'upgraded';
export type VoiceDurationBucket = 'lt_30s' | '30s_3m' | '3m_10m' | '10m_30m';

/** 말한 내용·전사 글자는 어떤 이벤트에도 싣지 않는다. 길이는 구간으로만 남긴다 */
export interface VoiceEventMap {
  voice_capture_started: {
    mode: VoiceCaptureMode;
    entry: VoiceCaptureEntry;
    locale: SpeechLocale;
    on_device: boolean;
  };
  voice_capture_finished: {
    mode: VoiceCaptureMode;
    outcome: VoiceCaptureOutcome;
    duration_bucket: VoiceDurationBucket;
    pause_count: number;
  };
  voice_capture_failed: { mode: VoiceCaptureMode; reason: VoiceCaptureFailureReason };
  voice_capture_resumed: {
    mode: VoiceCaptureMode;
    cause: 'app_background' | 'interrupted' | 'user' | 'limit';
  };
  /** Android 기기 인식 언어 모델 받기를 물었다. 거절이면 declined다 */
  voice_offline_model_requested: {
    locale: SpeechLocale;
    result: 'downloaded' | 'scheduled' | 'dialog-opened' | 'unavailable' | 'declined';
  };
  /** 핵심 포인트를 눌러 그 지점부터 들었다. 위치는 구간으로만 남긴다 */
  voice_note_key_point_played: { position_bucket: VoiceDurationBucket };
}

export interface CoachmarkEventMap {
  coachmark_shown: { kind: CoachmarkKind };
  coachmark_dismissed: { kind: CoachmarkKind };
}

export interface AiEventMap {
  ai_parse_used: { success: boolean };
  ai_suggestion_acted: { action: 'accept' | 'dismiss' };
  ai_report_viewed: { report_id: number; report_type: ReportType };
  ai_data_sharing_consent_changed: { agreed: boolean };
}

/** 계획을 만든 흐름. 제목·내용은 이벤트에 싣지 않는다 */
export type VoicePlanAnalyticsSource = 'quick_voice' | 'quick_text' | 'voice_note' | 'memo';

export interface VoiceEventMap {
  voice_plan_generated: {
    source: VoicePlanAnalyticsSource;
    todo_count: number;
    memo_count: number;
    duplicate_count: number;
    /** 서버가 알려 준 차감 여부. 성공해도 false일 수 있고, 메모 나누기 응답에는 없다 */
    charged?: boolean;
  };
  voice_plan_failed: { source: VoicePlanAnalyticsSource; cause: VoicePlanFailureCause };
  voice_plan_applied: {
    source: VoicePlanAnalyticsSource;
    todo_count: number;
    memo_count: number;
    skipped_count: number;
  };
}

export interface UserEventMap {
  profile_edited: { field: string };
  settings_changed: { setting: string; value: string };
}

export interface NotificationEventMap {
  push_notification_opened: {
    type: string;
    action: string;
    campaign_key?: string;
    variant_id?: string;
    purpose?: string;
  };
  notification_center_opened: { type: string; destination: string };
  marketing_push_opted_out: { source: 'push_action' };
  marketing_push_opted_in: { source: 'feed_banner' };
  marketing_push_prompt_dismissed: { source: 'feed_banner' };
  push_permission_prompt_shown: { source: PushPermissionPromptSource; step: string };
  push_permission_prompt_dismissed: { source: PushPermissionPromptSource; step: string };
  push_permission_requested: { source: PushPermissionPromptSource; status: string };
  push_permission_settings_opened: { source: PushPermissionPromptSource };
}

/** 알림 권한 안내가 보인 곳 */
export type PushPermissionPromptSource = 'activation' | 'feed_card' | 'settings';

export interface BadgeEventMap {
  badge_summary_viewed: {
    badge_type: 'perfect' | 'almost' | 'completed';
    completion_rate: number;
    week_label: string;
  };
  badge_item_tapped: {
    badge_type: 'perfect' | 'almost' | 'completed';
    completion_rate: number;
    year: number;
    week: number;
  };
  badge_share_attempted: {
    badge_type: 'perfect' | 'almost' | 'completed';
    year: number;
    week: number;
  };
  badge_empty_cta_tapped: undefined;
  badge_opened_from_notification: undefined;
}

export interface MemoEventMap {
  memo_created: undefined;
  memo_updated: { memo_id: number };
  memo_deleted: { memo_id: number };
  memo_pin_toggled: { memo_id: number; is_pinned: boolean };
  memo_converted_to_todo: { memo_id: number };
  memo_converted_to_todos: { memo_id: number; todo_count: number; source: 'ai' };
}

export interface WeatherEventMap {
  weather_location_permission_result: { result: 'granted' | 'needs_permission' | 'denied' };
  weather_alert_opened: { severity: WeatherAlertSeverity };
  weather_reschedule_opened: { todo_count: number; reason: WeatherRescheduleReason };
  weather_reschedule_applied: { moved_count: number; reason: WeatherRescheduleReason };
  weather_reschedule_undone: { moved_count: number; reason: WeatherRescheduleReason };
  weather_todo_suggestion_opened: { reason: TodoSuggestionReason };
  /** 날씨 화면 진입. 화면이 열릴 때 한 번 */
  weather_opened: { entry: WeatherOpenedEntry };
  /** 브리핑 노출. 화면이 열려 있는 동안 처음 보인 종류로 한 번 */
  weather_briefing_shown: { kind: WeatherBriefingKind };
  /** 화면을 연 뒤 위치 확인이 끝난 결과. 화면이 열려 있는 동안 한 번 */
  weather_location_registered: { result: WeatherLocationRegisteredResult };
  /** 리포트 경계가 실패를 보였다. 실패 화면마다 한 번 */
  weather_report_failed: { cause: WeatherReportFailedCause };
}

/** 연결 상태. 오프라인 배너가 뜨는 전환(오프라인 구간)마다 한 번 */
export interface ConnectivityEventMap {
  offline_banner_shown: undefined;
}

export type AppEventMap = AuthEventMap &
  TodoEventMap &
  TodoCommentEventMap &
  FriendEventMap &
  ModerationEventMap &
  InviteEventMap &
  NudgeEventMap &
  GrowthEventMap &
  LifecycleEventMap &
  SubscriptionEventMap &
  EntitlementEventMap &
  VoiceEventMap &
  CoachmarkEventMap &
  AiEventMap &
  VoiceEventMap &
  UserEventMap &
  NotificationEventMap &
  BadgeEventMap &
  MemoEventMap &
  WeatherEventMap &
  ConnectivityEventMap;

/** 앱 이벤트가 GA 예약 구매 이벤트 이름을 쓰면 여기서 컴파일 오류가 난다 */
export type AssertNoReservedPurchaseEvent<Name extends never> = Name;
export type AppReservedPurchaseEventGuard = AssertNoReservedPurchaseEvent<
  Extract<keyof AppEventMap, GaReservedPurchaseEventName>
>;
