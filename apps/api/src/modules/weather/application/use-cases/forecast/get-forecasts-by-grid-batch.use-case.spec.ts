import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { WeatherForecast } from "../../ports/forecast/weather-provider.port.js";
import {
  type GridInput,
  WeatherForecastReader,
} from "../../services/forecast/weather-forecast.reader.js";
import { GetForecastsByGridBatch } from "./get-forecasts-by-grid-batch.use-case.js";

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

describe("GetForecastsByGridBatch — 격자 예보 배치 조회 위임", () => {
  let useCase: GetForecastsByGridBatch;
  let forecastReader: Mocked<WeatherForecastReader>;

  const date = new Date("2026-07-23T09:00:00.000Z");
  const grids: GridInput[] = [
    { gridX: 60, gridY: 127, lat: 37.5665, lon: 126.978 },
    { gridX: 98, gridY: 76, lat: 35.1796, lon: 129.0756 },
  ];

  beforeEach(async () => {
    const getForecastsByGridBatchDependencies = mockDeep<
      ConstructorParameters<typeof GetForecastsByGridBatch>[0]
    >({});
    const unit = new GetForecastsByGridBatch(getForecastsByGridBatchDependencies);

    useCase = unit;
    forecastReader = getForecastsByGridBatchDependencies.forecastReader;
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
