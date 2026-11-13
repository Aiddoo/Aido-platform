import {
  UserSettingsCacheKey,
  USER_SETTINGS_CACHE_TTL_MS,
} from "#api/modules/identity/preferences/infrastructure/cache/user-settings-cache.keyspace";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DailyCompletionCacheKey,
} from "#api/modules/insights/daily-completions/infrastructure/cache/daily-completion.keyspace";
import {
  NOTIFICATION_CACHE_TTL_MS,
  NotificationCacheKey,
} from "#api/modules/notification/inbox/infrastructure/cache/notification-cache.keyspace";
import {
  NOTIFICATION_DEDUP_SENTINEL,
  NOTIFICATION_DEDUP_TTL_MS,
  notificationDedupKey,
} from "#api/modules/notification/push/infrastructure/cache/notification-dedup.keyspace";
import {
  ReminderCacheKey,
  REMINDER_CACHE_TTL_MS,
} from "#api/modules/notification/reminders/infrastructure/cache/reminder-cache.keyspace";
import {
  SCHEDULER_DEDUP_TTL_MS,
  SchedulerDedupKey,
} from "#api/modules/notification/reminders/infrastructure/cache/scheduler-dedup.keyspace";
import {
  RETENTION_CACHE_TTL_MS,
  RetentionCacheKey,
} from "#api/modules/notification/retention/infrastructure/cache/retention-cache.keyspace";
import {
  TodoCategoryCacheKey,
  TODO_CATEGORY_CACHE_TTL_MS,
} from "#api/modules/planning/categories/infrastructure/cache/todo-category-cache.keyspace";
import {
  TODO_CACHE_TTL_MS,
  TodoCacheKey,
} from "#api/modules/planning/todos/infrastructure/cache/todo-cache.keyspace";
import {
  CHEER_COUNT_CACHE_TTL_MS,
  CheerCountCacheKey,
} from "#api/modules/social/cheers/infrastructure/cache/cheer-count-cache.keyspace";
import {
  FriendshipCacheKey,
  FRIENDSHIP_CACHE_TTL_MS,
} from "#api/modules/social/friends/infrastructure/cache/friendship-cache.keyspace";
import {
  NUDGE_COUNT_CACHE_TTL_MS,
  NudgeCountCacheKey,
} from "#api/modules/social/nudges/infrastructure/cache/nudge-count-cache.keyspace";
import {
  WEATHER_CACHE_TTL_MS,
  WeatherCacheKey,
} from "#api/modules/weather/forecasts/infrastructure/cache/weather-forecast.keyspace";

describe("Bounded Context별 cache keyspace 계약", () => {
  it("기존 키와 전환한 날짜별 Weather 키를 명시한다", () => {
    expect(UserSettingsCacheKey.preference("user-1")).toBe(
      "aido:v1:user-settings:preference:user-1",
    );
    expect(TodoCategoryCacheKey.list("user-1")).toBe("aido:v1:todo-category:list:user-1");
    expect(FriendshipCacheKey.ids("user-1")).toBe("aido:v1:follow:ids:user-1");
    expect(FriendshipCacheKey.count("user-1")).toBe("aido:v1:follow:count:user-1");
    expect(ReminderCacheKey.activeTimezones()).toBe("aido:v1:scheduler:active-timezones");
    expect(NotificationCacheKey.unreadCount("user-1")).toBe(
      "aido:v1:notification:unread-count:user-1",
    );
    expect(NotificationCacheKey.unreadCount("user-1", "legacy")).toBe(
      "aido:v1:notification:unread-count:user-1:legacy",
    );
    // #1156: 발표를 당겨 쓰면 한 발표가 여러 대상 날짜에 쓰이므로 대상 날짜를 키 끝에 더했다.
    expect(WeatherCacheKey.forecast(60, 127, "20260401", "0800", "2026-04-02")).toBe(
      "aido:v1:weather:forecast:60:127:20260401:0800:2026-04-02",
    );
    expect(WeatherCacheKey.latestForecast(60, 127)).toBe("aido:v1:weather:forecast-latest:60:127");
    expect(WeatherCacheKey.conditions(60, 127, "2026-04-01")).toBe(
      "aido:v1:weather:conditions:60:127:2026-04-01",
    );
    expect(TodoCacheKey.friendTodosFirstPageVersioned("user-1", "generation-1", "-", "-", 20)).toBe(
      "aido:v1:todo:friend-view-v2:user-1:generation-1:-:-:20",
    );
    expect(
      DailyCompletionCacheKey.range("user-1", "generation-1", "2026-01-01", "2026-01-31"),
    ).toBe("aido:v1:daily-completion:range-v2:user-1:generation-1:own:2026-01-01:2026-01-31");
    expect(NotificationCacheKey.pushTokens("user-1")).toBe(
      "aido:v1:notification:push-tokens:user-1",
    );
    expect(notificationDedupKey("MORNING_REMINDER", Temporal.PlainDate.from("2026-01-01"))).toBe(
      "aido:v1:notification:dedup-notified:MORNING_REMINDER:2026-01-01",
    );
    expect(SchedulerDedupKey.winbackStages("user-1")).toBe(
      "aido:v1:scheduler:dedup-winback-stages:user-1",
    );
    expect(NudgeCountCacheKey.received("user-1")).toBe("aido:v1:nudge:received-counts:user-1");
    expect(NudgeCountCacheKey.sent("user-1")).toBe("aido:v1:nudge:sent-count:user-1");
    expect(CheerCountCacheKey.received("user-1")).toBe("aido:v1:cheer:received-counts:user-1");
    expect(CheerCountCacheKey.sent("user-1")).toBe("aido:v1:cheer:sent-count:user-1");
    expect(RetentionCacheKey.postgresTimezoneNames()).toBe(
      "aido:v1:retention:postgres-timezone-names",
    );
  });

  it("기존 TTL과 sentinel 값을 그대로 유지한다", () => {
    expect(USER_SETTINGS_CACHE_TTL_MS).toBe(600_000);
    expect(TODO_CATEGORY_CACHE_TTL_MS).toBe(300_000);
    expect(REMINDER_CACHE_TTL_MS).toBe(300_000);
    expect(FRIENDSHIP_CACHE_TTL_MS).toEqual({ MUTUAL: 60_000, IDS: 300_000, COUNT: 300_000 });
    expect(NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT).toBe(120_000);
    expect(WEATHER_CACHE_TTL_MS).toEqual({
      FORECAST: 10_800_000,
      LATEST_FORECAST: 86_400_000,
      CONDITIONS: 3_600_000,
      FORECAST_FAILURE: 60_000,
    });
    expect(TODO_CACHE_TTL_MS.FRIEND_VIEW).toBe(60_000);
    expect(DAILY_COMPLETION_CACHE_TTL_MS).toBe(600_000);
    expect(NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS).toBe(300_000);
    expect(NOTIFICATION_DEDUP_TTL_MS).toBe(90_000_000);
    expect(NOTIFICATION_DEDUP_SENTINEL).toBe("__init__");
    expect(RETENTION_CACHE_TTL_MS.POSTGRES_TIMEZONE_NAMES).toBe(86_400_000);
    expect(NUDGE_COUNT_CACHE_TTL_MS).toBe(60_000);
    expect(CHEER_COUNT_CACHE_TTL_MS).toBe(60_000);
    expect(SCHEDULER_DEDUP_TTL_MS).toEqual({
      WINBACK_STAGES: 7_776_000_000,
      NUDGE_SUGGEST: 691_200_000,
    });
  });
});
