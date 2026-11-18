import { asc } from "drizzle-orm";

import { DrizzleOAuthStateRepository } from "#api/modules/identity/oauth-states/infrastructure/persistence/drizzle-oauth-state.repository";
import { DrizzleLoginAttemptRepository } from "#api/modules/identity/sessions/infrastructure/persistence/drizzle-login-attempt.repository";
import { DrizzleSessionRepository } from "#api/modules/identity/sessions/infrastructure/persistence/drizzle-session.repository";
import { PurgeExpiredIdentityRecordsUseCase } from "#api/modules/identity/users/application/use-cases/purge-expired-identity-records.use-case";
import { DrizzleSecurityLogRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-security-log.repository";
import { DrizzleVerificationRepository } from "#api/modules/identity/verifications/infrastructure/persistence/drizzle-verification.repository";
import {
  loginAttempt,
  oAuthState,
  pushDevice,
  pushToken,
  securityLog,
  session,
  user,
  verification,
} from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createSessionRowFixture } from "#test/fixtures/identity/session-row.fixture";
import { AUTH_FIXTURE_NOW, AUTH_FIXTURE_USER_ID } from "#test/fixtures/identity/session.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createVerificationRowFixture } from "#test/fixtures/identity/verification-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const NOW = AUTH_FIXTURE_NOW;

function daysAgo(days: number): Temporal.Instant {
  return NOW.subtract({ hours: 24 * days });
}

function justOverDaysAgo(days: number): Temporal.Instant {
  return daysAgo(days).subtract({ milliseconds: 1 });
}

