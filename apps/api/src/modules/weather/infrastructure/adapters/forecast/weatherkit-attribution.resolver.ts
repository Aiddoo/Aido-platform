import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { z } from "zod";

import { CacheService } from "#api/platform/cache/cache.service";
import { requestVendorJson } from "#api/platform/http/request-vendor-json";

import type {
  WeatherReportAttribution,
  WeatherReportAttributionLogo,
} from "../../../application/models/forecast/weather-report.model.js";
import {
  WEATHER_REPORT_CACHE_TTL_MS,
  WeatherReportCacheKey,
} from "../../cache/forecast/weather-report.keyspace.js";
import { WeatherKitLogEvent } from "../../observability/forecast/weatherkit-log.events.js";

const WEATHERKIT_ORIGIN = "https://weatherkit.apple.com";
const ATTRIBUTION_TIMEOUT_MS = 3_000;
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

/**
 * Apple 날씨 데이터를 보여 주는 화면은 공급자 로고와 출처 고지 링크를 함께 표시해야 한다.
 * 로고 경로는 Apple이 언어별로 바꿀 수 있어 공식 attribution API에서 받고 7일 캐시한다.
 * 조회에 실패해도 날씨 응답은 그대로 내보내고 로고만 null로 둔다(앱은 서비스 이름 텍스트로 표기).
 */
@Injectable()
export class WeatherKitAttributionResolver {
  readonly #logger = new Logger(WeatherKitAttributionResolver.name);

  constructor(
    @InjectHttpClient("weather") private readonly http: HttpClient,
    @Inject(CacheService) private readonly cacheService: Pick<CacheService, "wrap">,
  ) {}

  async resolve(language: string): Promise<WeatherReportAttribution> {
    return {
      provider: "APPLE_WEATHER",
      serviceName: SERVICE_NAME,
      legalPageUrl: LEGAL_PAGE_URL,
      logo: await this.#logo(language),
    };
  }

  async #logo(language: string): Promise<WeatherReportAttributionLogo | null> {
    try {
      return await this.cacheService.wrap(
        WeatherReportCacheKey.attribution(language),
        attributionLogoSchema,
        async () => {
          const outcome = await requestVendorJson(
            this.http,
            `${WEATHERKIT_ORIGIN}/attribution/${encodeURIComponent(language)}`,
            {},
            { timeoutMs: ATTRIBUTION_TIMEOUT_MS },
          );
          if (outcome.kind === "http_failure") {
            throw new Error(`attribution http ${outcome.statusCode}`);
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
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return null;
    }
  }
}
