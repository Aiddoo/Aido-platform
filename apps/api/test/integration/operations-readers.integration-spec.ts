import { DrizzleSignupStatsReader } from "#api/modules/operations/admin-notices/infrastructure/persistence/drizzle-signup-stats.reader";
import { DrizzleAdminUserDirectoryReader } from "#api/modules/operations/broadcasts/infrastructure/persistence/drizzle-admin-user-directory.reader";
import { account, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const START = Temporal.Instant.from("2026-10-07T15:00:00Z");
const END = Temporal.Instant.from("2026-10-08T15:00:00Z");

describe("운영 조회 계약 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let directory: DrizzleAdminUserDirectoryReader;
  let signupStats: DrizzleSignupStatsReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    const { txHost } = createDatabaseTransactionFixture(client);
    directory = new DrizzleAdminUserDirectoryReader(txHost, new FixedClock(END));
    signupStats = new DrizzleSignupStatsReader(txHost);
  });
  afterAll(async () => database?.stop());
  beforeEach(async () => {
    await database.cleanup();
    UserFixture.reset();
    AccountFixture.reset();
  });

  it("한국 날짜에 가입한 사용자를 첫 계정 공급자로 세고 경계는 시작 포함·끝 제외다", async () => {
    // Given
    const signups = [
      { provider: "CREDENTIAL", createdAt: START.subtract({ milliseconds: 1 }) },
      { provider: "CREDENTIAL", createdAt: START },
      { provider: "GOOGLE", createdAt: START.add({ milliseconds: 1 }) },
      { provider: "GOOGLE", createdAt: END },
    ] as const;
    for (const signup of signups) {
      const created = UserFixture.create({ createdAt: signup.createdAt });
      await client.insert(user).values(created);
      await client.insert(account).values(AccountFixture.create({ ...signup, userId: created.id }));
    }

    // When
    const stats = await signupStats.getSignupStats(START, END);

    // Then
    expect(
      stats.signupsByProvider.toSorted((a, b) => a.provider.localeCompare(b.provider)),
    ).toEqual([
      { provider: "CREDENTIAL", count: 1 },
      { provider: "GOOGLE", count: 1 },
    ]);
  });

  it("기존 사용자가 그날 다른 공급자를 연동해도 가입으로 세지 않는다", async () => {
    // Given
    const existing = UserFixture.create({ createdAt: START.subtract({ hours: 24 }) });
    await client.insert(user).values(existing);
    await client.insert(account).values([
      AccountFixture.create({
        userId: existing.id,
        provider: "KAKAO",
        createdAt: existing.createdAt,
      }),
      AccountFixture.create({
        userId: existing.id,
        provider: "GOOGLE",
        createdAt: START.add({ hours: 1 }),
      }),
    ]);

    // When
    const stats = await signupStats.getSignupStats(START, END);

    // Then
    expect(stats.signupsByProvider).toEqual([]);
    expect(stats.totalUsers).toBe(1);
  });

  it("전체 사용자에서 인증 계정 없는 내부 사용자와 탈퇴한 사용자를 뺀다", async () => {
    // Given
    const active = UserFixture.create();
    const deleted = UserFixture.create({ deletedAt: START });
    await client.insert(user).values([active, deleted, UserFixture.create()]);
    await client
      .insert(account)
      .values([
        AccountFixture.create({ userId: active.id, provider: "KAKAO" }),
        AccountFixture.create({ userId: deleted.id, provider: "GOOGLE" }),
      ]);

    // When
    const stats = await signupStats.getSignupStats(START, END);

    // Then
    expect(stats.totalUsers).toBe(1);
  });

  it("500명 경계를 넘는 전체 대상은 cursor로 활성 사용자만 ID 순서대로 누락과 중복 없이 나눈다", async () => {
    // Given
    const activeUsers = Array.from({ length: 501 }, (_, index) =>
      UserFixture.create({ id: `active-${String(index).padStart(4, "0")}` }),
    );
    await client
      .insert(user)
      .values([
        ...activeUsers,
        UserFixture.create({ status: "SUSPENDED" }),
        UserFixture.create({ deletedAt: END }),
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
    const active = UserFixture.create();
    const suspended = UserFixture.create({ status: "SUSPENDED" });
    const deleted = UserFixture.create({ deletedAt: END });
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
});
