import { WEATHER_REPORT_CACHE_TTL_MS, WeatherReportCacheKey } from "./weather-report.keyspace.js";

describe("날씨 v2 캐시 키와 TTL", () => {
  it("칸·언어별 리포트와 최신 폴백, 칸별 대기질·언어별 출처 표기 키를 v1 날씨 키와 겹치지 않게 만든다", () => {
    // Given
    const cell = "wydm9";
    // When
    const keys = [
      WeatherReportCacheKey.report(cell, "shared"),
      WeatherReportCacheKey.latestReport(cell, "en"),
      WeatherReportCacheKey.airQuality(cell),
      WeatherReportCacheKey.availability(cell),
      WeatherReportCacheKey.providerFailure(cell),
      WeatherReportCacheKey.availabilityFailure(cell),
      WeatherReportCacheKey.attribution("ko"),
      WeatherReportCacheKey.attributionFailure("ko"),
    ];
    // Then
    expect(keys).toEqual([
      "aido:v1:weather:v2:report:wydm9:shared",
      "aido:v1:weather:v2:report-latest:wydm9:en",
      "aido:v1:weather:v2:air-quality:wydm9",
      "aido:v1:weather:v2:availability:wydm9",
      "aido:v1:weather:v2:provider-failure:wydm9",
      "aido:v1:weather:v2:availability-failure:wydm9",
      "aido:v1:weather:v2:attribution:ko",
      "aido:v1:weather:v2:attribution-failure:ko",
    ]);
  });

  it("리포트 30분(곧 강수면 10분), 최신 폴백 6시간, 대기질 1시간, dataset 가용성 7일, 칸별 장애·가용성·표기 실패 차단 1분, 출처 표기 7일을 유지한다", () => {
    // Given
    const expected = {
      REPORT_CALM: 1_800_000,
      REPORT_PRECIPITATION_SOON: 600_000,
      LATEST_REPORT: 21_600_000,
      AIR_QUALITY: 3_600_000,
      AVAILABILITY: 604_800_000,
      PROVIDER_FAILURE: 60_000,
      AVAILABILITY_FAILURE: 60_000,
      ATTRIBUTION: 604_800_000,
      ATTRIBUTION_FAILURE: 60_000,
    };
    // When
    const ttl = WEATHER_REPORT_CACHE_TTL_MS;
    // Then
    expect(ttl).toEqual(expected);
  });
});
