import { eq } from "drizzle-orm";
import { z } from "zod";

import { DrizzleSecurityLogRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-security-log.repository";
import { securityLog, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeAuthSecurityLogRepositoryContract } from "#test/contracts/identity/auth-security-log-repository.contract";
import type { SecurityLogRecord } from "#test/doubles/identity/in-memory-auth-security-log.repository";
import {
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/auth-session.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const metadataSchema = z.record(z.string(), z.unknown());

describe("DrizzleSecurityLogRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      UserFixture.create({
        id: AUTH_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "AUTHOWN1",
      }),
      UserFixture.create({
        id: AUTH_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "AUTHOTH1",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleSecurityLogRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleSecurityLogRepository(txHost);
  }

  async function listEntries(): Promise<SecurityLogRecord[]> {
    const rows = await client.query.securityLog.findMany({ orderBy: { id: "asc" } });
    return rows.map((row) => ({
      ...(row.userId == null ? {} : { userId: row.userId }),
      event: row.event,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      ...(row.metadata == null ? {} : { metadata: metadataSchema.parse(row.metadata) }),
    }));
  }

  describeAuthSecurityLogRepositoryContract(async () => ({
    repository: createRepository(),
    listEntries,
  }));

  it("기록 시각은 DB가 남기고 사용자가 지워지면 사용자 칸만 비운다", async () => {
    // Given
    const repository = createRepository();
    await repository.create({
      userId: UserId.reconstitute(AUTH_FIXTURE_OTHER_USER_ID),
      event: "LOGOUT",
      ipAddress: "127.0.0.1",
      userAgent: "Aido/1.15.1",
    });

    // When
    await client.delete(user).where(eq(user.id, AUTH_FIXTURE_OTHER_USER_ID));
    const [row] = await client.select().from(securityLog);

    // Then
    expect(row?.createdAt).toBeInstanceOf(Temporal.Instant);
    expect(row?.userId).toBeNull();
  });
});
