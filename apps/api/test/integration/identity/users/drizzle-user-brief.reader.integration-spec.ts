import { DrizzleUserBriefReader } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user-brief.reader";
import { user, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const ACTIVE_USER_ID = "cbrief0000000000000000001";
const DELETED_USER_ID = "cbrief0000000000000000002";
const LOCKED_USER_ID = "cbrief0000000000000000003";
const MISSING_USER_ID = "cbrief0000000000000000009";

describe("DrizzleUserBriefReader (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzleUserBriefReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    reader = new DrizzleUserBriefReader(createDatabaseTransactionFixture(client).transactionHost);
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      createUserRowFixture({ id: ACTIVE_USER_ID, userTag: "BRIEF001" }),
      createUserRowFixture({
        id: DELETED_USER_ID,
        userTag: "BRIEF002",
        deletedAt: Temporal.Instant.from("2026-10-01T00:00:00Z"),
      }),
      createUserRowFixture({ id: LOCKED_USER_ID, userTag: "BRIEF003", status: "LOCKED" }),
    ]);
    await client
      .insert(userProfile)
      .values({ userId: ACTIVE_USER_ID, name: "김지수", profileImage: "https://cdn.aido/1.png" });
  });

  afterAll(async () => {
    await database.stop();
  });

  it("탈퇴 대기이거나 활성 상태가 아닌 사용자와 없는 사용자는 활성 사용자로 보지 않는다", async () => {
    // When
    const exists = [
      await reader.existsActiveUser(UserId.reconstitute(ACTIVE_USER_ID)),
      await reader.existsActiveUser(UserId.reconstitute(DELETED_USER_ID)),
      await reader.existsActiveUser(UserId.reconstitute(LOCKED_USER_ID)),
      await reader.existsActiveUser(UserId.reconstitute(MISSING_USER_ID)),
    ];

    // Then
    expect(exists).toEqual([true, false, false, false]);
  });

  it("id 묶음을 한 번에 읽어 프로필과 탈퇴 대기를 채우고 없는 id는 뺀다", async () => {
    // When
    const briefs = await reader.findByUserIds(
      [ACTIVE_USER_ID, DELETED_USER_ID, MISSING_USER_ID].map((userId) =>
        UserId.reconstitute(userId),
      ),
    );

    // Then
    expect(briefs.toSorted((left, right) => left.userTag.localeCompare(right.userTag))).toEqual([
      {
        userId: UserId.reconstitute(ACTIVE_USER_ID),
        userTag: "BRIEF001",
        name: "김지수",
        profileImage: "https://cdn.aido/1.png",
        isDeletionPending: false,
      },
      {
        userId: UserId.reconstitute(DELETED_USER_ID),
        userTag: "BRIEF002",
        name: null,
        profileImage: null,
        isDeletionPending: true,
      },
    ]);
  });
});
