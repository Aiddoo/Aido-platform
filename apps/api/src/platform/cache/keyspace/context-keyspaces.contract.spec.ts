import {
  UserSettingsCacheKey,
  USER_SETTINGS_CACHE_TTL_MS,
} from "#api/modules/identity/user-preferences/infrastructure/cache/user-settings-cache.keyspace";
import {
  DAILY_COMPLETION_CACHE_TTL_MS,
  DailyCompletionCacheKey,
} from "#api/modules/insights/daily-completions/infrastructure/cache/daily-completion.keyspace";
import {
  NOTIFICATION_CACHE_TTL_MS,
  NotificationCacheKey,
} from "#api/modules/notification/notifications/infrastructure/cache/notification-cache.keyspace";
import {
  NOTIFICATION_DEDUPLICATION_SENTINEL,
  NOTIFICATION_DEDUPLICATION_TTL_MS,
  notificationDeduplicationKey,
} from "#api/modules/notification/notifications/infrastructure/cache/notification-deduplication.keyspace";
import {
  PUSH_TOKEN_CACHE_TTL_MS,
  PushTokenCacheKey,
} from "#api/modules/notification/push-devices/infrastructure/cache/push-token-cache.keyspace";
import {
  ReminderCacheKey,
  REMINDER_CACHE_TTL_MS,
} from "#api/modules/notification/reminders/infrastructure/cache/reminder-cache.keyspace";
import {
  RETENTION_CACHE_TTL_MS,
  RetentionCacheKey,
} from "#api/modules/notification/retention-assignments/infrastructure/cache/retention-cache.keyspace";
import {
  TodoCategoryCacheKey,
  TODO_CATEGORY_CACHE_TTL_MS,
} from "#api/modules/planning/todo-categories/infrastructure/cache/todo-category-cache.keyspace";
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
} from "#api/modules/social/friendships/infrastructure/cache/friendship-cache.keyspace";
import {
  NUDGE_COUNT_CACHE_TTL_MS,
  NudgeCountCacheKey,
} from "#api/modules/social/nudges/infrastructure/cache/nudge-count-cache.keyspace";
import {
  WEATHER_CACHE_TTL_MS,
  WeatherCacheKey,
} from "#api/modules/weather/weather-reports/infrastructure/cache/weather-forecast.keyspace";

