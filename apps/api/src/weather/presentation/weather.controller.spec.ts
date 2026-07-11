/**
 * WeatherController 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용. 컨트롤러는 WeatherFacade만 주입받는다.
 *
 * 실행 명령:
 * pnpm --filter @aido/api test weather.controller.spec
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { UserLocationBuilder } from "@test/builders";
import type { CurrentUserPayload } from "../../auth/presentation/decorators";
import { WeatherFacade } from "../application/facades/weather.facade";
import type { WeatherConditions } from "../application/ports/weather-provider.port";
import { UserLocation } from "../domain/entities/user-location.entity";
import { WeatherController } from "./weather.controller";

describe("WeatherController — 날씨 컨트롤러", () => {
	let controller: WeatherController;
	let weatherFacade: Mocked<WeatherFacade>;

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

		const { unit, unitRef } =
			await TestBed.solitary(WeatherController).compile();

		controller = unit;
		weatherFacade = unitRef.get(WeatherFacade);
	});

	describe("updateLocation", () => {
		it("위치를 등록하고 격자 좌표를 포함한 결과를 반환해야 한다", async () => {
			// Given
			const dto = { latitude: 37.5665, longitude: 126.978 };
			const location = buildLocation();
			weatherFacade.upsertLocation.mockResolvedValue(location);

			// When
			const result = await controller.updateLocation(mockUser, dto);

			// Then
			expect(weatherFacade.upsertLocation).toHaveBeenCalledWith(
				"user-1",
				37.5665,
				126.978,
			);
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
			weatherFacade.getForecastForUser.mockResolvedValue({
				forecast,
				location,
			});

			// When
			const result = await controller.getForecast(mockUser, {});

			// Then
			expect(weatherFacade.getForecastForUser).toHaveBeenCalledWith(
				"user-1",
				expect.any(Date),
			);
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
			weatherFacade.getForecastForUser.mockResolvedValue({
				forecast,
				location,
			});

			// When
			const result = await controller.getForecast(mockUser, {
				date: "2026-04-04",
			});

			// Then
			expect(weatherFacade.getForecastForUser).toHaveBeenCalledWith(
				"user-1",
				expect.any(Date),
			);
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
			weatherFacade.getConditionsForUser.mockResolvedValue(conditions);

			// When
			const result = await controller.getConditions(mockUser, {});

			// Then
			expect(weatherFacade.getConditionsForUser).toHaveBeenCalledWith(
				"user-1",
				expect.any(Date),
			);
			expect(result).toEqual(conditions);
		});
	});
});