describe("PurgeExpiredIdentityRecordsUseCase (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values(
      createUserRowFixture({
        id: AUTH_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "PURGE001",
      }),
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  function createUseCase(batchSize?: number): PurgeExpiredIdentityRecordsUseCase {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    const encryption = new EncryptionService({
      key: "test-token-encryption-key-minimum-32-characters-long",
      salt: undefined,
    });
    return new PurgeExpiredIdentityRecordsUseCase({
      sessionRepository: new DrizzleSessionRepository(transactionHost),
      loginAttemptRepository: new DrizzleLoginAttemptRepository(client),
      verificationRepository: new DrizzleVerificationRepository(transactionHost, client),
      oauthStateRepository: new DrizzleOAuthStateRepository(transactionHost, encryption),
      securityLogRepository: new DrizzleSecurityLogRepository(transactionHost),
      clock: new FixedClock(NOW),
      logger: new SilentLogger(),
      batchSize,
    });
  }

  async function insertSession(
    id: string,
    ended: { revokedAt?: Temporal.Instant; expiresAt: Temporal.Instant },
  ): Promise<void> {
    await client.insert(session).values(
      createSessionRowFixture({
        id,
        userId: AUTH_FIXTURE_USER_ID,
        revokedAt: ended.revokedAt ?? null,
        revokedReason: ended.revokedAt == null ? null : "USER_LOGOUT",
        expiresAt: ended.expiresAt,
      }),
    );
  }

  async function bindPushDevice(sessionId: string): Promise<void> {
    await client.insert(pushDevice).values({
      deviceId: `device-${sessionId}`,
      permissionCanAskAgain: false,
      permissionStatus: "GRANTED",
      platform: "IOS",
      reportedAt: daysAgo(40),
      sessionId,
      updatedAt: daysAgo(40),
      userId: AUTH_FIXTURE_USER_ID,
    });
  }

  async function bindPushToken(sessionId: string): Promise<void> {
    await client.insert(pushToken).values({
      deviceId: `device-${sessionId}`,
      platform: "ANDROID",
      sessionId,
      token: `ExponentPushToken[${sessionId}]`,
      updatedAt: daysAgo(40),
      userId: AUTH_FIXTURE_USER_ID,
    });
  }

  async function insertOAuthState(state: string, expiresAt: Temporal.Instant): Promise<void> {
    await client
      .insert(oAuthState)
      .values({ state, provider: "GOOGLE", redirectUri: "aido://auth/callback", expiresAt });
  }

  async function insertSecurityLog(
    event: "LOGIN_SUCCESS" | "LOGOUT",
    createdAt: Temporal.Instant,
  ): Promise<void> {
    await client
      .insert(securityLog)
      .values({ event, ipAddress: "127.0.0.1", userAgent: "Aido/1.16.0", createdAt });
  }

  async function remainingRows() {
    const [sessions, attempts, verifications, states, logs, devices, tokens] = await Promise.all([
      client.select({ id: session.id }).from(session),
      client.select({ email: loginAttempt.email }).from(loginAttempt).orderBy(asc(loginAttempt.id)),
      client.select({ token: verification.token }).from(verification).orderBy(asc(verification.id)),
      client.select({ state: oAuthState.state }).from(oAuthState).orderBy(asc(oAuthState.id)),
      client.select({ event: securityLog.event }).from(securityLog).orderBy(asc(securityLog.id)),
      client.select({ sessionId: pushDevice.sessionId }).from(pushDevice),
      client.select({ sessionId: pushToken.sessionId }).from(pushToken),
    ]);
    return {
      sessions: sessions.map((row) => row.id).toSorted(),
      attempts: attempts.map((row) => row.email),
      verifications: verifications.map((row) => row.token),
      states: states.map((row) => row.state),
      logs: logs.map((row) => row.event),
      devices: devices.map((row) => row.sessionId),
      tokens: tokens.map((row) => row.sessionId),
    };
  }

  it("보관 기한을 1ms라도 넘긴 행만 지우고 기한 경계·쓰는 세션·푸시 기기가 남은 만료 세션은 둔다", async () => {
    // Given
    await insertSession("revoked-at-boundary", { revokedAt: daysAgo(30), expiresAt: daysAgo(23) });
    await insertSession("revoked-over", {
      revokedAt: justOverDaysAgo(30),
      expiresAt: daysAgo(23),
    });
    await insertSession("revoked-with-device", { revokedAt: daysAgo(31), expiresAt: daysAgo(24) });
    await insertSession("expired-at-boundary", { expiresAt: daysAgo(30) });
    await insertSession("expired-over", { expiresAt: justOverDaysAgo(30) });
    await insertSession("expired-with-device", { expiresAt: daysAgo(60) });
    await insertSession("expired-with-token", { expiresAt: daysAgo(60) });
    await insertSession("in-use", { expiresAt: NOW.add({ hours: 24 * 7 }) });
    await bindPushDevice("revoked-with-device");
    await bindPushDevice("expired-with-device");
    await bindPushToken("expired-with-token");
    await client.insert(loginAttempt).values([
      {
        email: "attempt-over@example.com",
        ipAddress: "127.0.0.1",
        userAgent: "Aido/1.16.0",
        success: false,
        createdAt: justOverDaysAgo(90),
      },
      {
        email: "attempt-boundary@example.com",
        ipAddress: "127.0.0.1",
        userAgent: "Aido/1.16.0",
        success: true,
        createdAt: daysAgo(90),
      },
    ]);
    await client.insert(verification).values([
      createVerificationRowFixture({
        userId: AUTH_FIXTURE_USER_ID,
        token: "code-over",
        expiresAt: justOverDaysAgo(1),
      }),
      createVerificationRowFixture({
        userId: AUTH_FIXTURE_USER_ID,
        token: "code-boundary",
        expiresAt: daysAgo(1),
      }),
    ]);
    await insertOAuthState("state-over", justOverDaysAgo(1));
    await insertOAuthState("state-boundary", daysAgo(1));
    await insertSecurityLog("LOGIN_SUCCESS", justOverDaysAgo(365));
    await insertSecurityLog("LOGOUT", daysAgo(365));

    // When
    await createUseCase().execute();

    // Then
    expect(await remainingRows()).toEqual({
      sessions: [
        "expired-at-boundary",
        "expired-with-device",
        "expired-with-token",
        "in-use",
        "revoked-at-boundary",
      ],
      attempts: ["attempt-boundary@example.com"],
      verifications: ["code-boundary"],
      states: ["state-boundary"],
      logs: ["LOGOUT"],
      devices: ["expired-with-device"],
      tokens: ["expired-with-token"],
    });
  });

  it("한 묶음보다 많은 행은 묶음을 이어 모두 지운다", async () => {
    // Given
    const indexes = [1, 2, 3, 4, 5];
    for (const index of indexes) {
      await insertSession(`expired-${index}`, { expiresAt: daysAgo(31) });
      await insertOAuthState(`state-${index}`, daysAgo(2));
      await insertSecurityLog("LOGIN_SUCCESS", daysAgo(366));
    }
    await client.insert(loginAttempt).values(
      indexes.map((index) => ({
        email: `attempt-${index}@example.com`,
        ipAddress: "127.0.0.1",
        userAgent: "Aido/1.16.0",
        success: false,
        createdAt: daysAgo(91),
      })),
    );
    await client.insert(verification).values(
      indexes.map((index) =>
        createVerificationRowFixture({
          userId: AUTH_FIXTURE_USER_ID,
          token: `code-${index}`,
          expiresAt: daysAgo(2),
        }),
      ),
    );
    await insertSession("in-use", { expiresAt: NOW.add({ hours: 24 * 7 }) });

    // When
    await createUseCase(2).execute();

    // Then
    expect(await remainingRows()).toEqual({
      sessions: ["in-use"],
      attempts: [],
      verifications: [],
      states: [],
      logs: [],
      devices: [],
      tokens: [],
    });
  });
});
