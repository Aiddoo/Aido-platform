import { count, eq, sql } from "drizzle-orm";

import { WeatherCacheAdapter } from "#api/modules/weather/forecasts/infrastructure/cache/weather-forecast.cache";
import { UpsertLocation } from "#api/modules/weather/locations/application/use-cases/upsert-user-location.use-case";
import { UserLocation } from "#api/modules/weather/locations/domain/user-location.entity";
import { KmaWeatherGridResolver } from "#api/modules/weather/locations/infrastructure/adapters/kma-weather-grid-resolver.adapter";
import { TzLookupTimezoneResolver } from "#api/modules/weather/locations/infrastructure/adapters/tz-lookup-timezone-resolver.adapter";
import { DrizzleWeatherLocationRepository } from "#api/modules/weather/locations/infrastructure/persistence/drizzle-user-location.repository";
import { Coordinate } from "#api/modules/weather/shared/domain/coordinate.vo";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import { databaseSqlState } from "#api/platform/database/database-error.util";
import { createEntityId } from "#api/platform/database/entity-id";
import { user, userLocation } from "#api/platform/database/schema/index";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const resolver = new KmaWeatherGridResolver();
const timezoneResolver = new TzLookupTimezoneResolver();
function location(userId: string, latitude = 37.5665, longitude = 126.978): UserLocation {
  const coordinate = Coordinate.of(latitude, longitude);
  return UserLocation.create({
    userId,
    coordinate,
    grid: resolver.resolveGrid(coordinate),
    timezone: "Asia/Seoul",
  });
}

function coordinates(saved: UserLocation | null) {
  if (saved == null) {
    return null;
  }
  return {
    latitude: saved.latitude,
    longitude: saved.longitude,
    gridX: saved.grid?.gridX ?? null,
    gridY: saved.grid?.gridY ?? null,
  };
}

