import { ne, sql } from "drizzle-orm";

import type { UserSearchCriteria } from "#api/modules/identity/users/application/ports/user-search.reader.port";
import { DrizzleUserSearchReader } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user-search.reader";
import type { UserExclusionCondition } from "#api/modules/identity/users/infrastructure/persistence/user-conditions.query-fragment";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { UserFixture } from "#test/fixtures/user.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SEARCHER_ID = "csearch000000000000000001";
const FIRST_MATCH_ID = "csearch000000000000000002";
const SECOND_MATCH_ID = "csearch000000000000000003";
const DELETED_MATCH_ID = "csearch000000000000000004";
const LOCKED_MATCH_ID = "csearch000000000000000005";

function criteriaExcluding(
  exclusion: UserExclusionCondition,
): UserSearchCriteria<UserExclusionCondition> {
  return {
    tag: "KIM",
    name: "kim",
    searcherId: UserId.reconstitute(SEARCHER_ID),
    exclusion,
  };
}

describe("DrizzleUserSearchReader (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzleUserSearchReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    reader = new DrizzleUserSearchReader(createDatabaseTransactionFixture(client).transactionHost);
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      UserFixture.create({ id: SEARCHER_ID, userTag: "KIMS0001" }),
      UserFixture.create({ id: FIRST_MATCH_ID, userTag: "KIMA0002" }),
      UserFixture.create({ id: SECOND_MATCH_ID, userTag: "KIMB0003" }),
      UserFixture.create({
        id: DELETED_MATCH_ID,
        userTag: "KIMD0004",
        deletedAt: Temporal.Instant.from("2026-10-01T00:00:00Z"),
      }),
      UserFixture.create({ id: LOCKED_MATCH_ID, userTag: "KIML0005", status: "LOCKED" }),
      UserFixture.create({ userTag: "ZZZZ0006" }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  it("탈퇴 대기·비활성 사용자와 검색한 본인은 결과와 개수에서 빠진다", async () => {
    // Given
    const criteria = criteriaExcluding(() => sql`true`);

    // When
    const [matches, count] = await Promise.all([
      reader.searchActiveUsers({ criteria, after: null, limit: 10 }),
      reader.countActiveUsers(criteria),
    ]);

    // Then
    expect(matches.map((match) => [match.user.userId.value, match.rank])).toEqual([
      [FIRST_MATCH_ID, 1],
      [SECOND_MATCH_ID, 1],
    ]);
    expect(count).toBe(2);
  });

  it("부르는 쪽이 넘긴 제외 조건에 걸린 사용자는 결과와 개수에서 빠진다", async () => {
    // Given
    const criteria = criteriaExcluding((userIdColumn) => ne(userIdColumn, FIRST_MATCH_ID));

    // When
    const [matches, count] = await Promise.all([
      reader.searchActiveUsers({ criteria, after: null, limit: 10 }),
      reader.countActiveUsers(criteria),
    ]);

    // Then
    expect(matches.map((match) => match.user.userId.value)).toEqual([SECOND_MATCH_ID]);
    expect(count).toBe(1);
  });
});
