/**
 * GetForecastsByGridBatchUseCase 단위 테스트
 *
 * - 여러 격자의 예보를 배치 조회하는 얇은 위임 use-case (스케줄러·ai-suggestion의 N+1 방지)
 * - fan-out(mget→미스만 병렬 호출)·폴백·캐시 저장은 WeatherForecastReader.fetchBatch 소유
 * - 따라서 여기서는 grids/date 전달과 결과 Map(입력 순서 보존)의 무손실 반환만 검증한다
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { WeatherForecast } from "../../ports/weather-provider.port";
import { type GridInput, WeatherForecastReader } from "../../services/weather-forecast.reader";
import { GetForecastsByGridBatchUseCase } from "./get-forecasts-by-grid-batch.use-case";

function buildForecast(temperatureMax: number): WeatherForecast {
	return {
		date: new Date("2026-07-23T00:00:00.000Z"),
		skyCondition: "CLEAR",
		precipitationType: "NONE",
		precipitationProbability: 0,
		temperatureMin: temperatureMax - 8,
		temperatureMax,
		humidity: 55,
		windSpeed: 3,
		hourlyForecasts: [],
		dailyForecasts: [],
	};
}

describe("GetForecastsByGridBatchUseCase — 격자 예보 배치 조회 위임", () => {
	let useCase: GetForecastsByGridBatchUseCase;
	let forecastReader: Mocked<WeatherForecastReader>;

	const date = new Date("2026-07-23T09:00:00.000Z");
	const grids: GridInput[] = [
		{ gridX: 60, gridY: 127, lat: 37.5665, lon: 126.978 },
		{ gridX: 98, gridY: 76, lat: 35.1796, lon: 129.0756 },
	];

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetForecastsByGridBatchUseCase).compile();

		useCase = unit;
		forecastReader = unitRef.get(WeatherForecastReader);
	});

	it("grids와 date를 예보 리더 배치 조회에 그대로 위임하고 결과 Map을 반환한다", async () => {
		// Given - 리더가 "gridX:gridY" 키의 Map을 반환(입력 순서 보존)
		const batch = new Map<string, WeatherForecast>([
			["60:127", buildForecast(28)],
			["98:76", buildForecast(30)],
		]);
		forecastReader.fetchBatch.mockResolvedValue(batch);

		// When
		const result = await useCase.execute({ grids, date });

		// Then - 파라미터 전달 + Map 무손실 반환(키 순서 보존)
		expect(forecastReader.fetchBatch).toHaveBeenCalledWith(grids, date);
		expect(result).toBe(batch);
		expect([...result.keys()]).toEqual(["60:127", "98:76"]);
		expect(result.get("60:127")?.temperatureMax).toBe(28);
		expect(result.get("98:76")?.temperatureMax).toBe(30);
	});

	it("빈 grids 입력은 그대로 위임되어 빈 Map을 반환한다", async () => {
		// Given
		forecastReader.fetchBatch.mockResolvedValue(new Map());

		// When
		const result = await useCase.execute({ grids: [], date });

		// Then
		expect(forecastReader.fetchBatch).toHaveBeenCalledWith([], date);
		expect(result.size).toBe(0);
	});
});
