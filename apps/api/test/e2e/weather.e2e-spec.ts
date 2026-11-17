/**
 * Weather E2E 테스트
 *
 * @description
 * 날씨 API 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 위치 등록/수정 (PUT /weather/location)
 * 2. 날씨 예보 조회 (GET /weather/forecast)
 * 3. 날씨 부가 정보 조회 (GET /weather/conditions)
 *
 * 실행 명령:
 * pnpm --filter @aido/server test:e2e -- weather.e2e-spec
 */

import { weatherConditionsSchema, weatherForecastSchema } from "@aido/api";
import request from "supertest";

import { AirQualityProviderPort } from "#api/modules/weather/forecasts/application/ports/air-quality-provider.port";
import { LifestyleIndexProviderPort } from "#api/modules/weather/forecasts/application/ports/lifestyle-index-provider.port";
import { SunTimeProviderPort } from "#api/modules/weather/forecasts/application/ports/sun-time-provider.port";
import { WeatherForecastProviderPort } from "#api/modules/weather/forecasts/application/ports/weather-forecast-provider.port";
import { StubAirQualityProvider } from "#test/doubles/weather/stub-air-quality-provider";
import { StubLifestyleIndexProvider } from "#test/doubles/weather/stub-lifestyle-index-provider";
import { StubSunTimeProvider } from "#test/doubles/weather/stub-sun-time-provider";
import { StubWeatherForecastProvider } from "#test/doubles/weather/stub-weather-forecast-provider";
import { todayIn } from "#test/fixtures/clock.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

/** KMA 제공 범위가 오늘(KST) 기준이므로 고정 날짜 대신 오늘에서 떨어진 날짜를 쓴다. */
function kstDate(offsetDays: number): string {
  return todayIn("Asia/Seoul").add({ days: offsetDays }).toString();
}

