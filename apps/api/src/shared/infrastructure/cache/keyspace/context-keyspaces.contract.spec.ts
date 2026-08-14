import {
	DAILY_COMPLETION_CACHE_TTL_MS,
	DailyCompletionCacheKey,
} from "@/daily-completion/infrastructure/cache/daily-completion-cache.keyspace";
import {
	NOTIFICATION_CACHE_TTL_MS,
	NotificationCacheKey,
} from "@/notification/infrastructure/cache/notification-cache.keyspace";
import {
	NOTIFICATION_DEDUP_SENTINEL,
	NOTIFICATION_DEDUP_TTL_MS,
	notificationDedupKey,
} from "@/notification/infrastructure/cache/notification-dedup.keyspace";
import {
	SCHEDULER_DEDUP_TTL_MS,
	SchedulerDedupKey,
} from "@/scheduler/infrastructure/cache/scheduler-dedup.keyspace";
import { TODO_CACHE_TTL_MS, TodoCacheKey } from "@/todo/infrastructure/cache/todo-cache.keyspace";
import {
	WEATHER_CACHE_TTL_MS,
	WeatherCacheKey,
} from "@/weather/infrastructure/cache/weather-cache.keyspace";

describe("bounded-context cache keyspace contracts", () => {
	it("기존 Redis 키 문자열을 그대로 유지한다", () => {
		expect(WeatherCacheKey.forecast(60, 127, "20260401", "0800")).toBe(
			"aido:v1:weather:forecast:60:127:20260401:0800",
		);
		expect(WeatherCacheKey.latestForecast(60, 127)).toBe("aido:v1:weather:forecast-latest:60:127");
		expect(WeatherCacheKey.conditions(60, 127)).toBe("aido:v1:weather:conditions:60:127");
		expect(TodoCacheKey.friendTodosFirstPage("user-1", "-", "-", 20)).toBe(
			"aido:v1:todo:friend-view-v1:user-1:-:-:20",
		);
		expect(DailyCompletionCacheKey.range("user-1", "2026-01-01", "2026-01-31")).toBe(
			"aido:v1:daily-completion:range-v1:user-1:2026-01-01:2026-01-31",
		);
		expect(NotificationCacheKey.pushTokens("user-1")).toBe(
			"aido:v1:notification:push-tokens:user-1",
		);
		expect(notificationDedupKey("MORNING_REMINDER", new Date("2026-01-01T00:00:00.000Z"))).toBe(
			"aido:v1:notification:dedup-notified:MORNING_REMINDER:2026-01-01",
		);
		expect(SchedulerDedupKey.winbackStages("user-1")).toBe(
			"aido:v1:scheduler:dedup-winback-stages:user-1",
		);
	});

	it("기존 TTL과 sentinel 값을 그대로 유지한다", () => {
		expect(WEATHER_CACHE_TTL_MS).toEqual({
			FORECAST: 10_800_000,
			LATEST_FORECAST: 86_400_000,
			CONDITIONS: 3_600_000,
		});
		expect(TODO_CACHE_TTL_MS.FRIEND_VIEW).toBe(60_000);
		expect(DAILY_COMPLETION_CACHE_TTL_MS).toBe(600_000);
		expect(NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS).toBe(300_000);
		expect(NOTIFICATION_DEDUP_TTL_MS).toBe(90_000_000);
		expect(NOTIFICATION_DEDUP_SENTINEL).toBe("__init__");
		expect(SCHEDULER_DEDUP_TTL_MS).toEqual({
			WINBACK_STAGES: 7_776_000_000,
			NUDGE_SUGGEST: 691_200_000,
		});
	});
});
