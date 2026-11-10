import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { DrizzleInviteRepository } from "#api/modules/social/invites/infrastructure/persistence/drizzle-invite.repository";
import { isUniqueConstraintViolation } from "#api/platform/database/database-error.util";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeInviteRepositoryContract } from "#test/contracts/social/invite-repository.contract";
import {
  createInviteFixture,
  INVITE_FIXTURE_INVITER_ID,
  insertInviteFixtureRows,
} from "#test/fixtures/social/invite.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleInviteRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await insertInviteFixtureRows(client);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleInviteRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleInviteRepository(txHost);
  }

  describeInviteRepositoryContract(async () => createRepository());

  it("한 사람에게 ACTIVE 초대는 하나만 저장된다", async () => {
    // Given
    const repository = createRepository();
    await repository.add(createInviteFixture({ id: (await repository.nextId()).value }));
    const second = createInviteFixture({ id: (await repository.nextId()).value, code: "B2C3D4" });

    // When
    const added = repository.add(second);

    // Then
    await expect(added).rejects.toSatisfy(isUniqueConstraintViolation);
  });

  it("탈퇴 대기 중인 사람의 초대는 코드로 찾지 않는다", async () => {
    // Given
    const repository = createRepository();
    const invite = createInviteFixture({ id: (await repository.nextId()).value });
    await repository.add(invite);
    await client
      .update(user)
      .set({ deletedAt: Temporal.Instant.from("2028-02-28T04:00:00Z") })
      .where(eq(user.id, INVITE_FIXTURE_INVITER_ID));

    // When
    const found = await repository.findByCodeWithInviter(invite.code);

    // Then
    expect(found).toBeNull();
  });

  it("프로세스 TZ가 Asia/Seoul이어도 세션은 UTC이고 발급 시각이 ms까지 그대로 왕복한다", async () => {
    // Given
    vi.stubEnv("TZ", "Asia/Seoul");
    const repository = createRepository();
    const createdAt = Temporal.Instant.from("2028-02-29T23:59:59.123Z");
    const invite = createInviteFixture({ id: (await repository.nextId()).value, createdAt });

    // When
    await repository.add(invite);
    const { rows } = await client.execute<{ TimeZone: string }>(sql`SHOW TimeZone`);
    const found = await repository.findActiveByInviterId(
      UserId.reconstitute(INVITE_FIXTURE_INVITER_ID),
    );

    // Then
    expect(z.array(z.object({ TimeZone: z.string() })).parse(rows)).toEqual([{ TimeZone: "UTC" }]);
    expect(found?.createdAt.equals(createdAt)).toBe(true);
  });
});
