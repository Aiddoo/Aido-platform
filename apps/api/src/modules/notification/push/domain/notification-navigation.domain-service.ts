import {
  NOTICE_DEEP_LINK_PATH,
  NOTIFICATION_ACTION_TYPE,
  type NOTIFICATION_ACTIVITY_KIND,
  NOTIFICATION_NAVIGATION_KIND,
  type NotificationActionType,
  WEATHER_RESCHEDULE_DEEP_LINK,
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
  WEATHER_RESCHEDULE_REASONS,
  type WeatherRescheduleReason,
} from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { NotificationType } from "../../inbox/domain/notification-type.constants.js";

type NavigationKinds = typeof NOTIFICATION_NAVIGATION_KIND;
type NotificationNavigationKind = NavigationKinds[keyof NavigationKinds];
type NotificationActivityKind =
  (typeof NOTIFICATION_ACTIVITY_KIND)[keyof typeof NOTIFICATION_ACTIVITY_KIND];
type ExternalUrlPresentation =
  | typeof NOTIFICATION_ACTION_TYPE.BROWSER
  | typeof NOTIFICATION_ACTION_TYPE.WEBVIEW;

/** metadata에서 꺼낸 이동 재료. 계약 모양 검증은 매퍼가 먼저 한다. */
interface NotificationRoutingInput {
  readonly commentId?: string;
  readonly threadRootId?: string;
  readonly activityKind?: NotificationActivityKind;
  readonly todoOwnerId?: string;
  readonly todoDate?: string;
}

export interface NotificationNavigationSource {
  readonly type: NotificationType;
  readonly action?: { readonly type: NotificationActionType; readonly url?: string };
  readonly todoId?: number | null;
  readonly friendId?: string | null;
  readonly nudgeId?: number | null;
  readonly cheerId?: number | null;
  readonly routing?: NotificationRoutingInput;
}

interface TodoDestination {
  readonly todoId: number;
  readonly todoOwnerId?: string;
  readonly todoDate?: string;
}

type ScreenKind = Exclude<
  NotificationNavigationKind,
  NavigationKinds[
    | "EXTERNAL_URL"
    | "FRIEND_FEED"
    | "TODO"
    | "TODO_COMMENT"
    | "NUDGE"
    | "CHEER"
    | "WEATHER_RESCHEDULE"]
>;

/** 알림을 눌렀을 때 열 곳. 앱 계약(navigation)으로 검증·변환하는 일은 매퍼가 한다. */
export type NotificationDestination =
  | { readonly kind: ScreenKind }
  | {
      readonly kind: NavigationKinds["EXTERNAL_URL"];
      readonly url: string;
      readonly presentation: ExternalUrlPresentation;
    }
  | { readonly kind: NavigationKinds["FRIEND_FEED"]; readonly friendId: string }
  | (TodoDestination & { readonly kind: NavigationKinds["TODO"] })
  | (TodoDestination & {
      readonly kind: NavigationKinds["TODO_COMMENT"];
      readonly commentId: string;
      readonly threadCommentId: string;
      readonly activityKind: NotificationActivityKind;
    })
  | { readonly kind: NavigationKinds["NUDGE"]; readonly nudgeId: number }
  | { readonly kind: NavigationKinds["CHEER"]; readonly cheerId: number; readonly friendId: string }
  | {
      readonly kind: NavigationKinds["WEATHER_RESCHEDULE"];
      readonly todoIds: readonly number[];
      readonly reason: WeatherRescheduleReason;
    };

type NotificationDestinationOf<Kind extends NotificationNavigationKind> = Extract<
  NotificationDestination,
  { readonly kind: Kind }
>;

const RELATIVE_URL_BASE = "aido://app";
const HTTP_URL_PATTERN = /^https?:\/\//;

function screen<const Kind extends ScreenKind>(kind: Kind) {
  return { kind };
}

function externalUrlNavigation(
  source: NotificationNavigationSource,
): NotificationDestinationOf<"EXTERNAL_URL"> | null {
  const action = source.action;
  if (action == null || action.url == null) {
    return null;
  }
  if (
    action.type !== NOTIFICATION_ACTION_TYPE.BROWSER &&
    action.type !== NOTIFICATION_ACTION_TYPE.WEBVIEW
  ) {
    return null;
  }
  if (!HTTP_URL_PATTERN.test(action.url)) {
    return null;
  }
  return {
    kind: NOTIFICATION_NAVIGATION_KIND.EXTERNAL_URL,
    url: action.url,
    presentation: action.type,
  };
}

