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

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 2 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    const user = UserFixture.create();
    await client.orm.public.User.create(encodeCreate("User", { ...user, status: "ACTIVE" }));
    userId = user.id;
    reader = new PrismaClientAppVersionReader(createDatabaseTransactionFixture(client).txHost);
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
});