describe("Weather 위치 저장·unique·외래 키·rollback (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
  let client: TestDatabaseClient;
  let repository: DrizzleWeatherLocationRepository;
  let uow: UnitOfWorkPort;
  let userId: string;
  let anotherUserId: string;

  beforeAll(async () => {
    client = await database.start();
    const transaction = createDatabaseTransactionFixture(client);
    repository = new DrizzleWeatherLocationRepository(transaction.txHost);
    uow = transaction.uow;
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    userId = createEntityId();
    anotherUserId = createEntityId();
    await client.insert(user).values([
      UserFixture.create({ id: userId, email: "weather-owner@example.com", userTag: "WEATHER1" }),
      UserFixture.create({
        id: anotherUserId,
        email: "weather-other@example.com",
        userTag: "WEATHER2",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  it("위치가 없으면 null이며 다른 사용자의 위치를 반환하지 않는다", async () => {
    // Given
    await repository.upsert(location(anotherUserId));

    // When
    const found = await repository.findByUserId(userId);

    // Then
    expect(found).toBeNull();
  });

  it("위치를 처음 저장하면 좌표·격자 전체를 readback하고 사용자당 행 한 개다", async () => {
    // Given
    const input = location(userId);

    // When
    const saved = await repository.upsert(input);

    // Then
    expect(saved.userId).toBe(userId);
    expect(coordinates(saved)).toEqual({
      latitude: 37.5665,
      longitude: 126.978,
      gridX: 60,
      gridY: 127,
    });
    expect(coordinates(await repository.findByUserId(userId))).toEqual(coordinates(saved));
    expect(
      await client
        .select({ count: count() })
        .from(userLocation)
        .where(eq(userLocation.userId, userId)),
    ).toEqual([{ count: 1 }]);
  });

  it("반복 upsert는 기존 행 ID를 보존하고 다른 사용자의 위치를 바꾸지 않는다", async () => {
    // Given
    await repository.upsert(location(userId));
    await repository.upsert(location(anotherUserId));
    const before = await client.query.userLocation.findFirst({
      where: { userId },
      columns: { id: true },
    });

    // When
    const saved = await repository.upsert(location(userId, 35.1796, 129.0756));

    // Then
    expect(coordinates(saved)).toEqual({
      latitude: 35.1796,
      longitude: 129.0756,
      gridX: 98,
      gridY: 76,
    });
    expect(
      await client.query.userLocation.findFirst({ where: { userId }, columns: { id: true } }),
    ).toEqual(before);
    expect(coordinates(await repository.findByUserId(anotherUserId))).toEqual({
      latitude: 37.5665,
      longitude: 126.978,
      gridX: 60,
      gridY: 127,
    });
    expect(await client.select({ count: count() }).from(userLocation)).toEqual([{ count: 2 }]);
  });

  it("두 upsert가 실제 unique 잠금에서 대기해도 행 한 개와 완전한 좌표·격자 후보가 남는다", async () => {
    // Given
    const seoul = location(userId);
    const busan = location(userId, 35.1796, 129.0756);
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holder = createDatabaseTransactionFixture(client);
    const holding = holder.uow.run(async () => {
      await new DrizzleWeatherLocationRepository(holder.txHost).upsert(seoul);
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("unique 잠금 조기 종료");
      }),
    ]);

    // When
    const outcomes = Promise.allSettled([repository.upsert(seoul), repository.upsert(busan)]);
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.execute<{ count: number }>(
            sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`,
          );
          expect(waiting.rows[0]?.count).toBe(2);
        },
        { timeout: 5000, interval: 10 },
      );
    } finally {
      released.resolve();
      await holding;
      await outcomes;
    }

    // Then
    expect((await outcomes).map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect([coordinates(seoul), coordinates(busan)]).toContainEqual(
      coordinates(await repository.findByUserId(userId)),
    );
    expect(
      await client
        .select({ count: count() })
        .from(userLocation)
        .where(eq(userLocation.userId, userId)),
    ).toEqual([{ count: 1 }]);
  });

  it("상위 transaction 실패는 신규 위치를 rollback한다", async () => {
    // Given
    const failure = new Error("rollback-weather-insert");

    // When
    const outcome = uow.run(async () => {
      await repository.upsert(location(userId));
      throw failure;
    });

    // Then
    await expect(outcome).rejects.toBe(failure);
    expect(await repository.findByUserId(userId)).toBeNull();
  });

  it("상위 transaction 실패는 기존 위치 변경을 rollback한다", async () => {
    // Given
    await repository.upsert(location(userId));
    const failure = new Error("rollback-weather-update");

    // When
    const outcome = uow.run(async () => {
      await repository.upsert(location(userId, 35.1796, 129.0756));
      throw failure;
    });

    // Then
    await expect(outcome).rejects.toBe(failure);
    expect(coordinates(await repository.findByUserId(userId))).toEqual(
      coordinates(location(userId)),
    );
  });

  it("없는 사용자 위치 저장은 실제 FK 오류이며 orphan 위치를 남기지 않는다", async () => {
    // Given
    const absentUserId = createEntityId();

    // When
    const result = await repository.upsert(location(absentUserId)).catch((error: unknown) => error);

    // Then
    expect(databaseSqlState(result)).toBe("23503");
    expect(await repository.findByUserId(absentUserId)).toBeNull();
  });

  it("사용자 삭제 cascade는 해당 위치만 지우고 다른 위치를 보존한다", async () => {
    // Given
    await repository.upsert(location(userId));
    await repository.upsert(location(anotherUserId));

    // When
    await client.delete(user).where(eq(user.id, userId));

    // Then
    expect(await repository.findByUserId(userId)).toBeNull();
    expect(await repository.findByUserId(anotherUserId)).not.toBeNull();
  });

  it("실제 위치 변경은 이전 격자 캐시를 무효화하고 해외 좌표는 격자 없이 저장한다", async () => {
    // Given
    const memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    const cache = new WeatherCacheAdapter(new CacheService(memory));
    const update = new UpsertLocation({
      weatherLocationRepository: repository,
      weatherCache: cache,
      weatherGridResolver: resolver,
      timezoneResolver,
    });
    const date = new Date("2026-07-23T00:00:00Z");
    const weatherConditions = {
      feelsLikeTemperature: 25,
      uvIndex: 1,
      sunrise: "05:23",
      sunset: "19:00",
      pm10: 10,
      pm25: 5,
    };
    await repository.upsert(location(userId));
    await cache.setConditions(60, 127, date, weatherConditions);

    // When
    await update.execute({ userId, latitude: 35.1796, longitude: 129.0756 });

    // Then
    expect(await cache.getConditions(60, 127, date)).toBeUndefined();
    expect(coordinates(await repository.findByUserId(userId))).toEqual(
      coordinates(location(userId, 35.1796, 129.0756)),
    );
    await cache.setConditions(98, 76, date, weatherConditions);
    await update.execute({ userId, latitude: 48.8566, longitude: 2.3522 });
    expect(await cache.getConditions(98, 76, date)).toBeUndefined();
    expect(coordinates(await repository.findByUserId(userId))).toEqual({
      latitude: 48.8566,
      longitude: 2.3522,
      gridX: null,
      gridY: null,
    });
  });

  it("시간대와 빈 격자를 저장하고 그대로 읽는다", async () => {
    // Given
    const tokyo = UserLocation.create({
      userId,
      coordinate: Coordinate.of(35.6762, 139.6503),
      grid: null,
      timezone: "Asia/Tokyo",
    });

    // When
    await repository.upsert(tokyo);
    const found = await repository.findByUserId(userId);

    // Then
    expect(found?.timezone).toBe("Asia/Tokyo");
    expect(found?.grid).toBeNull();
    expect(
      await client.query.userLocation.findFirst({
        where: { userId },
        columns: { gridX: true, gridY: true, timezone: true },
      }),
    ).toEqual({ gridX: null, gridY: null, timezone: "Asia/Tokyo" });
  });

  it("v2 이전 행처럼 시간대가 null인 위치도 그대로 읽는다", async () => {
    // Given
    await client
      .insert(userLocation)
      .values({ userId, latitude: 37.5665, longitude: 126.978, gridX: 60, gridY: 127 });

    // When
    const found = await repository.findByUserId(userId);

    // Then
    expect(found?.timezone).toBeNull();
    expect(found?.grid?.gridX).toBe(60);
  });
});
