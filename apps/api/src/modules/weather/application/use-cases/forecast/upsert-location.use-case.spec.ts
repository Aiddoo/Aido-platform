import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createWeatherCacheMock } from "#test/mocks/ports/index";

import { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { type WeatherCachePort } from "../../ports/forecast/weather-cache.port.js";
import { type WeatherLocationRepositoryPort } from "../../ports/forecast/weather-location.repository.port.js";
import { UpsertLocation } from "./upsert-location.use-case.js";

function reconstitute(
  userId: string,
  latitude: number,
  longitude: number,
  gridX: number,
  gridY: number,
): UserLocation {
  return UserLocation.reconstitute({
    userId,
    latitude,
    longitude,
    gridX,
    gridY,
  });
}

describe("UpsertLocation — 위치 등록/수정 use-case", () => {
  let useCase: UpsertLocation;
  let repository: Mocked<WeatherLocationRepositoryPort>;
  let cache: Mocked<WeatherCachePort>;

  beforeEach(async () => {
    const upsertLocationDependencies = mockDeep<ConstructorParameters<typeof UpsertLocation>[0]>({
      cache: createWeatherCacheMock(),
    });
    const unit = new UpsertLocation(upsertLocationDependencies);

    useCase = unit;
    repository = upsertLocationDependencies.repository;
    cache = upsertLocationDependencies.cache;
  });

  it("좌표 불변식을 검증하고 저장 결과를 반환한다", async () => {
    // Given
    const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
    repository.findByUserId.mockResolvedValue(null);
    repository.upsert.mockResolvedValue(saved);

    // When
    const result = await useCase.execute({
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
    });

    // Then
    expect(result).toBe(saved);
    expect(repository.upsert).toHaveBeenCalledTimes(1);
    expect(cache.invalidateGrid).not.toHaveBeenCalled();
  });

  it("기존 위치가 없으면 캐시를 무효화하지 않는다", async () => {
    // Given
    const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
    repository.findByUserId.mockResolvedValue(null);
    repository.upsert.mockResolvedValue(saved);

    // When
    await useCase.execute({
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
    });

    // Then
    expect(cache.invalidateGrid).not.toHaveBeenCalled();
  });

  it("격자가 동일하면 캐시를 무효화하지 않는다", async () => {
    // Given
    const old = reconstitute("user-1", 37.5665, 126.978, 60, 127);
    const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
    repository.findByUserId.mockResolvedValue(old);
    repository.upsert.mockResolvedValue(saved);

    // When
    await useCase.execute({
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
    });

    // Then
    expect(cache.invalidateGrid).not.toHaveBeenCalled();
  });

  it("격자가 변경되면 구 격자 캐시를 무효화한다", async () => {
    // Given
    const old = reconstitute("user-1", 35.1796, 129.0756, 98, 76);
    const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
    repository.findByUserId.mockResolvedValue(old);
    repository.upsert.mockResolvedValue(saved);

    // When
    await useCase.execute({
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
    });

    // Then - 구 격자(98:76) 기준으로 패턴/latest/conditions 캐시 삭제
    expect(cache.invalidateGrid).toHaveBeenCalledWith(98, 76);
  });
});
