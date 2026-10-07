import { vi } from "vitest";

import { PrismaAdminUserDirectoryAdapter } from "#api/modules/operations/infrastructure/adapters/admin/prisma-admin-user-directory.adapter";
import { PrismaSignupStatsReader } from "#api/modules/operations/infrastructure/adapters/notifications/prisma-signup-stats.reader";
import { encodeCreate } from "#api/platform/database/database-records";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import { createTestDatabaseService } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const START = new Date("2026-10-07T15:00:00.000Z");
const END = new Date("2026-10-08T15:00:00.000Z");

describe("운영 조회 계약 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let directory: PrismaAdminUserDirectoryAdapter;
  let signupStats: PrismaSignupStatsReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    const service = createTestDatabaseService(client);
    directory = new PrismaAdminUserDirectoryAdapter(service);
    signupStats = new PrismaSignupStatsReader(service);
  });
  afterAll(async () => database?.stop());
  beforeEach(async () => {
    await database.cleanup();
    UserFixture.reset();
    AccountFixture.reset();
    vi.setSystemTime(END);
  });
  afterEach(() => vi.useRealTimers());

  it("한국 날짜의 시작은 포함하고 끝은 제외하며 인증 계정 없는 내부 사용자는 전체 가입자에서 제외한다", async () => {
    // Given
    const accounts = [
      { provider: "CREDENTIAL", createdAt: new Date(START.getTime() - 1) },
      { provider: "CREDENTIAL", createdAt: START },
      { provider: "GOOGLE", createdAt: new Date(START.getTime() + 1) },
      { provider: "GOOGLE", createdAt: END },
    ] as const;
    for (const account of accounts) {
      const user = UserFixture.create();
      await client.orm.public.User.create(encodeCreate("User", user));
      await client.orm.public.Account.create(
        encodeCreate("Account", AccountFixture.create({ ...account, userId: user.id })),
      );
    }
    await client.orm.public.User.create(encodeCreate("User", UserFixture.create()));
    // When
    const stats = await signupStats.getSignupStats(START, END);
    // Then
    expect(stats.totalUsers).toBe(4);
    expect(
      stats.signupsByProvider.toSorted((a, b) => a.provider.localeCompare(b.provider)),
    ).toEqual([
      { provider: "CREDENTIAL", count: 1 },
      { provider: "GOOGLE", count: 1 },
    ]);
  });

  it("500명 경계를 넘는 전체 발송은 활성 사용자만 ID 순서대로 누락과 중복 없이 나눈다", async () => {
    // Given
    const activeUsers = Array.from({ length: 501 }, (_, index) =>
      UserFixture.create({ id: `active-${String(index).padStart(4, "0")}` }),
    );
    await client.orm.public.User.createAndCount(
      [
        ...activeUsers,
        UserFixture.create({ status: "SUSPENDED" }),
        UserFixture.create({ deletedAt: END }),
      ].map((user) => encodeCreate("User", user)),
    );
    // When
    const batches = [];
    for await (const batch of directory.streamTargetUserIds("ALL")) batches.push(batch);
    // Then
    expect(batches.map((batch) => batch.length)).toEqual([500, 1]);
    expect(batches.flat()).toEqual(activeUsers.map((user) => user.id));
  });

  it("지정 발송은 기존 상태 필터를 바꾸지 않고 삭제되거나 없는 사용자만 제외한다", async () => {
    // Given
    const active = UserFixture.create();
    const suspended = UserFixture.create({ status: "SUSPENDED" });
    const deleted = UserFixture.create({ deletedAt: END });
    await client.orm.public.User.createAndCount(
      [active, suspended, deleted].map((user) => encodeCreate("User", user)),
    );
    // When
    const ids = await directory.findExistingUserIds([
      active.id,
      suspended.id,
      deleted.id,
      "missing-user",
      active.id,
    ]);
    // Then
    expect(ids.toSorted()).toEqual([active.id, suspended.id].toSorted());
  });
});
