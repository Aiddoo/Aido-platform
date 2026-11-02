import { weatherLocationSchema, weatherReportSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { eq } from "drizzle-orm";
import request from "supertest";

import { SHARED_WEATHER_REPORT_SCOPE } from "#api/modules/weather/application/models/forecast/weather-report-language";
import { AIR_QUALITY_PROVIDER } from "#api/modules/weather/application/ports/forecast/air-quality-provider.port";
import { WEATHER_REPORT_PROVIDER } from "#api/modules/weather/application/ports/forecast/weather-report.provider.port";
import { WeatherKitRequestError } from "#api/modules/weather/infrastructure/adapters/forecast/weatherkit-report.provider";
import { WeatherReportCacheKey } from "#api/modules/weather/infrastructure/cache/forecast/weather-report.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";
import { userLocation } from "#api/platform/database/schema/index";
import { weatherReportFixture } from "#test/fixtures/weather.fixture";
import { StubAirQualityProvider, StubWeatherReportProvider } from "#test/mocks/ports/weather.stub";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const SEOUL = { latitude: 37.5665, longitude: 126.978 };
const TOKYO = { latitude: 35.6762, longitude: 139.6503 };
const SEOUL_CELL = "wydm9";
const BORDER = { latitude: 41.9, longitude: -6.56 };

describe("날씨 v2 E2E", () => {
  let ctx: E2eTestContext;
  const reportProvider = new StubWeatherReportProvider();
  const airQualityProvider = new StubAirQualityProvider();

  beforeAll(async () => {
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(WEATHER_REPORT_PROVIDER)
          .useValue(reportProvider)
          .overrideProvider(AIR_QUALITY_PROVIDER)
          .useValue(airQualityProvider),
      additionalResetters: [() => reportProvider.clear(), () => airQualityProvider.clear()],
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  function registerLocation(accessToken: string, coordinate: typeof SEOUL) {
    return request(ctx.app.getHttpServer())
      .put("/v2/weather/location")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(coordinate);
  }

  function getReport(accessToken: string, language = "ko") {
    return request(ctx.app.getHttpServer())
      .get("/v2/weather")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Accept-Language", language);
  }

  describe("PUT /v2/weather/location", () => {
    it("해외 좌표를 시간대와 함께 저장하고 기상청 격자는 비워 둔다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-tokyo@example.com", "Test1234!");
      // When
      const response = await registerLocation(user.accessToken, TOKYO).expect(200);
      // Then
      expect(weatherLocationSchema.parse(response.body.data)).toEqual({
        ...TOKYO,
        timezone: "Asia/Tokyo",
      });
      const [row] = await ctx.testDatabase
        .getClient()
        .select({ gridX: userLocation.gridX, gridY: userLocation.gridY, tz: userLocation.timezone })
        .from(userLocation)
        .where(eq(userLocation.userId, user.userId));
      expect(row).toEqual({ gridX: null, gridY: null, tz: "Asia/Tokyo" });
    });

    it("시간대 경계 칸은 칸 중심 시간대를 저장·응답해 GET 리포트의 시간대와 같다", async () => {
      // Given - 좌표 자체는 Europe/Madrid, 칸 중심은 Europe/Lisbon
      const user = await ctx.helpers.createVerifiedUser("v2-border@example.com", "Test1234!");
      reportProvider.report = weatherReportFixture(new Date());
      // When
      const saved = await registerLocation(user.accessToken, BORDER).expect(200);
      const report = await getReport(user.accessToken).expect(200);
      // Then
      expect(saved.body.data.timezone).toBe("Europe/Lisbon");
      expect(report.body.data.location.timezone).toBe("Europe/Lisbon");
      const [row] = await ctx.testDatabase
        .getClient()
        .select({ tz: userLocation.timezone })
        .from(userLocation)
        .where(eq(userLocation.userId, user.userId));
      expect(row).toEqual({ tz: "Europe/Lisbon" });
    });

    it("한국 좌표는 기상청 격자도 저장해 v1 예보가 계속 동작한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-seoul@example.com", "Test1234!");
      await registerLocation(user.accessToken, SEOUL).expect(200);
      // When
      const v1Forecast = await request(ctx.app.getHttpServer())
        .get("/v1/weather/forecast")
        .set("Authorization", `Bearer ${user.accessToken}`);
      // Then
      expect(v1Forecast.status).toBe(200);
      expect(v1Forecast.body.data.latitude).toBe(SEOUL.latitude);
    });

    it("위도 91은 400 SYS_0002이며 저장하지 않는다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-invalid@example.com", "Test1234!");
      // When
      const response = await registerLocation(user.accessToken, {
        latitude: 91,
        longitude: 126.978,
      }).expect(400);
      // Then
      expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
      const rows = await ctx.testDatabase
        .getClient()
        .select({ id: userLocation.id })
        .from(userLocation)
        .where(eq(userLocation.userId, user.userId));
      expect(rows).toEqual([]);
    });

    it("인증 없이 요청하면 401이다", async () => {
      // Given
      const anonymous = request(ctx.app.getHttpServer()).put("/v2/weather/location");
      // When
      const response = await anonymous.send(SEOUL);
      // Then
      expect(response.status).toBe(401);
    });
  });

  describe("GET /v2/weather", () => {
    it("위치가 없으면 404 WEATHER_1902이며 공급자를 부르지 않는다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-none@example.com", "Test1234!");
      // When
      const response = await getReport(user.accessToken).expect(404);
      // Then
      expect(response.body.error.code).toBe(ErrorCode.WEATHER_1902);
      expect(reportProvider.calls).toEqual([]);
    });

    it("한국 위치는 칸 중심으로 조회한 리포트에 대기질을 합쳐 공유 계약대로 응답한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-report@example.com", "Test1234!");
      await registerLocation(user.accessToken, SEOUL).expect(200);
      reportProvider.report = weatherReportFixture(new Date());
      airQualityProvider.result = { pm10: 32, pm25: 18 };
      // When
      const response = await getReport(user.accessToken, "ko-KR,ko;q=0.9").expect(200);
      // Then
      const report = weatherReportSchema.parse(response.body.data);
      expect(report.location).toEqual({ ...SEOUL, timezone: "Asia/Seoul" });
      expect(report.airQuality).toEqual({ pm10: 32, pm25: 18, source: "AIRKOREA" });
      expect(report.attribution.serviceName).toBe("Apple Weather");
      expect(report.attribution.legalPageUrl).toMatch(
        /^https:\/\/developer.apple.com\/weatherkit\//,
      );
      expect(report.hourly.length).toBeLessThanOrEqual(24);
      expect(report.daily.length).toBeLessThanOrEqual(10);
      expect(reportProvider.calls).toEqual([
        {
          cellKey: SEOUL_CELL,
          request: { timezone: "Asia/Seoul", countryCode: "KR", language: "ko" },
        },
      ]);
      expect(airQualityProvider.calls[0]?.lat).not.toBe(SEOUL.latitude);
    });

    it("해외 위치는 영어 특보를 받고 대기질은 null이며 키를 빼지 않는다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-abroad@example.com", "Test1234!");
      await registerLocation(user.accessToken, TOKYO).expect(200);
      // When
      const response = await getReport(user.accessToken, "en-US").expect(200);
      // Then
      expect(response.body.data.airQuality).toBeNull();
      expect(response.body.data).toHaveProperty("nextHour", null);
      expect(airQualityProvider.calls).toEqual([]);
      expect(reportProvider.calls[0]?.request).toEqual({
        timezone: "Asia/Tokyo",
        countryCode: "JP",
        language: "en",
      });
    });

    it("WeatherKit이 429로 실패해도 남아 있는 최신 리포트를 돌려준다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-stale@example.com", "Test1234!");
      await registerLocation(user.accessToken, SEOUL).expect(200);
      const fetchedAt = new Date();
      reportProvider.report = weatherReportFixture(fetchedAt);
      await getReport(user.accessToken).expect(200);
      await ctx.module
        .get(CacheService)
        .del(WeatherReportCacheKey.report(SEOUL_CELL, SHARED_WEATHER_REPORT_SCOPE));
      reportProvider.failure = new WeatherKitRequestError("http_failure");
      // When
      const response = await getReport(user.accessToken).expect(200);
      // Then
      expect(response.body.data.fetchedAt).toBe(fetchedAt.toISOString());
      expect(reportProvider.calls).toHaveLength(2);
    });

    it("공급자가 실패하고 이전 리포트도 없으면 503 WEATHER_1901이다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-down@example.com", "Test1234!");
      await registerLocation(user.accessToken, SEOUL).expect(200);
      reportProvider.failure = new WeatherKitRequestError("http_failure");
      // When
      const response = await getReport(user.accessToken).expect(503);
      // Then
      expect(response.body.error.code).toBe(ErrorCode.WEATHER_1901);
    });
  });

  describe("v1 호환", () => {
    it("v2로 해외 위치를 등록하면 v1 예보·부가정보는 위치 없음과 같은 WEATHER_1902다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("v2-v1compat@example.com", "Test1234!");
      await registerLocation(user.accessToken, TOKYO).expect(200);
      // When
      const [forecast, conditions] = await Promise.all(
        ["/v1/weather/forecast", "/v1/weather/conditions"].map((path) =>
          request(ctx.app.getHttpServer())
            .get(path)
            .set("Authorization", `Bearer ${user.accessToken}`),
        ),
      );
      // Then
      expect([forecast?.status, conditions?.status]).toEqual([404, 404]);
      expect(forecast?.body.error.code).toBe(ErrorCode.WEATHER_1902);
      expect(conditions?.body.error.code).toBe(ErrorCode.WEATHER_1902);
    });
  });
});