function todoNavigation(
  source: NotificationNavigationSource,
): NotificationDestinationOf<"TODO"> | null {
  if (source.todoId == null) {
    return null;
  }
  return {
    kind: NOTIFICATION_NAVIGATION_KIND.TODO,
    todoId: source.todoId,
    todoOwnerId: source.routing?.todoOwnerId,
    todoDate: source.routing?.todoDate,
  };
}

function todoCommentNavigation(
  source: NotificationNavigationSource,
): NotificationDestinationOf<"TODO_COMMENT"> | null {
  const todo = todoNavigation(source);
  const routing = source.routing;
  if (
    todo == null ||
    routing?.commentId == null ||
    routing.threadRootId == null ||
    routing.activityKind == null
  ) {
    return null;
  }
  return {
    ...todo,
    kind: NOTIFICATION_NAVIGATION_KIND.TODO_COMMENT,
    commentId: routing.commentId,
    threadCommentId: routing.threadRootId,
    activityKind: routing.activityKind,
  };
}

function nudgeNavigation(
  source: NotificationNavigationSource,
): NotificationDestinationOf<"NUDGE"> | null {
  if (source.nudgeId == null) {
    return null;
  }
  return { kind: NOTIFICATION_NAVIGATION_KIND.NUDGE, nudgeId: source.nudgeId };
}

function cheerNavigation(
  source: NotificationNavigationSource,
): NotificationDestinationOf<"CHEER"> | null {
  if (source.cheerId == null || source.friendId == null) {
    return null;
  }
  return {
    kind: NOTIFICATION_NAVIGATION_KIND.CHEER,
    cheerId: source.cheerId,
    friendId: source.friendId,
  };
}

function friendFeedNavigation(
  source: NotificationNavigationSource,
): NotificationDestinationOf<"FRIEND_FEED"> | null {
  if (source.friendId == null) {
    return null;
  }
  return { kind: NOTIFICATION_NAVIGATION_KIND.FRIEND_FEED, friendId: source.friendId };
}

/** 날씨 알림의 `/weather/reschedule?todoIds=…&reason=…` 링크. reason이 없으면 앱처럼 비를 피한다. */
function weatherRescheduleNavigation(
  source: NotificationNavigationSource,
): NotificationDestinationOf<"WEATHER_RESCHEDULE"> | null {
  const url = source.action?.url;
  if (url == null || !url.startsWith(WEATHER_RESCHEDULE_DEEP_LINK)) {
    return null;
  }
  const parsed = URL.parse(url, RELATIVE_URL_BASE);
  if (parsed?.pathname !== WEATHER_RESCHEDULE_DEEP_LINK) {
    return null;
  }
  const todoIds = (parsed.searchParams.get("todoIds") ?? "").split(",").map(Number);
  const requestedReason = parsed.searchParams.get("reason") ?? "rain";
  const reason = WEATHER_RESCHEDULE_REASONS.find((candidate) => candidate === requestedReason);
  const hasValidTodoIds =
    todoIds.length <= WEATHER_RESCHEDULE_MAX_TODO_IDS &&
    todoIds.every((todoId) => Number.isSafeInteger(todoId) && todoId > 0);
  if (reason == null || !hasValidTodoIds) {
    return null;
  }
  return { kind: NOTIFICATION_NAVIGATION_KIND.WEATHER_RESCHEDULE, todoIds, reason };
}

/** 공지는 종류만으로 갈 곳을 정할 수 없어 서버가 DEEP_LINK url에 고른 앱 경로를 따른다. 모르는 경로는 이동하지 않는다. */
function noticeNavigation(source: NotificationNavigationSource): NotificationDestination {
  return match(source.action?.url)
    .with(NOTICE_DEEP_LINK_PATH.FEED, () => screen(NOTIFICATION_NAVIGATION_KIND.FEED))
    .with(NOTICE_DEEP_LINK_PATH.ACHIEVEMENTS, () =>
      screen(NOTIFICATION_NAVIGATION_KIND.ACHIEVEMENTS),
    )
    .with(NOTICE_DEEP_LINK_PATH.WEATHER, () => screen(NOTIFICATION_NAVIGATION_KIND.WEATHER))
    .with(NOTICE_DEEP_LINK_PATH.FRIENDS, () => screen(NOTIFICATION_NAVIGATION_KIND.FRIENDS))
    .with(NOTICE_DEEP_LINK_PATH.FRIEND_INVITE, () => screen(NOTIFICATION_NAVIGATION_KIND.INVITE))
    .with(NOTICE_DEEP_LINK_PATH.SUBSCRIPTION, () =>
      screen(NOTIFICATION_NAVIGATION_KIND.SUBSCRIPTION),
    )
    .with(NOTICE_DEEP_LINK_PATH.NOTIFICATION_SETTINGS, () =>
      screen(NOTIFICATION_NAVIGATION_KIND.NOTIFICATION_SETTINGS),
    )
    .otherwise(() => screen(NOTIFICATION_NAVIGATION_KIND.NONE));
}

