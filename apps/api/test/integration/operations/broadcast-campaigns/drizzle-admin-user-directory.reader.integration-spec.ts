import { DrizzleAdminUserDirectoryReader } from "#api/modules/operations/broadcast-campaigns/infrastructure/persistence/drizzle-admin-user-directory.reader";
import { pushToken, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const END = Temporal.Instant.from("2026-10-08T15:00:00Z");

describe("DrizzleAdminUserDirectoryReader — 브로드캐스트 대상 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let directory: DrizzleAdminUserDirectoryReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    const { transactionHost } = createDatabaseTransactionFixture(client);
    directory = new DrizzleAdminUserDirectoryReader(transactionHost, new FixedClock(END));
  });
  afterAll(async () => database?.stop());
  beforeEach(async () => {
    await database.cleanup();
  });

  it("500명 경계를 넘는 전체 대상은 cursor로 활성 사용자만 ID 순서대로 누락과 중복 없이 나눈다", async () => {
    // Given
    const activeUsers = Array.from({ length: 501 }, (_, index) =>
      createUserRowFixture({ id: `active-${String(index).padStart(4, "0")}` }),
    );
    await client
      .insert(user)
      .values([
        ...activeUsers,
        createUserRowFixture({ status: "SUSPENDED" }),
        createUserRowFixture({ deletedAt: END }),
      ]);

    // When
    const firstPage = await directory.listTargetUserIdsAfter({
      filter: "ALL",
      cursorUserId: null,
      limit: 500,
    });
    const secondPage = await directory.listTargetUserIdsAfter({
      filter: "ALL",
      cursorUserId: firstPage.at(-1) ?? null,
      limit: 500,
    });
    const total = await directory.countTargets("ALL");

    // Then
    expect([firstPage.length, secondPage.length]).toEqual([500, 1]);
    expect([...firstPage, ...secondPage].map((userId) => userId.value)).toEqual(
      activeUsers.map((item) => item.id),
    );
    expect(total).toBe(501);
  });

  it("지정 발송은 기존 상태 필터를 바꾸지 않고 삭제되거나 없는 사용자만 제외한다", async () => {
    // Given
    const active = createUserRowFixture();
    const suspended = createUserRowFixture({ status: "SUSPENDED" });
    const deleted = createUserRowFixture({ deletedAt: END });
    await client.insert(user).values([active, suspended, deleted]);

    // When
    const ids = (
      await directory.listExistingUserIds(
        [active.id, suspended.id, deleted.id, "missing-user", active.id].map((id) =>
          UserId.reconstitute(id),
        ),
      )
    ).map((userId) => userId.value);

    // Then
    expect(ids.toSorted()).toEqual([active.id, suspended.id].toSorted());
  });

  it("푸시 토큰 대상은 토큰이 있는 활성 사용자만 세고 고른다", async () => {
    // Given
    const withToken = createUserRowFixture({ id: "token-user" });
    const withoutToken = createUserRowFixture({ id: "no-token-user" });
    const suspendedWithToken = createUserRowFixture({ id: "suspended-user", status: "SUSPENDED" });
    await client.insert(user).values([withToken, withoutToken, suspendedWithToken]);
    await client.insert(pushToken).values(
      [withToken, suspendedWithToken].map(({ id }) => ({
        userId: id,
        token: `fake-directory-${id}`,
        deviceId: `directory-device-${id}`,
        platform: "IOS" as const,
        updatedAt: END,
      })),
    );

    // When
    const ids = await directory.listTargetUserIdsAfter({
      filter: "WITH_PUSH_TOKEN",
      cursorUserId: null,
      limit: 500,
    });
    const total = await directory.countTargets("WITH_PUSH_TOKEN");

    // Then
    expect(ids.map((userId) => userId.value)).toEqual(["token-user"]);
    expect(total).toBe(1);
  });

  it("최근 7일 활동 대상은 기준 시각 7일 전 이후에 로그인한 사용자다", async () => {
    // Given
    await client.insert(user).values([
      createUserRowFixture({ id: "recent-user", lastLoginAt: END.subtract({ hours: 7 * 24 }) }),
      createUserRowFixture({
        id: "stale-user",
        lastLoginAt: END.subtract({ hours: 7 * 24, milliseconds: 1 }),
      }),
    ]);

    // When
    const ids = await directory.listTargetUserIdsAfter({
      filter: "ACTIVE_LAST_7_DAYS",
      cursorUserId: null,
      limit: 500,
    });

    // Then
    expect(ids.map((userId) => userId.value)).toEqual(["recent-user"]);
  });
});
