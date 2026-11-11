import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import type {
  WeatherReportAttribution,
  WeatherReportAttributionLogo,
} from "../../domain/weather-report.vo.js";
import {
  WEATHER_REPORT_CACHE_TTL_MS,
  WeatherReportCacheKey,
} from "../cache/weather-report.keyspace.js";
import { WeatherKitLogEvent } from "../weatherkit.log-events.js";
import { WEATHERKIT_POLICY } from "./weather-outbound.policy.js";
import { WeatherKitUsageMeterAdapter } from "./weatherkit-usage-meter.adapter.js";

const WEATHERKIT_ORIGIN = "https://weatherkit.apple.com";
const ATTRIBUTION_TIMEOUT_MS = 3000;
const LEGAL_PAGE_URL = "https://developer.apple.com/weatherkit/data-source-attribution/";
const SERVICE_NAME = "Apple Weather";

const assetPathSchema = z
  .string()
  .startsWith("/")
  .transform((path) => `${WEATHERKIT_ORIGIN}${path}`);

/** WeatherKit `GET /attribution/{language}`. 인증 없이 받는 공개 자원이다. */
const weatherKitAttributionSchema = z.object({
  "logoLight@1x": assetPathSchema,
  "logoLight@2x": assetPathSchema,
  "logoLight@3x": assetPathSchema,
  "logoDark@1x": assetPathSchema,
  "logoDark@2x": assetPathSchema,
  "logoDark@3x": assetPathSchema,
});

const attributionLogoSchema = z.object({
  light: z.object({ "1x": z.url(), "2x": z.url(), "3x": z.url() }),
  dark: z.object({ "1x": z.url(), "2x": z.url(), "3x": z.url() }),
});

/** attribution 응답이 2xx가 아닐 때. 응답 본문은 담지 않는다. */
class WeatherKitAttributionRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`WeatherKit attribution request failed: ${status}`);
    this.name = "WeatherKitAttributionRequestError";
    this.status = status;
  }
}

/**
 * Apple 날씨 데이터를 보여 주는 화면은 공급자 로고와 출처 고지 링크를 함께 표시해야 한다.
 * 로고 경로는 Apple이 언어별로 바꿀 수 있어 공식 attribution API에서 받고 7일 캐시한다.
 * 조회에 실패해도 날씨 응답은 그대로 내보내고 로고만 null로 둔다(앱은 서비스 이름 텍스트로 표기).
 * 실패한 언어는 1분 동안 다시 부르지 않아 Apple 장애 중 요청마다 3초를 기다리지 않는다.
 */
@Injectable()
export class WeatherKitAttributionAdapter {
  readonly #logger = new Logger(WeatherKitAttributionAdapter.name);
  readonly #policy: OutboundPolicy;
  readonly #http: HttpClient;
  readonly #cache: Pick<CacheStorePort, "wrap" | "has" | "set">;
  readonly #usage: Pick<WeatherKitUsageMeterAdapter, "recordCall">;

  constructor(
    @InjectHttpClient("weather") http: HttpClient,
    @Inject(CacheStorePort)
    cache: Pick<CacheStorePort, "wrap" | "has" | "set">,
    policies: OutboundPolicyRegistry,
    @Inject(WeatherKitUsageMeterAdapter) usage: Pick<WeatherKitUsageMeterAdapter, "recordCall">,
  ) {
    this.#http = http;
    this.#cache = cache;
    this.#usage = usage;
    this.#policy = policies.get(WEATHERKIT_POLICY);
  }

  async resolve(language: string): Promise<WeatherReportAttribution> {
    return {
      provider: "APPLE_WEATHER",
      serviceName: SERVICE_NAME,
      legalPageUrl: LEGAL_PAGE_URL,
      logo: await this.#logo(language),
    };
  }

  async #logo(language: string): Promise<WeatherReportAttributionLogo | null> {
    const failureKey = WeatherReportCacheKey.attributionFailure(language);
    if (await this.#cache.has(failureKey)) {
      return null;
    }
    try {
      return await this.#cache.wrap(
        WeatherReportCacheKey.attribution(language),
        attributionLogoSchema,
        async () => {
          const outcome = await this.#policy.execute(async (signal) => {
            await this.#usage.recordCall();
            return requestVendorJson(
              this.#http,
              `${WEATHERKIT_ORIGIN}/attribution/${encodeURIComponent(language)}`,
              {},
              { signal, timeoutMs: ATTRIBUTION_TIMEOUT_MS },
            );
          });
          if (outcome.kind === "http_failure") {
            throw new WeatherKitAttributionRequestError(outcome.statusCode);
          }
          const attribution = weatherKitAttributionSchema.parse(outcome.body);
          return {
            light: {
              "1x": attribution["logoLight@1x"],
              "2x": attribution["logoLight@2x"],
              "3x": attribution["logoLight@3x"],
            },
            dark: {
              "1x": attribution["logoDark@1x"],
              "2x": attribution["logoDark@2x"],
              "3x": attribution["logoDark@3x"],
            },
          };
        },
        WEATHER_REPORT_CACHE_TTL_MS.ATTRIBUTION,
      );
    } catch (error) {
      this.#logger.warn({
        event: WeatherKitLogEvent.ATTRIBUTION_FAILED,
        language,
        status: error instanceof WeatherKitAttributionRequestError ? error.status : null,
        errorType: toErrorType(error),
      });
      await this.#cache.set(failureKey, true, WEATHER_REPORT_CACHE_TTL_MS.ATTRIBUTION_FAILURE);
      return null;
    }
  }
}
