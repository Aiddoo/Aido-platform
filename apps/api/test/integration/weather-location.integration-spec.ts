import { ErrorCode } from "@aido/api/errors";

import { UpsertLocation } from "#api/modules/weather/application/use-cases/forecast/upsert-location.use-case";
import { UserLocation } from "#api/modules/weather/domain/entities/forecast/user-location.entity";
import { Coordinate } from "#api/modules/weather/domain/value-objects/forecast/coordinate.vo";
import { KmaWeatherGridResolver } from "#api/modules/weather/infrastructure/adapters/forecast/kma-weather-grid.resolver";
import { WeatherCacheAdapter } from "#api/modules/weather/infrastructure/adapters/forecast/weather-cache.adapter";
import { PrismaWeatherLocationRepository } from "#api/modules/weather/infrastructure/persistence/forecast/prisma-weather-location.repository";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import { encodeCreate } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
import { databaseSqlState } from "#api/platform/database/prisma-error.util";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserFixture } from "#test/fixtures/user.fixture";
import {
  createDatabaseTransactionFixture,
  createTestClient,
  withDatabaseTransaction,
} from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const resolver = new KmaWeatherGridResolver();
function location(userId: string, latitude = 37.5665, longitude = 126.978): UserLocation {
  const coordinate = Coordinate.of(latitude, longitude);
  return UserLocation.create(userId, coordinate, resolver.resolveGrid(coordinate));
}

function coordinates(saved: UserLocation | null) {
  if (saved === null) return null;
  return {
    latitude: saved.latitude,
    longitude: saved.longitude,
    gridX: saved.gridX,
    gridY: saved.gridY,
  };
}

describe("Weather 위치 저장·unique·외래 키·rollback (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
  let client: TestDatabaseClient;
  let repository: PrismaWeatherLocationRepository;
  let uow: UnitOfWorkPort;
  let userId: string;
  let anotherUserId: string;

  beforeAll(async () => {
    client = await database.start();
    const transaction = createDatabaseTransactionFixture(client);
    repository = new PrismaWeatherLocationRepository(transaction.txHost);
    uow = transaction.uow;
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    userId = createEntityId();
    anotherUserId = createEntityId();
    await client.orm.public.User.createAndCount([
      encodeCreate(
        "User",
        UserFixture.create({ id: userId, email: "weather-owner@example.com", userTag: "WEATHER1" }),
      ),
      encodeCreate(
        "User",
        UserFixture.create({
          id: anotherUserId,
          email: "weather-other@example.com",
          userTag: "WEATHER2",
        }),
      ),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  it("위치가 없으면 null이며 다른 사용자의 위치를 반환하지 않는다", async () => {
    // Given
    await repository.upsert(location(anotherUserId));
    // When / Then
    expect(await repository.findByUserId(userId)).toBeNull();
  });

  it("위치를 처음 저장하면 좌표·격자 전체를 readback하고 사용자당 행 한 개다", async () => {
    // Given / When
    const saved = await repository.upsert(location(userId));
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
      await client.orm.public.UserLocation.where({ userId }).aggregate((a) => ({
        count: a.count(),
      })),
    ).toEqual({ count: 1 });
  });

  it("반복 upsert는 기존 행 ID를 보존하고 다른 사용자의 위치를 바꾸지 않는다", async () => {
    // Given
    await repository.upsert(location(userId));
    await repository.upsert(location(anotherUserId));
    const before = await client.orm.public.UserLocation.where({ userId }).select("id").first();
    // When
    const saved = await repository.upsert(location(userId, 35.1796, 129.0756));
    // Then
    expect(coordinates(saved)).toEqual({
      latitude: 35.1796,
      longitude: 129.0756,
      gridX: 98,
      gridY: 76,
    });
    expect(await client.orm.public.UserLocation.where({ userId }).select("id").first()).toEqual(
      before,
    );
    expect(coordinates(await repository.findByUserId(anotherUserId))).toEqual({
      latitude: 37.5665,
      longitude: 126.978,
      gridX: 60,
      gridY: 127,
    });
    expect(await client.orm.public.UserLocation.aggregate((a) => ({ count: a.count() }))).toEqual({
      count: 2,
    });
  });

  it("두 upsert가 실제 unique 잠금에서 대기해도 행 한 개와 완전한 좌표·격자 후보가 남는다", async () => {
    // Given: 미커밋 위치를 유지해 두 upsert가 같은 unique conflict에서 실제로 대기한다.
    const seoul = location(userId);
    const busan = location(userId, 35.1796, 129.0756);
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (tx) => {
      const transaction = createDatabaseTransactionFixture(tx);
      await new PrismaWeatherLocationRepository(transaction.txHost).upsert(seoul);
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
          const waiting = await client
            .runtime()
            .query(
              client.raw
                .sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`
                .returnsRow({ count: "pg/int4@1" })
                .build(),
            );
          expect(waiting[0]?.count).toBe(2);
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
      await client.orm.public.UserLocation.where({ userId }).aggregate((a) => ({
        count: a.count(),
      })),
    ).toEqual({ count: 1 });
  });

  it("상위 transaction 실패는 신규 위치를 rollback한다", async () => {
    // Given
    const failure = new Error("rollback-weather-insert");
    // When / Then
    await expect(
      uow.run(async () => {
        await repository.upsert(location(userId));
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(await repository.findByUserId(userId)).toBeNull();
  });

  it("상위 transaction 실패는 기존 위치 변경을 rollback한다", async () => {
    // Given
    await repository.upsert(location(userId));
    const failure = new Error("rollback-weather-update");
    // When / Then
    await expect(
      uow.run(async () => {
        await repository.upsert(location(userId, 35.1796, 129.0756));
        throw failure;
      }),
    ).rejects.toBe(failure);
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
    await client.orm.public.User.where({ id: userId }).deleteAndCount();
    // Then
    expect(await repository.findByUserId(userId)).toBeNull();
    expect(await repository.findByUserId(anotherUserId)).not.toBeNull();
  });

  it("실제 위치 변경은 이전 격자의 날짜별 조건 캐시를 무효화하고 새 위치를 보존한다", async () => {
    // Given
    const memory = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    const cache = new WeatherCacheAdapter(new CacheService(memory));
    const update = new UpsertLocation({
      weatherLocationRepository: repository,
      weatherCache: cache,
      weatherGridResolver: resolver,
    });
    const date = new Date("2026-07-23T00:00:00Z");
    try {
      await repository.upsert(location(userId));
      await cache.setConditions(60, 127, date, {
        feelsLikeTemperature: 25,
        uvIndex: 1,
        sunrise: "05:23",
        sunset: "19:00",
        pm10: 10,
        pm25: 5,
      });
      // When
      await update.execute({ userId, latitude: 35.1796, longitude: 129.0756 });
      // Then
      expect(await cache.getConditions(60, 127, date)).toBeUndefined();
      expect(coordinates(await repository.findByUserId(userId))).toEqual(
        coordinates(location(userId, 35.1796, 129.0756)),
      );
      await expect(
        update.execute({ userId, latitude: 48.8566, longitude: 2.3522 }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
      expect(coordinates(await repository.findByUserId(userId))).toEqual(
        coordinates(location(userId, 35.1796, 129.0756)),
      );
    } finally {
      memory.onModuleDestroy();
    }
  });
});
