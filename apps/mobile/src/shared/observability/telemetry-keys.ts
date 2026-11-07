import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { SubscriptionView } from '@src/features/billing/subscription/schemas/subscription-params.schema';
import type { PremiumGateAnalyticsFeature } from '@src/features/billing/subscription/utils/premium-gate-feature';
import type { PurchaseFailedReason } from '@src/features/billing/subscription/utils/purchase-failed-reason';
import type { VoiceCaptureFailureReason } from '@src/features/voice/domains/voice-capture.model';
import type { VoicePlanFailureCause } from '@src/features/voice/domains/voice.error';

// Analytics 이벤트 카탈로그. feature가 아직 `{feature}.events.ts`로 옮기지 않은 이벤트만 남아 있다.

// 새 이벤트는 해당 기능의 `*EventMap`에 먼저 정의한다 → `AppEventMap`으로 합쳐진다.

type TodoCreationEntry = 'manual' | 'recurring';

interface TodoEventMap {
  todo_created: {
    source: 'manual';
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

export const FEATURE_KEYS = [
  'memo_ai',
  'friend_search',
  'todo_reorder',
  'category_reorder',
  'todo_creation',
  'friend_invite',
  'voice_quick',
  'voice_note',
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

export type LocalDateChangeTrigger = 'midnight_timer' | 'foreground' | 'calendar_change';

/** 앱 생명주기 기반 제품 지표. 진단용 날짜 값은 Sentry breadcrumb에만 남긴다. */
interface LifecycleEventMap {
  local_day_changed: {
    trigger: LocalDateChangeTrigger;
  };
}

interface SubscriptionEventMap {
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

interface EntitlementEventMap {
  /** 횟수·개수 한도에 닿아 안내를 띄웠다(premium_gate_shown과 함께 남는다) */
  limit_reached_shown: {
    feature: PremiumGateAnalyticsFeature;
    surface: EntitlementGateSurface;
    trigger: LimitReachedTrigger;
  };
  limit_reached_cta_tapped: {
    feature: PremiumGateAnalyticsFeature;
    surface: EntitlementGateSurface;
  };
}

type VoiceCaptureMode = 'quick' | 'note';
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
  /** 듣는 중에 인식 언어를 바꿨다. `voice_capture_started`의 `locale`은 시작할 때 값 그대로다 */
  voice_capture_locale_changed: {
    mode: VoiceCaptureMode;
    locale: SpeechLocale;
    on_device: boolean;
  };
  /** 말소리는 들리는데 글자 없는 구간만 이어져 인식기를 다시 열었다 */
  voice_recognizer_stalled: { mode: VoiceCaptureMode; on_device: boolean };
  /** Android 기기 인식 언어 모델 받기를 물었다. 거절이면 declined다 */
  voice_offline_model_requested: {
    locale: SpeechLocale;
    result: 'downloaded' | 'scheduled' | 'dialog-opened' | 'unavailable' | 'declined';
  };
  /** 핵심 포인트를 눌러 그 지점부터 들었다. 위치는 구간으로만 남긴다 */
  voice_note_key_point_played: { position_bucket: VoiceDurationBucket };
}

interface AiEventMap {
  ai_parse_used: { success: boolean };
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

interface UserEventMap {
  profile_edited: { field: string };
  settings_changed: { setting: string; value: string };
}

interface BadgeEventMap {
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

/** 연결 상태. 오프라인 배너가 뜨는 전환(오프라인 구간)마다 한 번 */
interface ConnectivityEventMap {
  offline_banner_shown: undefined;
}

/** feature가 아직 `{feature}.events.ts`로 옮기지 않은 이벤트. 옮기는 대로 줄어든다 */
export type LegacyEventMap = TodoEventMap &
  GrowthEventMap &
  LifecycleEventMap &
  SubscriptionEventMap &
  EntitlementEventMap &
  VoiceEventMap &
  AiEventMap &
  VoiceEventMap &
  UserEventMap &
  BadgeEventMap &
  ConnectivityEventMap;
