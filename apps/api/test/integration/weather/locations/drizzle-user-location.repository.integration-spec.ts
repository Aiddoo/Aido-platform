import { count, eq, sql } from "drizzle-orm";

import { DrizzleUserLocationRepository } from "#api/modules/weather/locations/infrastructure/persistence/drizzle-user-location.repository";
import { databaseSqlState } from "#api/platform/database/database-error.util";
import { user, userLocation } from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { describeUserLocationRepositoryContract } from "#test/contracts/weather/user-location-repository.contract";
import { UserFixture } from "#test/fixtures/user.fixture";
import {
  createUserLocationFixture,
  USER_LOCATION_FIXTURE_OTHER_USER_ID,
  USER_LOCATION_FIXTURE_USER_ID,
} from "#test/fixtures/weather/user-location.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const USER_ID = UserId.reconstitute(USER_LOCATION_FIXTURE_USER_ID);
const BUSAN = { latitude: 35.1796, longitude: 129.0756, gridX: 98, gridY: 76 } as const;

describe("DrizzleUserLocationRepository (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
  let client: TestDatabaseClient;
  let uow: UnitOfWorkPort;

  beforeAll(async () => {
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      UserFixture.create({
        id: USER_LOCATION_FIXTURE_USER_ID,
        email: "weather-owner@example.com",
        userTag: "WEATHER1",
      }),
      UserFixture.create({
        id: USER_LOCATION_FIXTURE_OTHER_USER_ID,
        email: "weather-other@example.com",
        userTag: "WEATHER2",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleUserLocationRepository {
    const transaction = createDatabaseTransactionFixture(client);
    uow = transaction.uow;
    return new DrizzleUserLocationRepository(transaction.txHost);
  }

  describeUserLocationRepositoryContract(async () => createRepository());

  it("반복 저장은 기존 행 ID를 보존하고 다른 사용자의 위치를 바꾸지 않는다", async () => {
    // Given
    const repository = createRepository();
    await repository.save(createUserLocationFixture());
    await repository.save(
      createUserLocationFixture({ userId: USER_LOCATION_FIXTURE_OTHER_USER_ID }),
    );
    const before = await client.query.userLocation.findFirst({
      where: { userId: USER_LOCATION_FIXTURE_USER_ID },
      columns: { id: true },
    });

    // When
    await repository.save(createUserLocationFixture(BUSAN));

    // Then
    expect(
      await client.query.userLocation.findFirst({
        where: { userId: USER_LOCATION_FIXTURE_USER_ID },
        columns: { id: true },
      }),
    ).toEqual(before);
    const other = await repository.findByUserId(
      UserId.reconstitute(USER_LOCATION_FIXTURE_OTHER_USER_ID),
    );
    expect(other?.grid?.gridX).toBe(60);
    expect(await client.select({ count: count() }).from(userLocation)).toEqual([{ count: 2 }]);
  });

  it("두 저장이 실제 unique 잠금에서 대기해도 행 한 개와 완전한 좌표·격자 후보가 남는다", async () => {
    // Given
    const repository = createRepository();
    const seoul = createUserLocationFixture();
    const busan = createUserLocationFixture(BUSAN);
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holder = createDatabaseTransactionFixture(client);
    const holding = holder.uow.run(async () => {
      await new DrizzleUserLocationRepository(holder.txHost).save(seoul);
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
    const outcomes = Promise.allSettled([repository.save(seoul), repository.save(busan)]);
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
    const found = await repository.findByUserId(USER_ID);
    expect([seoul.toPrimitives(), busan.toPrimitives()]).toContainEqual(found?.toPrimitives());
    expect(
      await client
        .select({ count: count() })
        .from(userLocation)
        .where(eq(userLocation.userId, USER_LOCATION_FIXTURE_USER_ID)),
    ).toEqual([{ count: 1 }]);
  });

  it("상위 transaction 실패는 신규 위치를 rollback한다", async () => {
    // Given
    const repository = createRepository();
    const failure = new Error("rollback-weather-insert");

    // When
    const outcome = uow.run(async () => {
      await repository.save(createUserLocationFixture());
      throw failure;
    });

    // Then
    await expect(outcome).rejects.toBe(failure);
    expect(await repository.findByUserId(USER_ID)).toBeNull();
  });

  it("상위 transaction 실패는 기존 위치 변경을 rollback한다", async () => {
    // Given
    const repository = createRepository();
    await repository.save(createUserLocationFixture());
    const failure = new Error("rollback-weather-update");

    // When
    const outcome = uow.run(async () => {
      await repository.save(createUserLocationFixture(BUSAN));
      throw failure;
    });

    // Then
    await expect(outcome).rejects.toBe(failure);
    expect((await repository.findByUserId(USER_ID))?.grid?.gridX).toBe(60);
  });

  it("없는 사용자 위치 저장은 실제 FK 오류이며 orphan 위치를 남기지 않는다", async () => {
    // Given
    const repository = createRepository();
    const absentUserId = createEntityId();

    // When
    const result = await repository
      .save(createUserLocationFixture({ userId: absentUserId }))
      .catch((error: unknown) => error);

    // Then
    expect(databaseSqlState(result)).toBe("23503");
    expect(await repository.findByUserId(UserId.reconstitute(absentUserId))).toBeNull();
  });

  it("사용자 삭제 cascade는 해당 위치만 지우고 다른 위치를 보존한다", async () => {
    // Given
    const repository = createRepository();
    await repository.save(createUserLocationFixture());
    await repository.save(
      createUserLocationFixture({ userId: USER_LOCATION_FIXTURE_OTHER_USER_ID }),
    );

    // When
    await client.delete(user).where(eq(user.id, USER_LOCATION_FIXTURE_USER_ID));

    // Then
    expect(await repository.findByUserId(USER_ID)).toBeNull();
    expect(
      await repository.findByUserId(UserId.reconstitute(USER_LOCATION_FIXTURE_OTHER_USER_ID)),
    ).not.toBeNull();
  });

  it("v2 이전 행처럼 시간대가 null이고 갱신 시각이 ms 3자리 UTC인 행도 그대로 읽는다", async () => {
    // Given
    const repository = createRepository();
    await client.insert(userLocation).values({
      userId: USER_LOCATION_FIXTURE_USER_ID,
      latitude: 37.5665,
      longitude: 126.978,
      gridX: 60,
      gridY: 127,
      updatedAt: Temporal.Instant.from("2026-11-10T01:02:03.456Z"),
    });

    // When
    const found = await repository.findByUserId(USER_ID);

    // Then
    expect(found?.timezone).toBeNull();
    expect(found?.toPrimitives().updatedAt.toString()).toBe("2026-11-10T01:02:03.456Z");
  });
});
