import type { NotificationType } from "#api/modules/notification/inbox/domain/notification-type.constants";
import type { PushFunnelQuery } from "#api/modules/notification/push/application/ports/push-funnel.reader.port";
import type {
  PushDeliveryAttemptStatus,
  PushDispatchStatus,
} from "#api/modules/notification/push/domain/push-delivery-status.constants";
import { DrizzlePushFunnelReader } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-funnel.reader";
import { requireRecord } from "#api/platform/database/database-error.util";
import {
  notification as notificationTable,
  pushDeliveryAttempt,
  pushDispatch,
  pushToken,
  user as userTable,
} from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const FROM = Temporal.Instant.from("2026-11-01T00:00:00.000Z");
const TO = Temporal.Instant.from("2026-11-08T00:00:00.000Z");
const IN_RANGE = new Date("2026-11-05T03:00:00.000Z");
const BEFORE_RANGE = new Date("2026-10-31T23:59:59.999Z");
const CAMPAIGN = "feature-discovery-2026-11";
const TOKEN_KEYS = { a: "ios_funnel-a", b: "ios_funnel-b" } as const;

interface SeededNotification {
  readonly createdAt?: Date;
  readonly campaignKey?: string | null;
  readonly type?: NotificationType;
  readonly opened?: boolean;
  readonly dispatch?: {
    readonly status: PushDispatchStatus;
    readonly skipReason?: string;
  };
  readonly attempts?: readonly {
    readonly token: keyof typeof TOKEN_KEYS;
    readonly status: PushDeliveryAttemptStatus;
  }[];
}

describe("푸시 발송 퍼널 조회 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzlePushFunnelReader;
  let userId: string;
  let tokenIds: Record<keyof typeof TOKEN_KEYS, number>;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 2 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    const user = UserFixture.create();
    await client.insert(userTable).values(user);
    userId = user.id;
    const tokens = await client
      .insert(pushToken)
      .values(
        Object.values(TOKEN_KEYS).map((deviceId) => ({
          userId,
          token: `ExponentPushToken[${deviceId}]`,
          deviceId,
          platform: "IOS" as const,
          updatedAt: Temporal.Now.instant(),
        })),
      )
      .returning({ id: pushToken.id, deviceId: pushToken.deviceId });
    tokenIds = {
      a: requireRecord(tokens.find((row) => row.deviceId === TOKEN_KEYS.a)).id,
      b: requireRecord(tokens.find((row) => row.deviceId === TOKEN_KEYS.b)).id,
    };
    const { txHost } = createDatabaseTransactionFixture(client);
    reader = new DrizzlePushFunnelReader(txHost);
  });

  afterAll(async () => {
    await database?.stop();
  });

  async function seed(input: SeededNotification): Promise<void> {
    const createdAt = instantFromDate(input.createdAt ?? IN_RANGE);
    const [created] = await client
      .insert(notificationTable)
      .values({
        userId,
        type: input.type ?? "SYSTEM_NOTICE",
        title: "funnel",
        body: "funnel",
        campaignKey: input.campaignKey === undefined ? CAMPAIGN : input.campaignKey,
        createdAt,
        openedAt: input.opened === true ? createdAt : null,
      })
      .returning({ id: notificationTable.id });
    if (input.dispatch == null) {
      return;
    }
    const [dispatch] = await client
      .insert(pushDispatch)
      .values({
        notificationId: requireRecord(created).id,
        userId,
        purpose: "ENGAGEMENT",
        campaignKey: input.campaignKey === undefined ? CAMPAIGN : input.campaignKey,
        status: input.dispatch.status,
        skipReason: input.dispatch.skipReason ?? null,
      })
      .returning({ id: pushDispatch.id });
    const attempts = input.attempts ?? [];
    if (attempts.length > 0) {
      await client.insert(pushDeliveryAttempt).values(
        attempts.map((attempt) => ({
          dispatchId: requireRecord(dispatch).id,
          pushTokenId: tokenIds[attempt.token],
          status: attempt.status,
        })),
      );
    }
  }

  async function givenCampaignTraffic(): Promise<void> {
    await seed({ dispatch: { status: "SKIPPED", skipReason: "PUSH_DISABLED" } });
    await seed({ dispatch: { status: "SKIPPED", skipReason: "PUSH_DISABLED" } });
    await seed({ dispatch: { status: "SKIPPED", skipReason: "NO_ACTIVE_TOKEN" } });
    // 어휘에서 빠진 옛 사유는 생성 수에는 들어가고 사유별 수에서는 빠진다
    await seed({ dispatch: { status: "SKIPPED", skipReason: "LEGACY_REASON" } });
    // 기기 두 대 중 하나만 받아도 receipt 성공 알림 한 건이다
    await seed({
      opened: true,
      dispatch: { status: "SENT" },
      attempts: [
        { token: "a", status: "DELIVERED" },
        { token: "b", status: "FAILED" },
      ],
    });
    await seed({ dispatch: { status: "FAILED" }, attempts: [{ token: "a", status: "FAILED" }] });
    await seed({
      dispatch: { status: "SENT" },
      attempts: [{ token: "a", status: "TICKET_ACCEPTED" }],
    });
    await seed({ type: "FOLLOW_NEW", dispatch: { status: "PENDING" } });
    await seed({});
    // 구간 밖과 다른 캠페인은 캠페인 퍼널에 섞이지 않는다
    await seed({
      createdAt: BEFORE_RANGE,
      opened: true,
      dispatch: { status: "SENT" },
      attempts: [{ token: "a", status: "DELIVERED" }],
    });
    await seed({
      campaignKey: "other-campaign",
      dispatch: { status: "SKIPPED", skipReason: "PUSH_DISABLED" },
    });
  }

  function query(overrides: Partial<PushFunnelQuery> = {}): PushFunnelQuery {
    return { from: FROM, to: TO, campaignKey: CAMPAIGN, notificationType: null, ...overrides };
  }

  it("캠페인 하나의 생성·건너뜀·발송 요청·receipt·열람을 알림 단위로 센다", async () => {
    // Given
    await givenCampaignTraffic();

    // When
    const funnel = await reader.summarize(query());

    // Then
    expect({ ...funnel, skippedByReason: Object.fromEntries(funnel.skippedByReason) }).toEqual({
      created: 9,
      skippedByReason: { PUSH_DISABLED: 2, NO_ACTIVE_TOKEN: 1 },
      dispatchRequested: 3,
      receiptSucceeded: 1,
      receiptFailed: 1,
      opened: 1,
    });
  });

  it("캠페인을 고르지 않으면 구간 안의 모든 알림을 센다", async () => {
    // Given
    await givenCampaignTraffic();

    // When
    const funnel = await reader.summarize(query({ campaignKey: null }));

    // Then
    expect(funnel.created).toBe(10);
    expect(funnel.skippedByReason.get("PUSH_DISABLED")).toBe(3);
    expect(funnel.dispatchRequested).toBe(3);
  });

  it("알림 종류로 좁히면 그 종류만 센다", async () => {
    // Given
    await givenCampaignTraffic();

    // When
    const funnel = await reader.summarize(query({ notificationType: "FOLLOW_NEW" }));

    // Then
    expect({ ...funnel, skippedByReason: Object.fromEntries(funnel.skippedByReason) }).toEqual({
      created: 1,
      skippedByReason: {},
      dispatchRequested: 0,
      receiptSucceeded: 0,
      receiptFailed: 0,
      opened: 0,
    });
  });
});