function navigationByType(source: NotificationNavigationSource): NotificationDestination {
  const feed = screen(NOTIFICATION_NAVIGATION_KIND.FEED);
  const none = screen(NOTIFICATION_NAVIGATION_KIND.NONE);
  return match(source.type)
    .with("SYSTEM_NOTICE", "ADMIN_BROADCAST", "ADMIN_TARGETED", () => noticeNavigation(source))
    .with("TODO_SHARED", () => todoCommentNavigation(source) ?? todoNavigation(source) ?? none)
    .with(
      "NUDGE_RECEIVED",
      () =>
        (source.todoId == null ? null : nudgeNavigation(source)) ??
        todoNavigation(source) ??
        friendFeedNavigation(source) ??
        feed,
    )
    .with(
      "NUDGE_REPLIED",
      "NUDGE_THANKED",
      () => nudgeNavigation(source) ?? screen(NOTIFICATION_NAVIGATION_KIND.NOTIFICATIONS),
    )
    .with("CHEER_RECEIVED", () => cheerNavigation(source) ?? friendFeedNavigation(source) ?? none)
    .with(
      "FOLLOW_ACCEPTED",
      "FRIEND_COMPLETED",
      "NUDGE_SUGGEST",
      () => friendFeedNavigation(source) ?? none,
    )
    .with("FOLLOW_NEW", () => screen(NOTIFICATION_NAVIGATION_KIND.FRIEND_REQUESTS))
    .with("TODO_REMINDER", () => todoNavigation(source) ?? feed)
    .with(
      "WEATHER_MORNING",
      () => weatherRescheduleNavigation(source) ?? screen(NOTIFICATION_NAVIGATION_KIND.WEATHER),
    )
    .with("WEATHER_EVENING", () => screen(NOTIFICATION_NAVIGATION_KIND.WEATHER))
    .with("WEEKLY_ACHIEVEMENT", () => screen(NOTIFICATION_NAVIGATION_KIND.ACHIEVEMENTS))
    .with("WEEKLY_REPORT", "MONTHLY_REPORT", () => screen(NOTIFICATION_NAVIGATION_KIND.REPORTS))
    .with("AI_SUGGESTION", () => screen(NOTIFICATION_NAVIGATION_KIND.SUGGESTIONS))
    .with("INVITE_JOINED", "INVITE_REWARDED", "INVITE_PROGRESS", () =>
      screen(NOTIFICATION_NAVIGATION_KIND.INVITE),
    )
    .with("PREMIUM_GRANT_ENDING", "PREMIUM_TRIAL_ENDING", "PREMIUM_RENEWAL_UPCOMING", () =>
      screen(NOTIFICATION_NAVIGATION_KIND.SUBSCRIPTION),
    )
    .with(
      "DAILY_COMPLETE",
      "MORNING_REMINDER",
      "EVENING_REMINDER",
      "WINBACK",
      "SOCIAL_DIGEST",
      "LUNCH_NUDGE",
      "STREAK_AT_RISK",
      "INVITE_QUALIFY_REMINDER",
      () => feed,
    )
    .exhaustive();
}

/** 1.14.0 이하 앱이 type·action·context·routing으로 고르던 목적지와 같은 곳을 가리킨다. */
export function resolveNotificationDestination(
  source: NotificationNavigationSource,
): NotificationDestination {
  return match(source.action?.type)
    .with(NOTIFICATION_ACTION_TYPE.NONE, () => screen(NOTIFICATION_NAVIGATION_KIND.NONE))
    .with(
      NOTIFICATION_ACTION_TYPE.BROWSER,
      NOTIFICATION_ACTION_TYPE.WEBVIEW,
      () => externalUrlNavigation(source) ?? screen(NOTIFICATION_NAVIGATION_KIND.NONE),
    )
    .with(NOTIFICATION_ACTION_TYPE.DEEP_LINK, undefined, () => navigationByType(source))
    .exhaustive();
}
