import { eq } from "drizzle-orm";

import { NotificationDeliveryLogEvent } from "#api/modules/notification/push/application/notification-delivery.log-events";
import {
  type ReportPushDeviceCommand,
  ReportPushDeviceUseCase,
} from "#api/modules/notification/push/application/use-cases/report-push-device.use-case";
import { DrizzlePushDeviceRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-device.repository";
import { DrizzlePushTokenRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-token.repository";
import { pushDevice, pushToken, session, user } from "#api/platform/database/schema/index";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SessionFixture, UserFixture } from "#test/fixtures/index";
import { createReportPushDeviceCommandFixture } from "#test/fixtures/notification/push-device.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const TOKEN = "ExponentPushToken[concurrent-registration]";
const REPORTED_AT = Temporal.Instant.from("2026-11-10T03:00:00.000Z");

describe("푸시 기기 보고 (실제 PostgreSQL)", () => {
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

  function createReportPushDevice(
    pushTokenRepository?: ConstructorParameters<
      typeof ReportPushDeviceUseCase
    >[0]["pushTokenRepository"],
  ) {
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    const warnings: unknown[] = [];
    const reportPushDevice = new ReportPushDeviceUseCase({
      pushDeviceRepository: new DrizzlePushDeviceRepository(txHost),
      pushTokenRepository: pushTokenRepository ?? new DrizzlePushTokenRepository(txHost),
      unitOfWork: uow,
      pushProvider: { validateToken: () => true },
      userSettings: { upsertPushLocale: async () => {}, upsertPushTimezone: async () => {} },
      cache: { invalidatePushTokens: async () => {}, invalidateUserPreference: async () => {} },
      clock: new FixedClock(REPORTED_AT),
      logger: {
        log() {},
        warn(message) {
          warnings.push(message);
        },
      },
    });
    return { reportPushDevice, warnings, txHost };
  }

  function command(overrides: Partial<ReportPushDeviceCommand>): ReportPushDeviceCommand {
    return createReportPushDeviceCommandFixture({
      userId: firstUserId,
      deviceId: "ios_first",
      token: TOKEN,
      ...overrides,
    });
  }

  it("거절로 바뀐 기기는 토큰 행을 지우고 권한만 갱신한다", async () => {
    // Given
    const { reportPushDevice } = createReportPushDevice();
    await reportPushDevice.execute(command({ deviceId: "android_first" }));

    // When
    await reportPushDevice.execute(
      command({ deviceId: "android_first", permission: { status: "DENIED", canAskAgain: true } }),
    );

    // Then
    expect(await client.select().from(pushToken)).toEqual([]);
    expect(await client.select().from(pushDevice)).toEqual([
      expect.objectContaining({
        userId: firstUserId,
        deviceId: "android_first",
        platform: "ANDROID",
        permissionStatus: "DENIED",
        permissionCanAskAgain: true,
      }),
    ]);
    const times = await client
      .select({ reportedAt: pushDevice.reportedAt, updatedAt: pushDevice.updatedAt })
      .from(pushDevice);
    expect(times.map((row) => [row.reportedAt.toString(), row.updatedAt.toString()])).toEqual([
      [REPORTED_AT.toString(), REPORTED_AT.toString()],
    ]);
  });

  it("허용 기기가 토큰 발급 실패로 null을 보고해도 토큰 행을 지우지 않고 지금 세션으로 옮긴다", async () => {
    // Given 이전 세션에서 토큰을 등록하고 다시 로그인한 기기
    const [oldSession, newSession] = [
      SessionFixture.create({ userId: firstUserId }),
      SessionFixture.create({ userId: firstUserId }),
    ];
    await client.insert(session).values([oldSession, newSession]);
    const { reportPushDevice } = createReportPushDevice();
    await reportPushDevice.execute(command({ sessionId: oldSession.id, appVersion: "1.14.2" }));

    // When
    const report = await reportPushDevice.execute(
      command({ sessionId: newSession.id, appVersion: "1.15.0", token: null }),
    );

    // Then
    expect(report.hasActiveToken).toBe(true);
    expect(await client.select().from(pushToken)).toEqual([
      expect.objectContaining({
        userId: firstUserId,
        deviceId: "ios_first",
        token: TOKEN,
        isActive: true,
        sessionId: newSession.id,
        appVersion: "1.15.0",
      }),
    ]);
    expect(await client.select().from(pushDevice)).toEqual([
      expect.objectContaining({ sessionId: newSession.id, permissionStatus: "GRANTED" }),
    ]);
  });

  it("계정을 바꿔 로그인한 기기는 이전 사용자의 기기·토큰 행을 지운다", async () => {
    const { reportPushDevice } = createReportPushDevice();
    await reportPushDevice.execute(command({ userId: firstUserId }));

    await reportPushDevice.execute(
      command({ userId: secondUserId, permission: { status: "DENIED", canAskAgain: false } }),
    );

    expect(await client.select().from(pushToken)).toEqual([]);
    expect(await client.select({ userId: pushDevice.userId }).from(pushDevice)).toEqual([
      { userId: secondUserId },
    ]);
  });

  it("로그인 세션이 지워지면(만료 정리) 그 세션의 기기·토큰 행도 함께 지워진다", async () => {
    // Given 세션에 묶인 기기와 세션 없이 등록된 구 앱 기기
    const loginSession = SessionFixture.create({ userId: firstUserId });
    await client.insert(session).values(loginSession);
    const { reportPushDevice } = createReportPushDevice();
    await reportPushDevice.execute(command({ sessionId: loginSession.id }));
    await reportPushDevice.execute(
      command({ deviceId: "android_legacy", token: "ExponentPushToken[legacy]" }),
    );

    // When
    await client.delete(session).where(eq(session.id, loginSession.id));

    // Then
    expect(await client.select({ deviceId: pushToken.deviceId }).from(pushToken)).toEqual([
      { deviceId: "android_legacy" },
    ]);
    expect(await client.select({ deviceId: pushDevice.deviceId }).from(pushDevice)).toEqual([
      { deviceId: "android_legacy" },
    ]);
  });

  it("해제 직후 다른 요청이 같은 토큰을 먼저 커밋하면 새 트랜잭션에서 한 번 재시도해 토큰을 옮긴다", async () => {
    // Given 첫 해제가 끝난 뒤 다른 연결이 같은 토큰을 다른 사용자로 커밋한다
    const { txHost } = createDatabaseTransactionFixture(client);
    const repository = new DrizzlePushTokenRepository(txHost);
    let releaseCalls = 0;
    const racingRepository: ConstructorParameters<
      typeof ReportPushDeviceUseCase
    >[0]["pushTokenRepository"] = {
      async releasePushTokenHeldElsewhere(data) {
        const released = await repository.releasePushTokenHeldElsewhere(data);
        releaseCalls += 1;
        if (releaseCalls === 1) {
          await client.insert(pushToken).values({
            userId: firstUserId,
            token: TOKEN,
            deviceId: "ios_first",
            platform: "IOS",
            updatedAt: REPORTED_AT,
          });
        }
        return released;
      },
      registerPushToken: (data) => repository.registerPushToken(data),
      keepPushToken: (data) => repository.keepPushToken(data),
      deletePushTokensByDevice: (userId, deviceId) =>
        repository.deletePushTokensByDevice(userId, deviceId),
    };
    const { reportPushDevice, warnings } = createReportPushDevice(racingRepository);

    // When
    await reportPushDevice.execute(command({ userId: secondUserId, deviceId: "ios_second" }));

    // Then
    const rows = await client.select().from(pushToken).where(eq(pushToken.token, TOKEN));
    expect(rows).toEqual([
      expect.objectContaining({ userId: secondUserId, deviceId: "ios_second" }),
    ]);
    expect(releaseCalls).toBe(2);
    expect(warnings).toEqual([
      {
        event: NotificationDeliveryLogEvent.REPORT_PUSH_DEVICE_TOKEN_CONFLICT_RETRIED,
        userId: secondUserId,
      },
    ]);
  });

  it("두 사용자가 같은 토큰을 동시에 보고해도 둘 다 성공하고 토큰 행은 하나만 남는다", async () => {
    // Given
    const { reportPushDevice } = createReportPushDevice();

    // When
    const results = await Promise.allSettled([
      reportPushDevice.execute(command({ userId: firstUserId, deviceId: "ios_first" })),
      reportPushDevice.execute(command({ userId: secondUserId, deviceId: "ios_second" })),
    ]);

    // Then
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    const rows = await client.select().from(pushToken).where(eq(pushToken.token, TOKEN));
    expect(rows).toHaveLength(1);
  });
});
