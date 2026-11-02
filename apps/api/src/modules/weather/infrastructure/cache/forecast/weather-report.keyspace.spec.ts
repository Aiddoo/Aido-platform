import { WEATHER_REPORT_CACHE_TTL_MS, WeatherReportCacheKey } from "./weather-report.keyspace.js";

describe("날씨 v2 캐시 키와 TTL", () => {
  it("칸·언어별 리포트와 최신 폴백, 칸별 대기질 키를 v1 날씨 키와 겹치지 않게 만든다", () => {
    // Given
    const cell = "wydm9";
    // When
    const keys = [
      WeatherReportCacheKey.report(cell, "ko"),
      WeatherReportCacheKey.latestReport(cell, "en"),
      WeatherReportCacheKey.airQuality(cell),
      WeatherReportCacheKey.availability(cell),
      WeatherReportCacheKey.providerFailure(cell),
    ];
    // Then
    expect(keys).toEqual([
      "aido:v1:weather:v2:report:wydm9:ko",
      "aido:v1:weather:v2:report-latest:wydm9:en",
      "aido:v1:weather:v2:air-quality:wydm9",
      "aido:v1:weather:v2:availability:wydm9",
      "aido:v1:weather:v2:provider-failure:wydm9",
    ]);
  });

  it("리포트 15분, 최신 폴백 6시간, 대기질 1시간, dataset 가용성 7일, 장애 차단 1분을 유지한다", () => {
    // Given
    const expected = {
      REPORT: 900_000,
      LATEST_REPORT: 21_600_000,
      AIR_QUALITY: 3_600_000,
      AVAILABILITY: 604_800_000,
      PROVIDER_FAILURE: 60_000,
    };
    // When
    const ttl = WEATHER_REPORT_CACHE_TTL_MS;
    // Then
    expect(ttl).toEqual(expected);
  });
});
