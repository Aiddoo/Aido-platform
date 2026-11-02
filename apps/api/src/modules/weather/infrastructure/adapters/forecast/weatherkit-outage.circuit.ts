import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpNetworkError, HttpTimeoutError } from "@nestjs/http-client";
import { z } from "zod";

import { CacheService } from "#api/platform/cache/cache.service";

import {
  WEATHER_REPORT_CACHE_TTL_MS,
  WeatherReportCacheKey,
} from "../../cache/forecast/weather-report.keyspace.js";
import { WeatherKitLogEvent } from "../../observability/forecast/weatherkit-log.events.js";

/** 여러 칸이 연달아 이만큼 실패하면 칸별 차단만으로는 알림 순회가 칸 수 × 시간 초과만큼 늘어난다. */
const OUTAGE_FAILURE_THRESHOLD = 3;
const failureStreakSchema = z.number().int().positive();

/** 공급자 전체 장애 신호만 센다. 400·404 같은 요청 오류와 응답 형식 오류는 그 칸의 문제다. */
export function isWeatherKitOutageFailure(error: unknown, status: number | null): boolean {
  if (error instanceof HttpTimeoutError || error instanceof HttpNetworkError) {
    return true;
  }
  return status != null && status >= 500;
}

/**
 * 칸을 가리지 않는 WeatherKit 장애 차단. 상태를 공용 캐시에 두어 여러 인스턴스가 같은 판단을 쓴다.
 * 연속 실패 수는 get/set이라 동시에 실패하면 덜 셀 수 있지만, 다음 실패에서 다시 올라가므로 차단이 늦어질 뿐이다.
 */
@Injectable()
export class WeatherKitOutageCircuit {
  readonly #logger = new Logger(WeatherKitOutageCircuit.name);

  constructor(
    @Inject(CacheService)
    private readonly cacheService: Pick<CacheService, "get" | "set" | "has" | "del">,
  ) {}

  isOpen(): Promise<boolean> {
    return this.cacheService.has(WeatherReportCacheKey.providerOutage());
  }

  async recordFailure(): Promise<void> {
    const streakKey = WeatherReportCacheKey.providerFailureStreak();
    const streak = ((await this.cacheService.get(streakKey, failureStreakSchema)) ?? 0) + 1;
    if (streak < OUTAGE_FAILURE_THRESHOLD) {
      await this.cacheService.set(
        streakKey,
        streak,
        WEATHER_REPORT_CACHE_TTL_MS.PROVIDER_FAILURE_STREAK,
      );
      return;
    }

    // 장애 기간에는 연속 실패 수를 남겨 두어, 차단이 풀린 뒤 첫 실패에서 바로 다시 막는다.
    await this.cacheService.set(
      streakKey,
      streak,
      WEATHER_REPORT_CACHE_TTL_MS.PROVIDER_OUTAGE_EPISODE,
    );
    await this.cacheService.set(
      WeatherReportCacheKey.providerOutage(),
      true,
      WEATHER_REPORT_CACHE_TTL_MS.PROVIDER_OUTAGE,
    );
    if (streak === OUTAGE_FAILURE_THRESHOLD) {
      this.#logger.warn({
        event: WeatherKitLogEvent.OUTAGE_OPENED,
        count: streak,
        cooldownMs: WEATHER_REPORT_CACHE_TTL_MS.PROVIDER_OUTAGE,
      });
    }
  }

  async recordSuccess(): Promise<void> {
    const streakKey = WeatherReportCacheKey.providerFailureStreak();
    const streak = await this.cacheService.get(streakKey, failureStreakSchema);
    if (streak == null) {
      return;
    }
    await this.cacheService.del(streakKey);
    if (streak >= OUTAGE_FAILURE_THRESHOLD) {
      await this.cacheService.del(WeatherReportCacheKey.providerOutage());
      this.#logger.log({ event: WeatherKitLogEvent.OUTAGE_CLOSED, count: streak });
    }
  }
}
