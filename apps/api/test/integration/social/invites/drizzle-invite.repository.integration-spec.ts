import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { DrizzleInviteReader } from "#api/modules/social/invites/infrastructure/persistence/drizzle-invite.reader";
import { DrizzleInviteRepository } from "#api/modules/social/invites/infrastructure/persistence/drizzle-invite.repository";
import { InviteId } from "#api/modules/social/shared/domain/invite-id.vo";
import { isUniqueConstraintViolation } from "#api/platform/database/database-error.util";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeInviteRepositoryContract } from "#test/contracts/social/invite-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
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
    return new DrizzleInviteRepository(txHost, new DateClock());
  }

  function createReader(): DrizzleInviteReader {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleInviteReader(txHost);
  }

  describeInviteRepositoryContract(async () => ({
    repository: createRepository(),
    reader: createReader(),
  }));

  it("한 사람에게 ACTIVE 초대는 하나만 저장된다", async () => {
    // Given
    const repository = createRepository();
    await repository.saveIfCodeUnused(createInviteFixture({ id: InviteId.generate().value }));
    const second = createInviteFixture({ id: InviteId.generate().value, code: "B2C3D4" });

    // When
    const added = repository.saveIfCodeUnused(second);

    // Then
    await expect(added).rejects.toSatisfy(isUniqueConstraintViolation);
  });

  it("탈퇴 대기 중인 사람의 초대는 코드로 찾지 않는다", async () => {
    // Given
    const repository = createRepository();
    const invite = createInviteFixture({ id: InviteId.generate().value });
    await repository.saveIfCodeUnused(invite);
    await client
      .update(user)
      .set({ deletedAt: Temporal.Instant.from("2028-02-28T04:00:00Z") })
      .where(eq(user.id, INVITE_FIXTURE_INVITER_ID));

    // When
    const found = await createReader().findByCodeWithInviter(invite.code);

    // Then
    expect(found).toBeNull();
  });

  it("프로세스 TZ가 Asia/Seoul이어도 세션은 UTC이고 발급 시각이 ms까지 그대로 왕복한다", async () => {
    // Given
    vi.stubEnv("TZ", "Asia/Seoul");
    const repository = createRepository();
    const createdAt = Temporal.Instant.from("2028-02-29T23:59:59.123Z");
    const invite = createInviteFixture({ id: InviteId.generate().value, createdAt });

    // When
    await repository.saveIfCodeUnused(invite);
    const { rows } = await client.execute<{ TimeZone: string }>(sql`SHOW TimeZone`);
    const found = await repository.findActiveByInviterId(
      UserId.reconstitute(INVITE_FIXTURE_INVITER_ID),
    );

    // Then
    expect(z.array(z.object({ TimeZone: z.string() })).parse(rows)).toEqual([{ TimeZone: "UTC" }]);
    expect(found?.createdAt.equals(createdAt)).toBe(true);
  });
});
