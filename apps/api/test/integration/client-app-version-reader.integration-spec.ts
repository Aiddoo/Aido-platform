import { LatestClientAppVersionAdapter } from "#api/modules/ai-assistance/infrastructure/adapters/parsing/latest-client-app-version.adapter";
import { UserRepository } from "#api/modules/identity/infrastructure/persistence/auth/user.repository";
import { PrismaClientAppVersionReader } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-client-app-version.reader";
import { encodeCreate } from "#api/platform/database/database-records";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("사용자 앱 버전 조회 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let userId: string;
  let reader: PrismaClientAppVersionReader;
  let users: UserRepository;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 2 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    const user = UserFixture.create();
    await client.orm.public.User.create(encodeCreate("User", { ...user, status: "ACTIVE" }));
    userId = user.id;
    const { txHost } = createDatabaseTransactionFixture(client);
    reader = new PrismaClientAppVersionReader(txHost);
    users = new UserRepository(txHost);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function addToken(deviceId: string, appVersion: string | null, isActive = true) {
    await client.orm.public.PushToken.create(
      encodeCreate("PushToken", {
        userId,
        token: `ExponentPushToken[${deviceId}]`,
        deviceId,
        platform: "IOS",
        isActive,
        appVersion,
      }),
    );
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
    await users.updateLastActiveAt(userId, "Asia/Seoul", "1.13.0");

    // When - 버전 헤더가 없는 요청
    await users.updateLastActiveAt(userId, "Asia/Seoul");

    // Then
    await expect(users.findLastSeenAppVersion(userId)).resolves.toBe("1.13.0");
  });

  it("푸시 권한이 없어도 인증 요청의 앱 버전으로 사용자의 최신 앱 버전을 안다", async () => {
    // Given - 푸시 토큰은 1.12.1에 멈춰 있고, 1.13.0 앱으로 요청함
    await addToken("old-phone", "1.12.1");
    await users.updateLastActiveAt(userId, "Asia/Seoul", "1.13.0");
    const latest = new LatestClientAppVersionAdapter(reader, users);

    // When / Then
    await expect(latest.findLatestAppVersion(userId)).resolves.toBe("1.13.0");
  });
});
