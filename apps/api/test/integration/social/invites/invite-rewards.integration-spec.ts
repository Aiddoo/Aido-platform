import { Logger } from "@nestjs/common";
import { and, count, eq, inArray } from "drizzle-orm";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { PremiumAccessReaderPort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { InviteConfigPort } from "#api/modules/social/invites/application/ports/invite-config.port";
import { InviteNotifierPort } from "#api/modules/social/invites/application/ports/invite-notifier.port";
import { InviteRedemptionRepositoryPort } from "#api/modules/social/invites/application/ports/invite-redemption.repository.port";
import { RewardApplierPort } from "#api/modules/social/invites/application/ports/reward-applier.port";
import { RewardGrantRepositoryPort } from "#api/modules/social/invites/application/ports/reward-grant.repository.port";
import { ExpireStaleRedemptionsUseCase } from "#api/modules/social/invites/application/use-cases/expire-stale-redemptions.use-case";
import { GetMyInviteUseCase } from "#api/modules/social/invites/application/use-cases/get-my-invite.use-case";
import { GrantInviteRewardsUseCase } from "#api/modules/social/invites/application/use-cases/grant-invite-rewards.use-case";
import { RecordInviteeActivityUseCase } from "#api/modules/social/invites/application/use-cases/record-invitee-activity.use-case";
import { RedeemInviteUseCase } from "#api/modules/social/invites/application/use-cases/redeem-invite.use-case";
import {
  remainingPremiumDays,
  rewardCapWindowStart,
  summarizeInviterRewards,
} from "#api/modules/social/invites/domain/invite-reward.domain-service";
import { INVITE_REWARD_MAX_ATTEMPTS } from "#api/modules/social/invites/domain/invites.constants";
import { InviteeActivityEventHandler } from "#api/modules/social/invites/infrastructure/event-handlers/invitee-activity.event-handler";
import {
  inviteActiveDay,
  inviteRedemption,
  notification,
  premiumGrant,
  resourceBonus,
  rewardGrant,
  user as userTable,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { toDateOrNull } from "#test/fixtures/billing/subscription.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

const JOINED_AT = new Date("2028-02-28T03:00:00.000Z");

describe("초대 보상 지급 멱등성과 재시도 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let redeemInvite: RedeemInviteUseCase;
  let getMyInvite: GetMyInviteUseCase;
  let grantInviteRewards: GrantInviteRewardsUseCase;
  let recordActivity: RecordInviteeActivityUseCase;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 10 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(InviteConfigPort).useValue({ isEnabled: true }),
    });
    redeemInvite = context.module.get(RedeemInviteUseCase);
    getMyInvite = context.module.get(GetMyInviteUseCase);
    grantInviteRewards = context.module.get(GrantInviteRewardsUseCase);
    recordActivity = context.module.get(RecordInviteeActivityUseCase);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(JOINED_AT);
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function createUser(userTag: string): Promise<string> {
    const id = createEntityId();
    await client.insert(userTable).values(
      UserFixture.create({
        id,
        userTag,
        email: `${userTag.toLowerCase()}@example.test`,
        createdAt: instantFromDate(JOINED_AT),
      }),
    );
    return id;
  }

  async function redeemed(inviterTag: string, inviteeTag: string) {
    const inviterId = await createUser(inviterTag);
    const inviteeId = await createUser(inviteeTag);
    const { code } = await getMyInvite.execute({ inviterId });
    const result = await redeemInvite.execute({
      inviteeId,
      code,
      installationId: inviteeTag,
      timezone: "Asia/Seoul",
    });
    if (result.outcome !== "REDEEMED") {
      throw new Error("새 사용자 수락이 필요합니다");
    }
    return { inviterId, inviteeId, redemptionId: result.redemptionId };
  }

  function grantRewardsWith(overrides: {
    readonly failing?: () => boolean;
    readonly isEnabled?: boolean;
    readonly exhausted?: string[];
  }) {
    const rewardApplier = context.module.get(RewardApplierPort);
    return new GrantInviteRewardsUseCase({
      unitOfWork: context.module.get(UnitOfWorkPort),
      rewardGrantRepository: context.module.get(RewardGrantRepositoryPort),
      inviteRedemptionRepository: context.module.get(InviteRedemptionRepositoryPort),
      rewardApplier: {
        async apply(grant) {
          if (grant.rewardType === "PREMIUM_DAYS" && overrides.failing?.() === true) {
            throw new Error("billing unavailable");
          }
          await rewardApplier.apply(grant);
        },
      },
      notifier: context.module.get(InviteNotifierPort),
      alert: {
        raise: (alert) => {
          overrides.exhausted?.push(String(alert.details?.grantId));
        },
      },
      inviteConfig: { isEnabled: overrides.isEnabled ?? true },
      clock: context.module.get(ClockPort),
      logger: new Logger("GrantInviteRewardsTest"),
    });
  }

  async function qualified(inviterTag: string, inviteeTag: string) {
    const ids = await redeemed(inviterTag, inviteeTag);
    await grantInviteRewards.execute({ redemptionId: ids.redemptionId, countsAttempt: true });
    await recordActivity.execute({
      inviteeId: ids.inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-28T03:00:00.000Z"),
    });
    await recordActivity.execute({
      inviteeId: ids.inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-29T03:00:00.000Z"),
    });
    return ids;
  }

  async function rewardedNotices() {
    return client
      .select({ userId: notification.userId, body: notification.body })
      .from(notification)
      .where(eq(notification.type, "INVITE_REWARDED"));
  }

  async function premiumGrantsOf(userId: string) {
    const rows = await client
      .select({
        durationDays: premiumGrant.durationDays,
        status: premiumGrant.status,
        endsAt: premiumGrant.endsAt,
      })
      .from(premiumGrant)
      .where(eq(premiumGrant.userId, userId));
    return rows.map((row) => ({ ...row, endsAt: toDateOrNull(row.endsAt) }));
  }

  it("초대받은 사람 보상은 수락 때 이미 적용돼 지급 작업이 다시 돌아도 보상 기간은 하나다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("JOBINVTR", "JOBINVTE");

    // When
    const rerun = await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(rerun.appliedCount).toBe(0);
    expect(
      await client
        .select({ status: rewardGrant.status })
        .from(rewardGrant)
        .where(eq(rewardGrant.recipientId, inviteeId)),
    ).toEqual([{ status: "APPLIED" }]);
    expect(await premiumGrantsOf(inviteeId)).toEqual([
      { durationDays: 7, status: "ACTIVE", endsAt: new Date("2028-03-06T03:00:00.000Z") },
    ]);
  });

  it("같은 지급 작업이 동시에 두 번 돌아도 초대한 사람의 보상 기간과 친구 자리는 하나씩만 생긴다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("JOBINVR2", "JOBINVE2");

    // When
    const results = await Promise.all([
      grantInviteRewards.execute({ redemptionId, countsAttempt: true }),
      grantInviteRewards.execute({ redemptionId, countsAttempt: true }),
    ]);
    const rerun = await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(results.reduce((sum, result) => sum + result.appliedCount, 0)).toBe(2);
    expect(rerun.appliedCount).toBe(0);
    expect(await premiumGrantsOf(inviterId)).toEqual([
      { durationDays: 7, status: "ACTIVE", endsAt: new Date("2028-03-06T03:00:00.000Z") },
    ]);
    expect(
      await client
        .select({ quantity: resourceBonus.quantity })
        .from(resourceBonus)
        .where(eq(resourceBonus.userId, inviterId)),
    ).toEqual([{ quantity: 1 }]);
  });

  it("서로 다른 이틀 할 일을 마치면 초대한 사람에게 7일과 친구 자리를 주고 보상 완료로 바꾼다", async () => {
    // Given
    const { inviterId, inviteeId, redemptionId } = await redeemed("QUALINVR", "QUALINVE");
    await recordActivity.execute({
      inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-28T14:59:00.000Z"),
    });

    // When
    const qualified = await recordActivity.execute({
      inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-28T15:01:00.000Z"),
    });
    await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(qualified).toMatchObject({ status: "qualified", redemptionId, grantCount: 2 });
    expect(await premiumGrantsOf(inviterId)).toEqual([
      { durationDays: 7, status: "ACTIVE", endsAt: new Date("2028-03-06T03:00:00.000Z") },
    ]);
    const entitlement = context.module.get(EntitlementReaderPort);
    expect(
      await entitlement.getFeatureLimitInTx(UserId.reconstitute(inviterId), "FRIEND"),
    ).toBeNull();
    const repository = context.module.get(InviteRedemptionRepositoryPort);
    expect(await repository.summarizeByInviterId(UserId.reconstitute(inviterId))).toEqual({
      joinedCount: 0,
      qualifiedCount: 0,
      rewardedCount: 1,
      rejectedCount: 0,
    });
    expect(
      await client
        .select({ quantity: resourceBonus.quantity })
        .from(resourceBonus)
        .where(eq(resourceBonus.userId, inviterId)),
    ).toEqual([{ quantity: 1 }]);
    expect(await rewardedNotices()).toEqual([
      { userId: inviterId, body: "프리미엄 7일을 받았고, 친구도 1명 더 추가할 수 있어요" },
    ]);
  });

  it("적용이 실패하면 FAILED와 시도 횟수를 남기고 다음 실행에서 한 번만 적용한다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("FAILINVR", "FAILINVE");
    let shouldFail = true;
    const flaky = grantRewardsWith({ failing: () => shouldFail });

    // When
    const failed = flaky.execute({ redemptionId, countsAttempt: true });
    await expect(failed).rejects.toMatchObject({ name: "InviteRewardGrantFailedError" });
    const afterFailure = await client
      .select({
        status: rewardGrant.status,
        attempts: rewardGrant.attempts,
        lastErrorCode: rewardGrant.lastErrorCode,
      })
      .from(rewardGrant)
      .where(
        and(eq(rewardGrant.recipientId, inviterId), eq(rewardGrant.rewardType, "PREMIUM_DAYS")),
      );
    shouldFail = false;
    const retried = await flaky.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(afterFailure).toEqual([
      { status: "FAILED", attempts: 1, lastErrorCode: "APPLY_FAILED" },
    ]);
    expect(await premiumGrantsOf(inviterId)).toHaveLength(1);
    expect(retried.appliedCount).toBe(1);
  });

  it("최근 30일 프리미엄 상한을 다 쓴 초대한 사람도 사용 시작으로 인정하고 친구 자리만 준다", async () => {
    // Given
    const { inviterId, inviteeId, redemptionId } = await redeemed("CAPINVTR", "CAPINVTE");
    const earlierInviteeId = await createUser("CAPEARLY");
    const earlierRedemptionId = createEntityId();
    await client.insert(inviteRedemption).values({
      id: earlierRedemptionId,
      inviterId,
      inviteeId: earlierInviteeId,
      status: "REWARDED",
      timezone: "Asia/Seoul",
      joinedAt: instantFromDate(JOINED_AT),
      qualifiedAt: instantFromDate(JOINED_AT),
      rewardedAt: instantFromDate(JOINED_AT),
      expiresAt: instantFromDate(JOINED_AT),
      updatedAt: instantFromDate(JOINED_AT),
    });
    await client.insert(rewardGrant).values({
      recipientId: inviterId,
      sourceType: "INVITE_REDEMPTION",
      sourceId: earlierRedemptionId,
      rewardType: "PREMIUM_DAYS",
      quantity: 30,
      status: "APPLIED",
      appliedAt: instantFromDate(JOINED_AT),
      createdAt: instantFromDate(JOINED_AT),
      updatedAt: instantFromDate(JOINED_AT),
    });
    await recordActivity.execute({
      inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-28T03:00:00.000Z"),
    });

    // When
    const qualified = await recordActivity.execute({
      inviteeId,
      occurredAt: Temporal.Instant.from("2028-02-29T03:00:00.000Z"),
    });
    await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(qualified).toMatchObject({ status: "qualified", redemptionId, grantCount: 1 });
    expect(
      await client
        .select({
          rewardType: rewardGrant.rewardType,
          quantity: rewardGrant.quantity,
          status: rewardGrant.status,
        })
        .from(rewardGrant)
        .where(and(eq(rewardGrant.recipientId, inviterId), eq(rewardGrant.sourceId, redemptionId))),
    ).toEqual([{ rewardType: "FRIEND_SLOT", quantity: 1, status: "APPLIED" }]);
    expect(await premiumGrantsOf(inviterId)).toEqual([]);
    const repository = context.module.get(InviteRedemptionRepositoryPort);
    expect(await repository.summarizeByInviterId(UserId.reconstitute(inviterId))).toMatchObject({
      rewardedCount: 2,
      rejectedCount: 0,
    });
  });

  it("보상 지급 작업과 스토어 첫 결제 웹훅이 동시에 와도 보상 7일은 한 번만 남고 프리미엄은 끊기지 않는다", async () => {
    // Given
    const storeExpiry = new Date("2028-03-28T03:00:00.000Z");
    const scenarios: { inviterId: string; redemptionId: string }[] = [];
    for (const suffix of ["A", "B", "C"]) {
      scenarios.push(await qualified(`RACEIVR${suffix}`, `RACEIVE${suffix}`));
    }
    const webhook = context.module.get(RevenueCatWebhookReceiver);

    // When
    await Promise.all(
      scenarios.flatMap(({ inviterId, redemptionId }) => [
        grantInviteRewards.execute({ redemptionId, countsAttempt: true }),
        webhook.receive({
          body: SubscriptionEventBuilder.initialPurchase()
            .withAppUserId(inviterId)
            .withOriginalTransactionId(`race-${inviterId}`)
            .withTransactionId(`race-${inviterId}`)
            .withEventId(`race-${inviterId}`)
            .withExpirationAtMs(storeExpiry.getTime())
            .build(),
        }),
      ]),
    );

    // Then
    const entitlement = context.module.get(EntitlementReaderPort);
    const reader = context.module.get<PremiumAccessReaderPort>(PremiumAccessReaderPort);
    for (const { inviterId } of scenarios) {
      expect(await reader.getPremiumAccess(UserId.reconstitute(inviterId))).toMatchObject({
        source: "STORE",
        periodEndsAt: storeExpiry,
        bankedDays: 7,
      });
      expect(await entitlement.canInTx(UserId.reconstitute(inviterId), "AI_REPORT")).toBe(true);
      const projection = await client.query.user.findFirst({
        where: { id: inviterId },
        columns: { subscriptionStatus: true, subscriptionExpiresAt: true },
      });
      expect(projection?.subscriptionStatus).toBe("ACTIVE");
      expect(projection?.subscriptionExpiresAt?.epochMilliseconds).toBeGreaterThan(
        storeExpiry.getTime(),
      );
    }
  });

  it("윤년 2월을 지나는 최근 30일 상한은 기간 시작 시각 기록을 빼고 1ms 뒤 기록부터 세며 누적 90일이면 더 주지 않는다", async () => {
    // Given
    const inviterId = await createUser("CAPLEAP1");
    const now = Temporal.Instant.from("2028-03-15T03:00:00.000Z");
    const windowStart = rewardCapWindowStart(now);
    const grants = [
      { sourceId: "leap-window-start", quantity: 7, createdAt: windowStart },
      {
        sourceId: "leap-window-in",
        quantity: 7,
        createdAt: windowStart.add({ milliseconds: 1 }),
      },
      {
        sourceId: "leap-old",
        quantity: 76,
        createdAt: Temporal.Instant.from("2027-12-01T00:00:00.000Z"),
      },
    ];
    for (const grant of grants) {
      await client.insert(rewardGrant).values({
        recipientId: inviterId,
        sourceType: "INVITE_REDEMPTION",
        sourceId: grant.sourceId,
        rewardType: "PREMIUM_DAYS",
        quantity: grant.quantity,
        status: "APPLIED",
        appliedAt: grant.createdAt,
        createdAt: grant.createdAt,
        updatedAt: grant.createdAt,
      });
    }
    const repository = context.module.get(RewardGrantRepositoryPort);

    // When
    const summary = summarizeInviterRewards(
      await repository.summarizeInviterRewards(UserId.reconstitute(inviterId), windowStart),
    );

    // Then
    expect(windowStart.equals(Temporal.Instant.from("2028-02-14T03:00:00.000Z"))).toBe(true);
    expect(summary).toMatchObject({ premiumDaysInWindow: 7, totalPremiumDays: 90 });
    expect(remainingPremiumDays(summary)).toBe(0);
  });

  it("ADMIN이 초대한 사람이어도 보상 기간·친구 자리·보상 알림을 받고 role과 프리미엄 한도(친구 무제한)는 그대로다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("ADMININV", "ADMINVTE");
    await client.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, inviterId));

    // When
    await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(await premiumGrantsOf(inviterId)).toEqual([
      expect.objectContaining({ durationDays: 7, status: "ACTIVE" }),
    ]);
    expect(
      await client
        .select({ quantity: resourceBonus.quantity })
        .from(resourceBonus)
        .where(eq(resourceBonus.userId, inviterId)),
    ).toEqual([{ quantity: 1 }]);
    expect(await rewardedNotices()).toEqual([{ userId: inviterId, body: expect.any(String) }]);
    expect(
      (await client.query.user.findFirst({ where: { id: inviterId }, columns: { role: true } }))
        ?.role,
    ).toBe("ADMIN");
    const entitlement = context.module.get(EntitlementReaderPort);
    expect(
      await entitlement.getFeatureLimitInTx(UserId.reconstitute(inviterId), "FRIEND"),
    ).toBeNull();
  });

  it("정비 작업은 마감이 지난 수락만 거절하고 남은 지급이 있는 수락의 작업을 다시 만든다", async () => {
    // Given
    const stale = await redeemed("MNTINVR1", "MNTINVE1");
    const fresh = await qualified("MNTINVR2", "MNTINVE2");
    const maintenance = context.module.get(ExpireStaleRedemptionsUseCase);

    // When
    const result = await maintenance.execute({
      now: Temporal.Instant.from("2028-03-20T00:00:00.000Z"),
      runDate: Temporal.PlainDate.from("2028-03-20"),
    });

    // Then
    expect(result.expiredCount).toBe(1);
    expect(result.retriedCount).toBe(1);
    const statuses = await client
      .select({
        id: inviteRedemption.id,
        status: inviteRedemption.status,
        rejectionReason: inviteRedemption.rejectionReason,
      })
      .from(inviteRedemption)
      .where(inArray(inviteRedemption.id, [stale.redemptionId, fresh.redemptionId]));
    expect(statuses).toEqual(
      expect.arrayContaining([
        { id: stale.redemptionId, status: "REJECTED", rejectionReason: "EXPIRED" },
        { id: fresh.redemptionId, status: "QUALIFIED", rejectionReason: null },
      ]),
    );
  });

  it("키리티마티로는 다음 날인 시각에 두 번 완료해도 수락 때 고정한 서울 날짜 하루로만 센다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("TZINVITR", "TZINVITE");
    const handler = context.module.get(InviteeActivityEventHandler);
    await handler.handle({ todoId: 1, userId: inviteeId, occurredAt: "2028-02-28T14:00:00.000Z" });

    // When
    await handler.handle({ todoId: 1, userId: inviteeId, occurredAt: "2028-02-28T14:01:00.000Z" });

    // Then
    const [redemption] = await client
      .select({ status: inviteRedemption.status })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.id, redemptionId));
    const [activeDays] = await client
      .select({ total: count() })
      .from(inviteActiveDay)
      .where(eq(inviteActiveDay.redemptionId, redemptionId));
    expect({ status: redemption?.status, activeDays: activeDays?.total }).toEqual({
      status: "JOINED",
      activeDays: 1,
    });
  });

  it("같은 기기로 이미 보상을 받은 수락은 사용 시작해도 초대한 사람 보상을 만들지 않는다", async () => {
    // Given
    const inviterId = await createUser("DUPINVTR");
    const firstId = await createUser("DUPINVE1");
    const secondId = await createUser("DUPINVE2");
    const { code } = await getMyInvite.execute({ inviterId });
    await redeemInvite.execute({
      inviteeId: firstId,
      code,
      installationId: "same-device",
      timezone: "Asia/Seoul",
    });
    const second = await redeemInvite.execute({
      inviteeId: secondId,
      code,
      installationId: "same-device",
      timezone: "Asia/Seoul",
    });
    await recordActivity.execute({
      inviteeId: secondId,
      occurredAt: Temporal.Instant.from("2028-02-28T03:00:00.000Z"),
    });

    // When
    const result = await recordActivity.execute({
      inviteeId: secondId,
      occurredAt: Temporal.Instant.from("2028-02-29T03:00:00.000Z"),
    });

    // Then
    expect(second).toMatchObject({ outcome: "REDEEMED", rewards: [] });
    expect(result).toMatchObject({ status: "qualified", grantCount: 0 });
    expect(
      await client
        .select({ id: rewardGrant.id })
        .from(rewardGrant)
        .where(eq(rewardGrant.recipientId, inviterId)),
    ).toEqual([]);
  });

  it("기능이 꺼진 동안은 사용 시작과 원장만 남기고 지급하지 않다가 다시 켜면 정비 작업이 적용한다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("OFFINVTR", "OFFINVTE");
    const disabled = grantRewardsWith({ isEnabled: false });
    const disabledResult = await disabled.execute({ redemptionId, countsAttempt: true });
    const pending = await client
      .select({ status: rewardGrant.status, attempts: rewardGrant.attempts })
      .from(rewardGrant)
      .where(eq(rewardGrant.recipientId, inviterId));

    // When
    const maintenance = await context.module.get(ExpireStaleRedemptionsUseCase).execute({
      now: Temporal.Instant.from("2028-03-01T00:00:00.000Z"),
      runDate: Temporal.PlainDate.from("2028-03-01"),
    });
    await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(disabledResult).toEqual({ appliedCount: 0, failedCount: 0 });
    expect(pending).toEqual([
      { status: "PENDING", attempts: 0 },
      { status: "PENDING", attempts: 0 },
    ]);
    expect(maintenance.retriedCount).toBe(1);
    expect(
      (
        await client
          .select({ status: rewardGrant.status })
          .from(rewardGrant)
          .where(eq(rewardGrant.recipientId, inviterId))
      ).map((grant) => grant.status),
    ).toEqual(["APPLIED", "APPLIED"]);
  });

  it("지급이 두 번에 나뉘어 적용돼도 보상 완료로 바뀔 때 합계로 한 번만 알린다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("ONCEINVR", "ONCEINVE");
    let isBillingDown = true;
    const flaky = grantRewardsWith({ failing: () => isBillingDown });
    await expect(flaky.execute({ redemptionId, countsAttempt: true })).rejects.toMatchObject({
      name: "InviteRewardGrantFailedError",
    });
    const afterFirst = await rewardedNotices();

    // When
    isBillingDown = false;
    await flaky.execute({ redemptionId, countsAttempt: false });
    await flaky.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(afterFirst).toEqual([]);
    expect(await rewardedNotices()).toEqual([
      { userId: inviterId, body: "프리미엄 7일을 받았고, 친구도 1명 더 추가할 수 있어요" },
    ]);
  });

  it("큐 재시도는 시도 횟수를 늘리지 않고 마지막 정비 재시도가 실패하면 한 번 알린다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("CAPATTMR", "CAPATTME");
    const exhausted: string[] = [];
    const failing = grantRewardsWith({ failing: () => true, exhausted });
    await expect(failing.execute({ redemptionId, countsAttempt: true })).rejects.toThrow();
    await expect(failing.execute({ redemptionId, countsAttempt: false })).rejects.toThrow();
    const afterQueueRetry = await client.query.rewardGrant.findFirst({
      where: { recipientId: inviterId, rewardType: "PREMIUM_DAYS" },
      columns: { attempts: true },
    });
    await client
      .update(rewardGrant)
      .set({ attempts: 4 })
      .where(
        and(eq(rewardGrant.recipientId, inviterId), eq(rewardGrant.rewardType, "PREMIUM_DAYS")),
      );

    // When
    await expect(failing.execute({ redemptionId, countsAttempt: true })).rejects.toThrow();
    const retryable = await context.module
      .get(RewardGrantRepositoryPort)
      .listRetryableRedemptionIds({
        maxAttempts: INVITE_REWARD_MAX_ATTEMPTS,
        createdBefore: Temporal.Instant.from("2028-03-10T00:00:00.000Z"),
        afterRedemptionId: null,
        limit: 10,
      });
    const totals = await context.module
      .get(RewardGrantRepositoryPort)
      .summarizeInviterRewards(
        UserId.reconstitute(inviterId),
        Temporal.Instant.from("2028-02-01T00:00:00.000Z"),
      );

    // Then
    expect(afterQueueRetry).toEqual({ attempts: 1 });
    expect(exhausted).toHaveLength(1);
    expect(retryable.map((id) => id.value)).not.toContain(redemptionId);
    expect(totals.find((total) => total.rewardType === "PREMIUM_DAYS")).toBeUndefined();
  });
});