describe("날씨 E2E", () => {
  let testContext: E2eTestContext;
  const weatherProvider = new StubWeatherForecastProvider();
  const airQualityProvider = new StubAirQualityProvider();
  const lifestyleIndexProvider = new StubLifestyleIndexProvider();
  const sunTimeProvider = new StubSunTimeProvider();

  beforeAll(async () => {
    testContext = await createE2eApp({
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(WeatherForecastProviderPort)
          .useValue(weatherProvider)
          .overrideProvider(AirQualityProviderPort)
          .useValue(airQualityProvider)
          .overrideProvider(LifestyleIndexProviderPort)
          .useValue(lifestyleIndexProvider)
          .overrideProvider(SunTimeProviderPort)
          .useValue(sunTimeProvider),
      additionalResetters: [
        () => weatherProvider.clear(),
        () => airQualityProvider.clear(),
        () => lifestyleIndexProvider.clear(),
        () => sunTimeProvider.clear(),
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  describe("위치 등록", () => {
    describe("PUT /weather/location - 위치 등록/수정", () => {
      it("유효한 좌표로 위치를 등록한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-loc-reg@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 126.978 })
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.latitude).toBe(37.5665);
        expect(response.body.data.longitude).toBe(126.978);
        expect(response.body.data.gridX).toBeDefined();
        expect(response.body.data.gridY).toBeDefined();
      });

      it("위치를 등록한 뒤 수정하면 새 좌표가 반환된다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-loc-mod@example.com",
          "Test1234!",
        );
        await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 126.978 })
          .expect(200);

        // When
        const response = await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 35.1796, longitude: 129.0756 })
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.latitude).toBe(35.1796);
        expect(response.body.data.longitude).toBe(129.0756);
      });

      it("범위를 벗어난 위도이면 400 에러 반환", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-loc-badlat@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 50.0, longitude: 126.978 })
          .expect(400);

        // Then
        expect(response.body.success).toBe(false);
      });

      it("범위를 벗어난 경도이면 400 에러 반환", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-loc-badlng@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 100.0 })
          .expect(400);

        // Then
        expect(response.body.success).toBe(false);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .send({ latitude: 37.5665, longitude: 126.978 });

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("날씨 예보 조회", () => {
    describe("GET /weather/forecast - 날씨 예보 조회", () => {
      it("위치 미등록 시 WEATHER_1902 에러 반환", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-fc-noloc@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/forecast")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(404);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("WEATHER_1902");
      });

      it("위치 등록 후 예보를 조회한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-fc-ok@example.com",
          "Test1234!",
        );
        await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 126.978 })
          .expect(200);

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/forecast")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.skyCondition).toBeDefined();
        expect(response.body.data.temperatureMin).toBeDefined();
        expect(response.body.data.temperatureMax).toBeDefined();
        expect(response.body.data.hourlyForecasts).toBeInstanceOf(Array);
        expect(response.body.data.dailyForecasts).toBeInstanceOf(Array);
        expect(response.body.data.latitude).toBe(37.5665);
        expect(response.body.data.longitude).toBe(126.978);
      });

      it("date 파라미터로 특정 날짜 예보를 조회한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-fc-date@example.com",
          "Test1234!",
        );
        await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 126.978 })
          .expect(200);

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/forecast")
          .query({ date: kstDate(1) })
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.skyCondition).toBeDefined();
      });

      it("잘못된 date 형식이면 400 에러 반환", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-fc-baddate@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/forecast")
          .query({ date: "invalid-date" })
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(400);

        // Then
        expect(response.body.success).toBe(false);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get("/v1/weather/forecast");

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("날씨 부가 정보 조회", () => {
    describe("GET /weather/conditions - 부가 정보 조회", () => {
      it("위치 미등록 시 WEATHER_1902 에러 반환", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-cond-noloc@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/conditions")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(404);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("WEATHER_1902");
      });

      it("위치 등록 후 부가 정보를 조회한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "weather-cond-ok@example.com",
          "Test1234!",
        );
        await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 126.978 })
          .expect(200);

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/conditions")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        const data = response.body.data;
        expect(data).toHaveProperty("feelsLikeTemperature");
        expect(data).toHaveProperty("uvIndex");
        expect(data).toHaveProperty("sunrise");
        expect(data).toHaveProperty("sunset");
        expect(data).toHaveProperty("pm10");
        expect(data).toHaveProperty("pm25");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get(
          "/v1/weather/conditions",
        );

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("기존 한국 계약과 날짜 cache 회귀", () => {
    it("같은 격자라도 query 날짜별 일출입을 반환하고 재조회는 해당 날짜 cache를 쓴다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "weather-date-cache@example.com",
        "Test1234!",
      );
      await request(testContext.app.getHttpServer())
        .put("/v1/weather/location")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ latitude: 37.5665, longitude: 126.978 })
        .expect(200);
      sunTimeProvider.dates.set("2026-07-23", { sunrise: "05:23", sunset: "19:00" });
      sunTimeProvider.dates.set("2026-07-24", { sunrise: "05:24", sunset: "19:01" });
      // When
      const first = await request(testContext.app.getHttpServer())
        .get("/v1/weather/conditions")
        .query({ date: "2026-07-23" })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      const next = await request(testContext.app.getHttpServer())
        .get("/v1/weather/conditions")
        .query({ date: "2026-07-24" })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      const again = await request(testContext.app.getHttpServer())
        .get("/v1/weather/conditions")
        .query({ date: "2026-07-23" })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      // Then
      expect(weatherConditionsSchema.safeParse(first.body.data).success).toBe(true);
      expect(first.body.data.sunrise).toBe("05:23");
      expect(next.body.data.sunrise).toBe("05:24");
      expect(next.body.data.sunset).toBe("19:01");
      expect(again.body.data).toEqual(first.body.data);
      expect(sunTimeProvider.calls).toHaveLength(2);
    });

    it("일부 공급자 장애는 해당 필드만 null이며 유효한 0을 JSON에 보존한다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "weather-partial@example.com",
        "Test1234!",
      );
      await request(testContext.app.getHttpServer())
        .put("/v1/weather/location")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ latitude: 37.5665, longitude: 126.978 })
        .expect(200);
      airQualityProvider.failure = new Error("air unavailable");
      lifestyleIndexProvider.result = { feelsLikeTemperature: 0, uvIndex: 0 };
      // When
      const response = await request(testContext.app.getHttpServer())
        .get("/v1/weather/conditions")
        .query({ date: "2026-07-23" })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      // Then
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        feelsLikeTemperature: 0,
        uvIndex: 0,
        sunrise: "05:23",
        sunset: "19:00",
        pm10: null,
        pm25: null,
      });
      expect(weatherConditionsSchema.safeParse(response.body.data).success).toBe(true);
    });

    it("예보 공급자 장애와 latest 없음은 기존 WEATHER_1901과 503이다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "weather-unavailable@example.com",
        "Test1234!",
      );
      await request(testContext.app.getHttpServer())
        .put("/v1/weather/location")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ latitude: 37.5665, longitude: 126.978 })
        .expect(200);
      weatherProvider.failure = new Error("forecast unavailable");
      // When
      const response = await request(testContext.app.getHttpServer())
        .get("/v1/weather/forecast")
        .query({ date: kstDate(0) })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(503);
      // Then
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatchObject({
        code: "WEATHER_1901",
        message: "날씨 정보를 가져올 수 없습니다.",
      });
    });

    it("이전 발표 예보가 있으면 공급자 장애에도 latest의 기존 응답 계약을 유지한다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "weather-latest@example.com",
        "Test1234!",
      );
      await request(testContext.app.getHttpServer())
        .put("/v1/weather/location")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ latitude: 37.5665, longitude: 126.978 })
        .expect(200);
      const first = await request(testContext.app.getHttpServer())
        .get("/v1/weather/forecast")
        .query({ date: kstDate(0) })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      weatherProvider.failure = new Error("forecast unavailable");
      // When
      const fallback = await request(testContext.app.getHttpServer())
        .get("/v1/weather/forecast")
        .query({ date: kstDate(1) })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      // Then
      expect(fallback.body.data).toEqual(first.body.data);
      expect(weatherForecastSchema.safeParse(fallback.body.data).success).toBe(true);
      expect(weatherProvider.calls).toHaveLength(2);
    });

    it.each([
      ["3일보다 오래된", -3],
      ["모레보다 먼", 3],
    ])(
      "KMA가 주지 않는 %s 날짜는 공급자를 부르지 않고 400 SYS_0002다 (#1156)",
      async (_case, offset) => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          `weather-range-${offset}@example.com`,
          "Test1234!",
        );
        await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 126.978 })
          .expect(200);
        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/forecast")
          .query({ date: kstDate(offset) })
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(400);
        // Then
        expect(response.body.error.code).toBe("SYS_0002");
        expect(weatherProvider.calls).toEqual([]);
      },
    );

    it("격자를 옮겨도 이전 격자의 공유 cache를 지우지 않아 남은 사용자는 공급자를 다시 부르지 않고 옮긴 사용자는 새 격자를 조회한다", async () => {
      // Given
      const mover = await testContext.helpers.createVerifiedUser(
        "weather-move@example.com",
        "Test1234!",
      );
      const remaining = await testContext.helpers.createVerifiedUser(
        "weather-remain@example.com",
        "Test1234!",
      );
      for (const user of [mover, remaining]) {
        await request(testContext.app.getHttpServer())
          .put("/v1/weather/location")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ latitude: 37.5665, longitude: 126.978 })
          .expect(200);
      }
      for (const date of ["2026-07-23", "2026-07-24"]) {
        await request(testContext.app.getHttpServer())
          .get("/v1/weather/conditions")
          .query({ date })
          .set("Authorization", `Bearer ${mover.accessToken}`)
          .expect(200);
      }
      // When
      const moved = await request(testContext.app.getHttpServer())
        .put("/v1/weather/location")
        .set("Authorization", `Bearer ${mover.accessToken}`)
        .send({ latitude: 35.1796, longitude: 129.0756 })
        .expect(200);
      const remainingSunrises: unknown[] = [];
      for (const date of ["2026-07-23", "2026-07-24"]) {
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/weather/conditions")
          .query({ date })
          .set("Authorization", `Bearer ${remaining.accessToken}`)
          .expect(200);
        remainingSunrises.push(response.body.data.sunrise);
      }
      await request(testContext.app.getHttpServer())
        .get("/v1/weather/conditions")
        .query({ date: "2026-07-23" })
        .set("Authorization", `Bearer ${mover.accessToken}`)
        .expect(200);
      // Then
      expect(moved.body.data).toEqual({
        latitude: 35.1796,
        longitude: 129.0756,
        gridX: 98,
        gridY: 76,
      });
      expect(remainingSunrises).toEqual(["05:23", "05:23"]);
      expect(sunTimeProvider.calls.map((call) => [call.lat, call.lon])).toEqual([
        [37.5665, 126.978],
        [37.5665, 126.978],
        [35.1796, 129.0756],
      ]);
    });

    it("해외 좌표는 기존 한국 bbox validation으로 거절하고 날씨 공급자를 호출하지 않는다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "weather-overseas@example.com",
        "Test1234!",
      );
      // When
      const response = await request(testContext.app.getHttpServer())
        .put("/v1/weather/location")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ latitude: 40.7128, longitude: -74.006 })
        .expect(400);
      // Then
      expect(response.body.success).toBe(false);
      expect(weatherProvider.calls).toEqual([]);
      expect(sunTimeProvider.calls).toEqual([]);
    });
  });
});
