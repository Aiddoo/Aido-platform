// 이벤트 파라미터 source(온 UI)·surface(안내가 뜬 자리)의 값은 여기서만 선언한다. GA 대시보드가 보는 값이라 철자를 바꾸지 않고 더하기만 한다

const ANALYTICS_SOURCES = [
  'ai',
  'auto',
  'app_scheme',
  'code_entry',
  'completion_sheet',
  'feed',
  'feed_card',
  'feed_reentry',
  'install_referrer',
  'invite_welcome',
  'kakao',
  'login',
  'manual',
  'memo',
  'mypage',
  'onboarding',
  'paywall',
  'push_action',
  'quick_text',
  'quick_voice',
  'report_preview',
  'settings',
  'sign_up',
  'suggestions_screen',
  'todo_time',
  'universal_link',
  'voice_note',
] as const;

const ANALYTICS_SURFACES = [
  'add_todo_sheet',
  'app_icon_settings',
  'category_create',
  'friend_request',
  'memo_detail',
  'notification_center',
  'poke_banner',
  'reminder_settings',
  'report_list',
  'report_sample',
  'suggestions',
  'todo_import',
  'todo_nudge',
  'voice_note',
] as const;

// view_tab_changed.view. 기능의 보기 스키마(z.enum) 값이고 ViewTabs는 이 목록 안의 스키마만 받는다
const ANALYTICS_VIEW_TABS = [
  'ALL',
  'NOTICE',
  'SOCIAL',
  'TODO',
  'MONTHLY',
  'WEEKLY',
  'all',
  'waiting',
  'edit',
  'reorder',
  'friends',
  'receiver',
  'sender',
  'received',
  'sent',
  'summary',
  'todos',
  'transcript',
] as const;

type AnalyticsSourceValue = (typeof ANALYTICS_SOURCES)[number];
type AnalyticsSurfaceValue = (typeof ANALYTICS_SURFACES)[number];
export type AnalyticsViewTab = (typeof ANALYTICS_VIEW_TABS)[number];

/** 이벤트의 `source`. 목록 밖 값을 고르면 typecheck가 실패한다(`AnalyticsSource<'settings'>`) */
export type AnalyticsSource<Value extends AnalyticsSourceValue> = Value;
/** 이벤트의 `surface`. 목록 밖 값을 고르면 typecheck가 실패한다 */
export type AnalyticsSurface<Value extends AnalyticsSurfaceValue> = Value;
