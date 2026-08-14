import { cacheKey, cachePattern } from "@/shared/infrastructure/cache/keyspace/cache-key";

export const WEATHER_CACHE_TTL_MS = {
	FORECAST: 3 * 60 * 60_000,
	LATEST_FORECAST: 24 * 60 * 60_000,
	CONDITIONS: 60 * 60_000,
} as const;

export const WeatherCacheKey = {
	forecast: (gridX: number, gridY: number, baseDate: string, baseTime: string) =>
		cacheKey("weather", "forecast", String(gridX), String(gridY), baseDate, baseTime),
	latestForecast: (gridX: number, gridY: number) =>
		cacheKey("weather", "forecast-latest", String(gridX), String(gridY)),
	conditions: (gridX: number, gridY: number) =>
		cacheKey("weather", "conditions", String(gridX), String(gridY)),
	forecastPattern: (gridX: number, gridY: number) =>
		cachePattern("weather", "forecast", String(gridX), String(gridY)),
} as const;
