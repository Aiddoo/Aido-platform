/**
 * WeatherController 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용. 컨트롤러는 endpoint UseCase를 직접 주입받는다.
 *
 * 실행 명령:
 * pnpm --filter @aido/server test weather.controller.spec
 */

import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import { UserLocationBuilder } from "#test/builders/index";

import type { CurrentUserPayload } from "../../../../identity/presentation/decorators/auth/index.js";
import type { WeatherConditions } from "../../../application/ports/forecast/weather-provider.port.js";
import { GetWeatherConditions } from "../../../application/use-cases/forecast/get-weather-conditions.use-case.js";
import { GetWeatherForecast } from "../../../application/use-cases/forecast/get-weather-forecast.use-case.js";
import { UpsertLocation } from "../../../application/use-cases/forecast/upsert-location.use-case.js";
import { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { WeatherController } from "./weather.controller.js";

describe("WeatherController — 날씨 컨트롤러", () => {
  let controller: WeatherController;
  let upsertLocationUseCase: Mocked<UpsertLocation>;
  let getWeatherForecastUseCase: Mocked<GetWeatherForecast>;
  let getWeatherConditionsUseCase: Mocked<GetWeatherConditions>;

  const mockUser: CurrentUserPayload = {
    userId: "user-1",
    email: "test@example.com",
    sessionId: "session-1",
    role: "USER",
  };

  /** 도메인 엔티티로 복원 (컨트롤러는 getter latitude/longitude/gridX/gridY 사용) */
  const buildLocation = (): UserLocation => {
    const row = UserLocationBuilder.create("user-1").build();
    return UserLocation.reconstitute({
      userId: row.userId,
      latitude: row.latitude,
      longitude: row.longitude,
      gridX: row.gridX,
      gridY: row.gridY,
    });
  };

  beforeEach(async () => {
    UserLocationBuilder.resetIdCounter();

    const { unit, unitRef } = await TestBed.solitary(WeatherController).compile();

    controller = unit;
    upsertLocationUseCase = unitRef.get(UpsertLocation);
    getWeatherForecastUseCase = unitRef.get(GetWeatherForecast);
    getWeatherConditionsUseCase = unitRef.get(GetWeatherConditions);
  });

  describe("updateLocation", () => {
    it("위치를 등록하고 격자 좌표를 포함한 결과를 반환해야 한다", async () => {
      // Given
      const dto = { latitude: 37.5665, longitude: 126.978 };
      const location = buildLocation();
      upsertLocationUseCase.execute.mockResolvedValue(location);

      // When
      const result = await controller.updateLocation(mockUser, dto);

      // Then
      expect(upsertLocationUseCase.execute).toHaveBeenCalledWith({
        userId: "user-1",
        latitude: 37.5665,
        longitude: 126.978,
      });
      expect(result).toEqual({
        latitude: location.latitude,
        longitude: location.longitude,
        gridX: location.gridX,
        gridY: location.gridY,
      });
    });
  });

  describe("getForecast", () => {
    it("날짜 미지정 시 오늘 기준으로 예보를 조회해야 한다", async () => {
      // Given
      const forecast = {
        date: new Date(),
        skyCondition: "CLEAR" as const,
        precipitationType: "NONE" as const,
        precipitationProbability: 10,
        temperatureMin: 8,
        temperatureMax: 20,
        humidity: 55,
        windSpeed: 3.5,
        hourlyForecasts: [],
        dailyForecasts: [],
      };
      const location = buildLocation();
      getWeatherForecastUseCase.execute.mockResolvedValue({
        forecast,
        location,
      });

      // When
      const result = await controller.getForecast(mockUser, {});

      // Then
      expect(getWeatherForecastUseCase.execute).toHaveBeenCalledWith({
        userId: "user-1",
        date: expect.any(Date),
      });
      expect(result).toMatchObject({
        latitude: location.latitude,
        longitude: location.longitude,
        skyCondition: "CLEAR",
      });
    });

    it("date 파라미터가 있으면 해당 날짜로 조회해야 한다", async () => {
      // Given
      const forecast = {
        date: new Date("2026-04-04"),
        skyCondition: "CLOUDY" as const,
        precipitationType: "RAIN" as const,
        precipitationProbability: 80,
        temperatureMin: 5,
        temperatureMax: 12,
        humidity: 75,
        windSpeed: 5.0,
        hourlyForecasts: [],
        dailyForecasts: [],
      };
      const location = buildLocation();
      getWeatherForecastUseCase.execute.mockResolvedValue({
        forecast,
        location,
      });

      // When
      const result = await controller.getForecast(mockUser, {
        date: "2026-04-04",
      });

      // Then
      expect(getWeatherForecastUseCase.execute).toHaveBeenCalledWith({
        userId: "user-1",
        date: expect.any(Date),
      });
      expect(result.skyCondition).toBe("CLOUDY");
    });
  });

  describe("getConditions", () => {
    it("부가 정보를 조회해야 한다", async () => {
      // Given
      const conditions: WeatherConditions = {
        feelsLikeTemperature: 12,
        uvIndex: 5,
        sunrise: "06:15",
        sunset: "18:45",
        pm10: 45,
        pm25: 22,
      };
      getWeatherConditionsUseCase.execute.mockResolvedValue(conditions);

      // When
      const result = await controller.getConditions(mockUser, {});

      // Then
      expect(getWeatherConditionsUseCase.execute).toHaveBeenCalledWith({
        userId: "user-1",
        date: expect.any(Date),
      });
      expect(result).toEqual(conditions);
    });
  });
});
