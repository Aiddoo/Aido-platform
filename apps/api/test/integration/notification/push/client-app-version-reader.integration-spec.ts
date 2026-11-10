import { LatestClientAppVersionAdapter } from "#api/modules/ai-assistance/generation/infrastructure/adapters/latest-client-app-version.adapter";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { DrizzleClientAppVersionReader } from "#api/modules/notification/push/infrastructure/persistence/drizzle-client-app-version.reader";
import { pushToken, user as userTable } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DateClock } from "#test/doubles/platform/date-clock";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// 테스트가 vi.setSystemTime으로 고정한 시각을 그대로 활동 시각으로 쓴다
function seenNow(): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(Date.now());
}

describe("사용자 앱 버전 조회 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let userId: string;
  let reader: DrizzleClientAppVersionReader;
  let users: DrizzleUserRepository;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 2 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    const user = UserFixture.create();
    await client.insert(userTable).values({ ...user, status: "ACTIVE" });
    userId = user.id;
    const { txHost } = createDatabaseTransactionFixture(client);
    reader = new DrizzleClientAppVersionReader(txHost);
    users = new DrizzleUserRepository(txHost, new DateClock());
  });

  afterAll(async () => {
    await database.stop();
  });

  async function addToken(deviceId: string, appVersion: string | null, isActive = true) {
    await client.insert(pushToken).values({
      userId,
      token: `ExponentPushToken[${deviceId}]`,
      deviceId,
      platform: "IOS",
      isActive,
      appVersion,
      updatedAt: Temporal.Now.instant(),
    });
  }

  it("활성 기기 중 가장 높은 앱 버전을 고르고, 비활성·형식이 틀린 버전은 무시한다", async () => {
    // Given
    await addToken("old-phone", "1.12.1");
    await addToken("tablet", "1.13.0");
    await addToken("retired", "2.0.0", false);
    await addToken("broken", "dev-build");
    await addToken("unknown", null);

    // When
    const latest = await reader.findLatestAppVersion(userId);

    // Then
    expect(latest).toBe("1.13.0");
  });

  it("버전을 남긴 기기가 없으면 null이다", async () => {
    // When
    const latest = await reader.findLatestAppVersion(userId);

    // Then
    expect(latest).toBeNull();
  });

  it("인증 요청의 앱 버전은 버전이 없을 때 기존 기록을 지우지 않는다", async () => {
    // Given
    await users.updateLastActiveAt({
      userId: userId,
      timezone: "Asia/Seoul",
      seenAt: seenNow(),
      appVersion: "1.13.0",
    });

    // When
    await users.updateLastActiveAt({ userId: userId, timezone: "Asia/Seoul", seenAt: seenNow() });

    // Then
    await expect(users.findLastSeenAppVersion(userId)).resolves.toBe("1.13.0");
  });

  it("푸시 권한이 없어도 인증 요청의 앱 버전으로 사용자의 최신 앱 버전을 안다", async () => {
    // Given
    await addToken("old-phone", "1.12.1");
    await users.updateLastActiveAt({
      userId: userId,
      timezone: "Asia/Seoul",
      seenAt: seenNow(),
      appVersion: "1.13.0",
    });
    const latest = new LatestClientAppVersionAdapter(reader, users);

    // When
    const version = await latest.findLatestAppVersion(UserId.reconstitute(userId));

    // Then
    expect(version).toBe("1.13.0");
  });
});
