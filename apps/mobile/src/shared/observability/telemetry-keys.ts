import type {
  InviteFriendship,
  RedeemOutcome,
  ReplyToNudgeInput,
  UserReportReason,
  UserReportTargetType,
} from '@aido/api';
import type { SessionExpiredReason } from '@src/core/ports/telemetry-event';
import type { InviteLinkSource } from '@src/features/invite/domains/invite-redemption.model';
import type { RedeemFailureReason } from '@src/features/invite/domains/invite.error';

// 관측 키의 단일 원본. Analytics 이벤트·Sentry feature/tag·breadcrumb 카테고리를 여기서만 정의한다.
// 포트(core/ports)는 이 파일의 타입만 import한다.

/** Sentry `feature` 태그 값. snake_case만 쓰고 새 값은 여기에 먼저 추가한다. */
export const SENTRY_FEATURES = [
  'app_icon',
  'app_version',
  'auth',
  'auth_cold_start',
  'draft',
  'error_boundary',
  'invite',
  'lifecycle',
  'subscription',
  'todo_comment',
  'todo_nudge',
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
export type SentryTagKey = (typeof SENTRY_TAGS)[keyof typeof SENTRY_TAGS];

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
] as const;
export type BreadcrumbCategory = (typeof BREADCRUMB_CATEGORIES)[number];

// 새 이벤트는 해당 기능의 `*EventMap`에 먼저 정의한다 → `AppEventMap`으로 합쳐진다.

export type AuthMethod = 'email' | 'google' | 'apple' | 'kakao' | 'naver';
export type SocialProvider = 'google' | 'apple' | 'kakao' | 'naver';

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
  };
  todo_completed: { todo_id: number; is_completed: boolean };
  todo_deleted: { todo_id: number };
  todo_edited: { todo_id: number; field: string };
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
  /** depth 0이 할 일에 바로 달린 댓글 — 대화가 얼마나 깊어지는지 본다. */
  todo_comment_created: { todo_id: number; depth: number };
  todo_comment_deleted: { todo_id: number; depth: number };
  todo_comment_liked: { todo_id: number; is_liked: boolean };
  todo_comment_sorted: { todo_id: number; sort: 'POPULAR' | 'LATEST' };
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
  invite_link_shared: { channel: 'kakao' | 'copy_link' | 'system' };
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
}

/** 프리미엄 안내를 띄운 기능. 대시보드 집계 값이므로 이름을 바꾸지 않는다. */
export type PremiumGateFeature =
  | 'ai_parse'
  | 'ai_report'
  | 'ai_suggestion'
  | 'app_icon'
  | 'friend_limit'
  | 'friend_todo_view'
  | 'nudge_limit'
  | 'reminder_time';

export interface SubscriptionEventMap {
  subscription_started: { product_id: string };
  subscription_restored: undefined;
  premium_gate_shown: { feature: PremiumGateFeature };
}

export interface AiEventMap {
  ai_parse_used: { success: boolean };
  ai_suggestion_acted: { action: 'accept' | 'dismiss' };
  ai_report_viewed: { report_id: number; report_type: string };
  ai_data_sharing_consent_changed: { agreed: boolean };
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
}

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
  memo_converted_to_todos: { memo_id: number; todo_count: number; source: string };
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
  AiEventMap &
  UserEventMap &
  NotificationEventMap &
  BadgeEventMap &
  MemoEventMap;