describe("Bounded Context별 cache keyspace 계약", () => {
  it("기존 키와 전환한 날짜별 Weather 키를 명시한다", () => {
    // When
    const preferenceKey = UserSettingsCacheKey.preference("user-1");
    const todoCategoryListKey = TodoCategoryCacheKey.list("user-1");
    const friendshipIdsKey = FriendshipCacheKey.ids("user-1");
    const friendshipCountKey = FriendshipCacheKey.count("user-1");
    const activeTimezonesKey = ReminderCacheKey.activeTimezones();
    const unreadCountKey = NotificationCacheKey.unreadCount("user-1");
    const legacyUnreadCountKey = NotificationCacheKey.unreadCount("user-1", "legacy");
    const forecastKey = WeatherCacheKey.forecast({
      gridX: 60,
      gridY: 127,
      baseDate: "20260401",
      baseTime: "0800",
      targetDate: "2026-04-02",
    });
    const latestForecastKey = WeatherCacheKey.latestForecast(60, 127);
    const conditionsKey = WeatherCacheKey.conditions(60, 127, "2026-04-01");
    const friendTodosKey = TodoCacheKey.friendTodosFirstPageVersioned({
      ownerUserId: "user-1",
      generation: "generation-1",
      startDate: "-",
      endDate: "-",
      size: 20,
    });
    const dailyCompletionRangeKey = DailyCompletionCacheKey.range("user-1", "generation-1", {
      start: "2026-01-01",
      end: "2026-01-31",
    });
    const pushTokensKey = PushTokenCacheKey.pushTokens("user-1");
    const dedupKey = notificationDeduplicationKey(
      "MORNING_REMINDER",
      Temporal.PlainDate.from("2026-01-01"),
    );
    const nudgeReceivedKey = NudgeCountCacheKey.received("user-1");
    const nudgeSentKey = NudgeCountCacheKey.sent("user-1");
    const cheerReceivedKey = CheerCountCacheKey.received("user-1");
    const cheerSentKey = CheerCountCacheKey.sent("user-1");
    const postgresTimezoneNamesKey = RetentionCacheKey.postgresTimezoneNames();

    // Then
    expect(preferenceKey).toBe("aido:v1:user-settings:preference:user-1");
    expect(todoCategoryListKey).toBe("aido:v1:todo-category:list:user-1");
    expect(friendshipIdsKey).toBe("aido:v1:follow:ids:user-1");
    expect(friendshipCountKey).toBe("aido:v1:follow:count:user-1");
    expect(activeTimezonesKey).toBe("aido:v1:scheduler:active-timezones");
    expect(unreadCountKey).toBe("aido:v1:notification:unread-count:user-1");
    expect(legacyUnreadCountKey).toBe("aido:v1:notification:unread-count:user-1:legacy");
    // #1156: 발표를 당겨 쓰면 한 발표가 여러 대상 날짜에 쓰이므로 대상 날짜를 키 끝에 더했다.
    expect(forecastKey).toBe("aido:v1:weather:forecast:60:127:20260401:0800:2026-04-02");
    expect(latestForecastKey).toBe("aido:v1:weather:forecast-latest:60:127");
    expect(conditionsKey).toBe("aido:v1:weather:conditions:60:127:2026-04-01");
    expect(friendTodosKey).toBe("aido:v1:todo:friend-view-v2:user-1:generation-1:-:-:20");
    // range-v3: 완료율 반올림을 바꿔 이전 서버가 쓴 값을 읽지 않는다
    expect(dailyCompletionRangeKey).toBe(
      "aido:v1:daily-completion:range-v3:user-1:generation-1:own:2026-01-01:2026-01-31",
    );
    expect(pushTokensKey).toBe("aido:v1:notification:push-tokens:user-1");
    expect(dedupKey).toBe("aido:v1:notification:dedup-notified:MORNING_REMINDER:2026-01-01");
    expect(nudgeReceivedKey).toBe("aido:v1:nudge:received-counts:user-1");
    expect(nudgeSentKey).toBe("aido:v1:nudge:sent-count:user-1");
    expect(cheerReceivedKey).toBe("aido:v1:cheer:received-counts:user-1");
    expect(cheerSentKey).toBe("aido:v1:cheer:sent-count:user-1");
    expect(postgresTimezoneNamesKey).toBe("aido:v1:retention:postgres-timezone-names");
  });

  it("기존 TTL과 sentinel 값을 그대로 유지한다", () => {
    // When
    const values = {
      USER_SETTINGS_CACHE_TTL_MS,
      TODO_CATEGORY_CACHE_TTL_MS,
      REMINDER_CACHE_TTL_MS,
      FRIENDSHIP_CACHE_TTL_MS,
      NOTIFICATION_CACHE_TTL_MS,
      PUSH_TOKEN_CACHE_TTL_MS,
      WEATHER_CACHE_TTL_MS,
      TODO_CACHE_TTL_MS,
      DAILY_COMPLETION_CACHE_TTL_MS,
      NOTIFICATION_DEDUPLICATION_TTL_MS,
      NOTIFICATION_DEDUPLICATION_SENTINEL,
      RETENTION_CACHE_TTL_MS,
      NUDGE_COUNT_CACHE_TTL_MS,
      CHEER_COUNT_CACHE_TTL_MS,
    };

    // Then
    expect(values.USER_SETTINGS_CACHE_TTL_MS).toBe(600_000);
    expect(values.TODO_CATEGORY_CACHE_TTL_MS).toBe(300_000);
    expect(values.REMINDER_CACHE_TTL_MS).toBe(300_000);
    expect(values.FRIENDSHIP_CACHE_TTL_MS).toEqual({
      MUTUAL: 60_000,
      IDS: 300_000,
      COUNT: 300_000,
    });
    expect(values.NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT).toBe(120_000);
    expect(values.WEATHER_CACHE_TTL_MS).toEqual({
      FORECAST: 10_800_000,
      LATEST_FORECAST: 86_400_000,
      CONDITIONS: 3_600_000,
      FORECAST_FAILURE: 60_000,
    });
    expect(values.TODO_CACHE_TTL_MS.FRIEND_VIEW).toBe(60_000);
    expect(values.DAILY_COMPLETION_CACHE_TTL_MS).toBe(600_000);
    expect(values.PUSH_TOKEN_CACHE_TTL_MS.PUSH_TOKENS).toBe(300_000);
    expect(values.NOTIFICATION_DEDUPLICATION_TTL_MS).toBe(90_000_000);
    expect(values.NOTIFICATION_DEDUPLICATION_SENTINEL).toBe("__init__");
    expect(values.RETENTION_CACHE_TTL_MS.POSTGRES_TIMEZONE_NAMES).toBe(86_400_000);
    expect(values.NUDGE_COUNT_CACHE_TTL_MS).toBe(60_000);
    expect(values.CHEER_COUNT_CACHE_TTL_MS).toBe(60_000);
  });
});
