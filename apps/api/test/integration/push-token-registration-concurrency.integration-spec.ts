import { eq } from "drizzle-orm";

import { NotificationDeliveryLogEvent } from "#api/modules/notification/application/observability/delivery/notification-delivery-log.events";
import { RegisterPushToken } from "#api/modules/notification/application/use-cases/delivery/register-push-token.use-case";
import { DrizzlePushTokenRepository } from "#api/modules/notification/infrastructure/persistence/delivery/drizzle-push-token.repository";
import { pushToken, user } from "#api/platform/database/schema/index";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const TOKEN = "ExponentPushToken[concurrent-registration]";

describe("같은 푸시 토큰 동시 등록 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let firstUserId: string;
  let secondUserId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    const firstUser = UserFixture.create();
    const secondUser = UserFixture.create();
    await client.insert(user).values([firstUser, secondUser]);
    firstUserId = firstUser.id;
    secondUserId = secondUser.id;
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRegisterPushToken(
    pushTokenRepository: ConstructorParameters<typeof RegisterPushToken>[0]["pushTokenRepository"],
    unitOfWork: ConstructorParameters<typeof RegisterPushToken>[0]["unitOfWork"],
  ) {
    const warnings: unknown[] = [];
    const registerPushToken = new RegisterPushToken({
      pushTokenRepository,
      unitOfWork,
      pushProvider: { validateToken: () => true },
      userSettings: { upsertPushLocale: async () => {}, upsertPushTimezone: async () => {} },
      cache: { invalidatePushTokens: async () => {}, invalidateUserPreference: async () => {} },
      logger: {
        log() {},
        warn(message) {
          warnings.push(message);
        },
      },
    });
    return { registerPushToken, warnings };
  }

  it("해제 직후 다른 요청이 같은 토큰을 먼저 커밋하면 새 트랜잭션에서 한 번 재시도해 토큰을 옮긴다", async () => {
    // Given 첫 해제가 끝난 뒤 다른 연결이 같은 토큰을 다른 사용자로 커밋한다
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    const repository = new DrizzlePushTokenRepository(txHost);
    let releaseCalls = 0;
    const racingRepository: ConstructorParameters<
      typeof RegisterPushToken
    >[0]["pushTokenRepository"] = {
      async releasePushTokenHeldElsewhere(data) {
        const released = await repository.releasePushTokenHeldElsewhere(data);
        releaseCalls += 1;
        if (releaseCalls === 1) {
          await client.insert(pushToken).values({
            userId: firstUserId,
            token: TOKEN,
            deviceId: "first-device",
            platform: "IOS",
          });
        }
        return released;
      },
      registerPushToken: (data) => repository.registerPushToken(data),
    };
    const { registerPushToken, warnings } = createRegisterPushToken(racingRepository, uow);

    // When
    await registerPushToken.execute({
      userId: secondUserId,
      token: TOKEN,
      platform: "IOS",
      deviceId: "second-device",
    });

    // Then
    const rows = await client.select().from(pushToken).where(eq(pushToken.token, TOKEN));
    expect(rows).toEqual([
      expect.objectContaining({ userId: secondUserId, deviceId: "second-device" }),
    ]);
    expect(releaseCalls).toBe(2);
    expect(warnings).toEqual([
      {
        event: NotificationDeliveryLogEvent.REGISTER_PUSH_TOKEN_CONFLICT_RETRIED,
        userId: secondUserId,
      },
    ]);
  });

  it("두 사용자가 같은 토큰을 동시에 등록해도 둘 다 성공하고 토큰 행은 하나만 남는다", async () => {
    // Given
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    const repository = new DrizzlePushTokenRepository(txHost);
    const { registerPushToken } = createRegisterPushToken(repository, uow);

    // When
    const results = await Promise.allSettled([
      registerPushToken.execute({ userId: firstUserId, token: TOKEN, deviceId: "first-device" }),
      registerPushToken.execute({ userId: secondUserId, token: TOKEN, deviceId: "second-device" }),
    ]);

    // Then
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    const rows = await client.select().from(pushToken).where(eq(pushToken.token, TOKEN));
    expect(rows).toHaveLength(1);
  });
});
