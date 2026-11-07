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

interface AiEventMap {
  ai_parse_used: { success: boolean };
  ai_data_sharing_consent_changed: { agreed: boolean };
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
  AiEventMap &
  UserEventMap &
  BadgeEventMap &
  ConnectivityEventMap;
