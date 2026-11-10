import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryUserLocationRepository } from "#test/doubles/weather/in-memory-user-location.repository";
import { RecordingForecastGridCacheInvalidator } from "#test/doubles/weather/recording-forecast-grid-cache-invalidator";
import { StubTimezoneResolver } from "#test/doubles/weather/stub-timezone-resolver";
import {
  createUserLocationFixture,
  USER_LOCATION_FIXTURE_NOW,
  USER_LOCATION_FIXTURE_USER_ID,
} from "#test/fixtures/weather/user-location.fixture";

import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { KmaWeatherGridResolverAdapter } from "../../infrastructure/adapters/kma-weather-grid-resolver.adapter.js";
import { UpsertUserLocationUseCase } from "./upsert-user-location.use-case.js";

const SEOUL = { latitude: 37.5665, longitude: 126.978 };
const BUSAN = { latitude: 35.1796, longitude: 129.0756 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const USER_ID = UserId.reconstitute(USER_LOCATION_FIXTURE_USER_ID);

function setup(options: { readonly saved?: ReturnType<typeof createUserLocationFixture> } = {}) {
  const repository = new InMemoryUserLocationRepository(
    options.saved == null ? [] : [options.saved],
  );
  const invalidator = new RecordingForecastGridCacheInvalidator();
  const timezoneResolver = new StubTimezoneResolver();
  const clock = new FixedClock(USER_LOCATION_FIXTURE_NOW);
  const useCase = new UpsertUserLocationUseCase({
    userLocationRepository: repository,
    gridCacheInvalidator: invalidator,
    weatherGridResolver: new KmaWeatherGridResolverAdapter(),
    timezoneResolver,
    clock,
  });
  return { useCase, repository, invalidator, timezoneResolver };
}

describe("UpsertUserLocationUseCase — 위치 저장과 이전 격자 무효화", () => {
  it("최초 위치를 해결한 격자와 시간대·저장 시각과 함께 저장하고 캐시는 건드리지 않는다", async () => {
    // Given
    const { useCase, repository, invalidator } = setup();

    // When
    const result = await useCase.execute({ userId: USER_LOCATION_FIXTURE_USER_ID, ...SEOUL });

    // Then
    expect(result.timezone).toBe("Asia/Seoul");
    const saved = await repository.findByUserId(USER_ID);
    expect(saved?.toPrimitives()).toEqual({
      userId: USER_LOCATION_FIXTURE_USER_ID,
      ...SEOUL,
      gridX: 60,
      gridY: 127,
      timezone: "Asia/Seoul",
      updatedAt: USER_LOCATION_FIXTURE_NOW,
    });
    expect(invalidator.invalidated).toEqual([]);
  });

  it("같은 격자 안에서 위치를 바꾸면 격자 캐시를 보존한다", async () => {
    // Given
    const { useCase, invalidator } = setup({ saved: createUserLocationFixture() });

    // When
    await useCase.execute({
      userId: USER_LOCATION_FIXTURE_USER_ID,
      latitude: 37.5666,
      longitude: 126.9781,
    });

    // Then
    expect(invalidator.invalidated).toEqual([]);
  });

  it("격자를 이동하면 이전 격자의 캐시만 비우고 새 격자를 저장한다", async () => {
    // Given
    const { useCase, repository, invalidator } = setup({ saved: createUserLocationFixture() });

    // When
    await useCase.execute({ userId: USER_LOCATION_FIXTURE_USER_ID, ...BUSAN });

    // Then
    expect(invalidator.invalidated).toEqual([{ gridX: 60, gridY: 127 }]);
    const saved = await repository.findByUserId(USER_ID);
    expect([saved?.grid?.gridX, saved?.grid?.gridY]).toEqual([98, 76]);
  });

  it("한국에서 해외로 옮기면 이전 격자 캐시를 비우고 격자 없이 저장한다", async () => {
    // Given
    const { useCase, repository, invalidator, timezoneResolver } = setup({
      saved: createUserLocationFixture(),
    });
    timezoneResolver.region = { timezone: "Europe/Paris", countryCode: "FR" };

    // When
    await useCase.execute({ userId: USER_LOCATION_FIXTURE_USER_ID, ...PARIS });

    // Then
    expect(invalidator.invalidated).toEqual([{ gridX: 60, gridY: 127 }]);
    const saved = await repository.findByUserId(USER_ID);
    expect(saved?.grid).toBeNull();
    expect(saved?.timezone?.value).toBe("Europe/Paris");
  });

  it("해외 좌표는 격자 없이 시간대만 저장한다", async () => {
    // Given
    const { useCase, repository, invalidator, timezoneResolver } = setup();
    timezoneResolver.region = { timezone: "Asia/Tokyo", countryCode: "JP" };

    // When
    const result = await useCase.execute({
      userId: USER_LOCATION_FIXTURE_USER_ID,
      latitude: 35.6762,
      longitude: 139.6503,
    });

    // Then
    expect(result.timezone).toBe("Asia/Tokyo");
    expect((await repository.findByUserId(USER_ID))?.grid).toBeNull();
    expect(invalidator.invalidated).toEqual([]);
  });

  it("시간대는 사용자 좌표가 아니라 칸 중심 좌표로 정한다", async () => {
    // Given
    const { useCase, timezoneResolver } = setup();
    const center = GeoCell.create(createUserLocationFixture(SEOUL).coordinate).center;

    // When
    await useCase.execute({ userId: USER_LOCATION_FIXTURE_USER_ID, ...SEOUL });

    // Then
    expect(timezoneResolver.coordinates.map((c) => [c.latitude, c.longitude])).toEqual([
      [center.latitude, center.longitude],
    ]);
  });

  it("저장에 실패하면 이전 격자 캐시를 비우지 않는다", async () => {
    // Given
    const { useCase, repository, invalidator } = setup({ saved: createUserLocationFixture() });
    repository.saveFailure = new Error("db down");

    // When
    const outcome = useCase.execute({ userId: USER_LOCATION_FIXTURE_USER_ID, ...BUSAN });

    // Then
    await expect(outcome).rejects.toThrow("db down");
    expect(invalidator.invalidated).toEqual([]);
  });

  it("범위를 벗어난 좌표는 SYS_0002이며 읽거나 저장하지 않는다", async () => {
    // Given
    const { useCase, repository } = setup();

    // When
    const outcome = useCase.execute({
      userId: USER_LOCATION_FIXTURE_USER_ID,
      latitude: 91,
      longitude: 126.978,
    });

    // Then
    await expect(outcome).rejects.toMatchObject({ errorCode: "SYS_0002" });
    expect(repository.reads).toEqual([]);
    expect(repository.saved).toEqual([]);
  });
});
