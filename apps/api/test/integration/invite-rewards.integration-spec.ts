import { Logger } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { Resource } from "#api/modules/access/access-entitlement.public";
import { HandleWebhookEvent } from "#api/modules/billing/application/use-cases/subscriptions/handle-webhook-event.use-case";
import {
  PREMIUM_ACCESS_READER,
  type PremiumAccessReaderPort,
} from "#api/modules/billing/billing-subscriptions.public";
import { TodoToggledEvent } from "#api/modules/planning/planning-todos.public";
import {
  INVITE_NOTIFIER,
  type InviteNotifierPort,
} from "#api/modules/social/application/ports/invites/invite-notifier.port";
import {
  INVITE_REDEMPTION_REPOSITORY,
  type InviteRedemptionRepositoryPort,
} from "#api/modules/social/application/ports/invites/invite-redemption.repository.port";
import { INVITE_CONFIG } from "#api/modules/social/application/ports/invites/invite.config.port";
import {
  REWARD_APPLIERS,
  type RewardApplierRegistry,
} from "#api/modules/social/application/ports/invites/reward-applier.port";
import {
  REWARD_GRANT_REPOSITORY,
  type RewardGrantRepositoryPort,
} from "#api/modules/social/application/ports/invites/reward-grant.repository.port";
import { ExpireStaleRedemptions } from "#api/modules/social/application/use-cases/invites/expire-stale-redemptions.use-case";
import { GetMyInvite } from "#api/modules/social/application/use-cases/invites/get-my-invite.use-case";
import { GrantInviteRewards } from "#api/modules/social/application/use-cases/invites/grant-invite-rewards.use-case";
import { RecordInviteeActivity } from "#api/modules/social/application/use-cases/invites/record-invitee-activity.use-case";
import { RedeemInvite } from "#api/modules/social/application/use-cases/invites/redeem-invite.use-case";
import {
  InviteRewardPolicy,
  remainingPremiumDays,
  rewardCapWindowStart,
} from "#api/modules/social/domain/policies/invites/invite-reward.policy";
import { INVITE_REWARD_MAX_ATTEMPTS } from "#api/modules/social/domain/types/invites/reward-grant.types";
import { InviteeActivitySubscriber } from "#api/modules/social/infrastructure/subscribers/invites/invitee-activity.subscriber";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const JOINED_AT = new Date("2028-02-28T03:00:00.000Z");

describe("초대 보상 지급 멱등성과 재시도 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let redeemInvite: RedeemInvite;
  let getMyInvite: GetMyInvite;
  let grantInviteRewards: GrantInviteRewards;
  let recordActivity: RecordInviteeActivity;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 10 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(INVITE_CONFIG).useValue({ isEnabled: true }),
    });
    redeemInvite = context.module.get(RedeemInvite);
    getMyInvite = context.module.get(GetMyInvite);
    grantInviteRewards = context.module.get(GrantInviteRewards);
    recordActivity = context.module.get(RecordInviteeActivity);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(JOINED_AT);
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function createUser(userTag: string): Promise<string> {
    const id = createEntityId();
    await client.orm.public.User.create(
      encodeCreate(
        "User",
        UserFixture.create({
          id,
          userTag,
          email: `${userTag.toLowerCase()}@example.test`,
          createdAt: JOINED_AT,
        }),
      ),
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
    if (result.outcome !== "REDEEMED") throw new Error("새 사용자 수락이 필요합니다");
    return { inviterId, inviteeId, redemptionId: result.redemptionId };
  }

  function grantRewardsWith(overrides: {
    readonly failing?: () => boolean;
    readonly isEnabled?: boolean;
    readonly exhausted?: string[];
  }) {
    const appliers = context.module.get<RewardApplierRegistry>(REWARD_APPLIERS);
    return new GrantInviteRewards({
      rewardGrantRepository: context.module.get<RewardGrantRepositoryPort>(REWARD_GRANT_REPOSITORY),
      inviteRedemptionRepository: context.module.get<InviteRedemptionRepositoryPort>(
        INVITE_REDEMPTION_REPOSITORY,
      ),
      rewardAppliers: {
        ...appliers,
        PREMIUM_DAYS: {
          async apply(grant) {
            if (overrides.failing?.() === true) throw new Error("billing unavailable");
            await appliers.PREMIUM_DAYS.apply(grant);
          },
        },
      },
      notifier: context.module.get<InviteNotifierPort>(INVITE_NOTIFIER),
      alert: {
        reportRetryExhausted: (failure) => {
          overrides.exhausted?.push(failure.grantId);
        },
      },
      inviteConfig: { isEnabled: overrides.isEnabled ?? true },
      unitOfWork: context.module.get<UnitOfWorkPort>(UNIT_OF_WORK),
      logger: new Logger("GrantInviteRewardsTest"),
    });
  }

  async function qualified(inviterTag: string, inviteeTag: string) {
    const ids = await redeemed(inviterTag, inviteeTag);
    await grantInviteRewards.execute({ redemptionId: ids.redemptionId, countsAttempt: true });
    await recordActivity.execute({
      inviteeId: ids.inviteeId,
      occurredAt: new Date("2028-02-28T03:00:00.000Z"),
    });
    await recordActivity.execute({
      inviteeId: ids.inviteeId,
      occurredAt: new Date("2028-02-29T03:00:00.000Z"),
    });
    return ids;
  }

  async function rewardedNotices() {
    return client.orm.public.Notification.where((row) => row._type.eq("INVITE_REWARDED"))
      .select("userId", "body")
      .all();
  }

  async function premiumGrantsOf(userId: string) {
    return decodeRecord(
      "PremiumGrant",
      await client.orm.public.PremiumGrant.where({ userId })
        .select("durationDays", "status", "endsAt")
        .all(),
    );
  }

  it("초대받은 사람 보상은 수락 때 이미 적용돼 지급 작업이 다시 돌아도 보상 기간은 하나다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("JOBINVTR", "JOBINVTE");

    // When
    const rerun = await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(rerun.appliedCount).toBe(0);
    expect(
      await client.orm.public.RewardGrant.where({ recipientId: inviteeId }).select("status").all(),
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
      await client.orm.public.ResourceBonus.where({ userId: inviterId }).select("quantity").all(),
    ).toEqual([{ quantity: 1 }]);
  });

  it("서로 다른 이틀 할 일을 마치면 초대한 사람에게 7일과 친구 자리를 주고 보상 완료로 바꾼다", async () => {
    // Given
    const { inviterId, inviteeId, redemptionId } = await redeemed("QUALINVR", "QUALINVE");
    await recordActivity.execute({
      inviteeId,
      occurredAt: new Date("2028-02-28T14:59:00.000Z"),
    });

    // When
    const qualified = await recordActivity.execute({
      inviteeId,
      occurredAt: new Date("2028-02-28T15:01:00.000Z"),
    });
    await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(qualified).toMatchObject({ status: "qualified", redemptionId, grantCount: 2 });
    expect(await premiumGrantsOf(inviterId)).toEqual([
      { durationDays: 7, status: "ACTIVE", endsAt: new Date("2028-03-06T03:00:00.000Z") },
    ]);
    const entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
    expect(
      (await entitlement.getResourceLimitInTx(inviterId, Resource.FRIEND)).maxCount,
    ).toBeNull();
    const repository = context.module.get<InviteRedemptionRepositoryPort>(
      INVITE_REDEMPTION_REPOSITORY,
    );
    expect(await repository.summarizeByInviterId(inviterId)).toEqual({
      joinedCount: 0,
      qualifiedCount: 0,
      rewardedCount: 1,
      rejectedCount: 0,
    });
    expect(
      await client.orm.public.ResourceBonus.where({ userId: inviterId }).select("quantity").all(),
    ).toEqual([{ quantity: 1 }]);
    const rewardedNotices = await client.orm.public.Notification.where((row) =>
      row._type.eq("INVITE_REWARDED"),
    )
      .select("userId", "body")
      .all();
    expect(rewardedNotices).toEqual([
      { userId: inviterId, body: "프리미엄 7일을 받았고, 친구도 1명 더 추가할 수 있어" },
    ]);
  });

  it("적용이 실패하면 FAILED와 시도 횟수를 남기고 다음 실행에서 한 번만 적용한다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("FAILINVR", "FAILINVE");
    const appliers = context.module.get<RewardApplierRegistry>(REWARD_APPLIERS);
    let shouldFail = true;
    const flaky = new GrantInviteRewards({
      rewardGrantRepository: context.module.get<RewardGrantRepositoryPort>(REWARD_GRANT_REPOSITORY),
      inviteRedemptionRepository: context.module.get<InviteRedemptionRepositoryPort>(
        INVITE_REDEMPTION_REPOSITORY,
      ),
      rewardAppliers: {
        ...appliers,
        PREMIUM_DAYS: {
          async apply(grant) {
            if (shouldFail) throw new Error("billing unavailable");
            await appliers.PREMIUM_DAYS.apply(grant);
          },
        },
      },
      notifier: context.module.get<InviteNotifierPort>(INVITE_NOTIFIER),
      alert: { reportRetryExhausted: () => {} },
      inviteConfig: { isEnabled: true },
      unitOfWork: context.module.get<UnitOfWorkPort>(UNIT_OF_WORK),
      logger: new Logger("GrantInviteRewardsTest"),
    });

    // When
    const failed = flaky.execute({ redemptionId, countsAttempt: true });
    await expect(failed).rejects.toMatchObject({ name: "InviteRewardGrantFailedError" });
    const afterFailure = await client.orm.public.RewardGrant.where({
      recipientId: inviterId,
      rewardType: "PREMIUM_DAYS",
    })
      .select("status", "attempts", "lastErrorCode")
      .all();
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
    await client.orm.public.InviteRedemption.create(
      encodeCreate("InviteRedemption", {
        id: earlierRedemptionId,
        inviterId,
        inviteeId: earlierInviteeId,
        status: "REWARDED",
        timezone: "Asia/Seoul",
        joinedAt: JOINED_AT,
        qualifiedAt: JOINED_AT,
        rewardedAt: JOINED_AT,
        expiresAt: JOINED_AT,
      }),
    );
    await client.orm.public.RewardGrant.create(
      encodeCreate("RewardGrant", {
        recipientId: inviterId,
        sourceType: "INVITE_REDEMPTION",
        sourceId: earlierRedemptionId,
        rewardType: "PREMIUM_DAYS",
        quantity: 30,
        status: "APPLIED",
        appliedAt: JOINED_AT,
        createdAt: JOINED_AT,
      }),
    );
    await recordActivity.execute({
      inviteeId,
      occurredAt: new Date("2028-02-28T03:00:00.000Z"),
    });

    // When
    const qualified = await recordActivity.execute({
      inviteeId,
      occurredAt: new Date("2028-02-29T03:00:00.000Z"),
    });
    await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(qualified).toMatchObject({ status: "qualified", redemptionId, grantCount: 1 });
    expect(
      await client.orm.public.RewardGrant.where({ recipientId: inviterId, sourceId: redemptionId })
        .select("rewardType", "quantity", "status")
        .all(),
    ).toEqual([{ rewardType: "FRIEND_SLOT", quantity: 1, status: "APPLIED" }]);
    expect(await premiumGrantsOf(inviterId)).toEqual([]);
    const repository = context.module.get<InviteRedemptionRepositoryPort>(
      INVITE_REDEMPTION_REPOSITORY,
    );
    expect(await repository.summarizeByInviterId(inviterId)).toMatchObject({
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
    const webhook = context.module.get(HandleWebhookEvent);

    // When
    await Promise.all(
      scenarios.flatMap(({ inviterId, redemptionId }) => [
        grantInviteRewards.execute({ redemptionId, countsAttempt: true }),
        webhook.execute({
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
    const entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
    const reader = context.module.get<PremiumAccessReaderPort>(PREMIUM_ACCESS_READER);
    for (const { inviterId } of scenarios) {
      // 지급이 먼저면 시작한 7일을 구매 시각에 끊어 남은 7일을, 구매가 먼저면 처음부터 7일을 쌓는다
      expect(await reader.getPremiumAccess(inviterId)).toMatchObject({
        source: "STORE",
        periodEndsAt: storeExpiry,
        bankedDays: 7,
      });
      expect(await entitlement.hasPremiumAccessInTx(inviterId)).toBe(true);
      const projection = decodeRecord(
        "User",
        await client.orm.public.User.where({ id: inviterId })
          .select("subscriptionStatus", "subscriptionExpiresAt")
          .first(),
      );
      expect(projection?.subscriptionStatus).toBe("ACTIVE");
      expect(projection?.subscriptionExpiresAt?.getTime()).toBeGreaterThan(storeExpiry.getTime());
    }
  });

  it("윤년 2월을 지나는 최근 30일 상한은 기간 시작 시각 기록을 빼고 1ms 뒤 기록부터 세며 누적 90일이면 더 주지 않는다", async () => {
    // Given
    const inviterId = await createUser("CAPLEAP1");
    const now = new Date("2028-03-15T03:00:00.000Z");
    const windowStart = rewardCapWindowStart(now);
    const grants = [
      { sourceId: "leap-window-start", quantity: 7, createdAt: windowStart },
      { sourceId: "leap-window-in", quantity: 7, createdAt: new Date(windowStart.getTime() + 1) },
      { sourceId: "leap-old", quantity: 76, createdAt: new Date("2027-12-01T00:00:00.000Z") },
    ];
    for (const grant of grants) {
      await client.orm.public.RewardGrant.create(
        encodeCreate("RewardGrant", {
          recipientId: inviterId,
          sourceType: "INVITE_REDEMPTION",
          sourceId: grant.sourceId,
          rewardType: "PREMIUM_DAYS",
          quantity: grant.quantity,
          status: "APPLIED",
          appliedAt: grant.createdAt,
          createdAt: grant.createdAt,
        }),
      );
    }
    const repository = context.module.get<RewardGrantRepositoryPort>(REWARD_GRANT_REPOSITORY);

    // When
    const summary = InviteRewardPolicy.summarize(
      await repository.summarizeInviterRewards(inviterId, windowStart),
    );

    // Then
    expect(windowStart).toEqual(new Date("2028-02-14T03:00:00.000Z"));
    expect(summary).toMatchObject({ premiumDaysInWindow: 7, totalPremiumDays: 90 });
    expect(remainingPremiumDays(summary)).toBe(0);
  });

  it("ADMIN이 초대한 사람이어도 보상 기간·친구 자리·보상 알림을 받고 role과 무제한 한도는 그대로다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("ADMININV", "ADMINVTE");
    await client.orm.public.User.where({ id: inviterId }).updateAndCount(
      encodePatch("User", { role: "ADMIN" }),
    );

    // When
    await grantInviteRewards.execute({ redemptionId, countsAttempt: true });

    // Then
    expect(await premiumGrantsOf(inviterId)).toEqual([
      expect.objectContaining({ durationDays: 7, status: "ACTIVE" }),
    ]);
    expect(
      await client.orm.public.ResourceBonus.where({ userId: inviterId }).select("quantity").all(),
    ).toEqual([{ quantity: 1 }]);
    expect(await rewardedNotices()).toEqual([{ userId: inviterId, body: expect.any(String) }]);
    expect(
      (await client.orm.public.User.where({ id: inviterId }).select("role").first())?.role,
    ).toBe("ADMIN");
    const entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
    expect(
      (await entitlement.getResourceLimitInTx(inviterId, Resource.FRIEND)).maxCount,
    ).toBeNull();
  });

  it("정비 작업은 마감이 지난 수락만 거절하고 남은 지급이 있는 수락의 작업을 다시 만든다", async () => {
    // Given
    const stale = await redeemed("MNTINVR1", "MNTINVE1");
    const fresh = await qualified("MNTINVR2", "MNTINVE2");
    const maintenance = context.module.get(ExpireStaleRedemptions);

    // When
    const result = await maintenance.execute({
      now: new Date("2028-03-20T00:00:00.000Z"),
      runDate: "2028-03-20",
    });

    // Then
    expect(result.expiredCount).toBe(1);
    expect(result.retriedCount).toBe(1);
    const statuses = await client.orm.public.InviteRedemption.where((row) =>
      row.id.in([stale.redemptionId, fresh.redemptionId]),
    )
      .select("id", "status", "rejectionReason")
      .all();
    expect(statuses).toEqual(
      expect.arrayContaining([
        { id: stale.redemptionId, status: "REJECTED", rejectionReason: "EXPIRED" },
        { id: fresh.redemptionId, status: "QUALIFIED", rejectionReason: null },
      ]),
    );
  });

  it("시간대를 서울에서 키리티마티로 바꿔 같은 날 두 번 완료해도 수락 때 고정한 날짜로만 센다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("TZINVITR", "TZINVITE");
    const subscriber = context.module.get(InviteeActivitySubscriber);
    // KST 2028-02-28 23:00. 키리티마티(UTC+14)로는 이미 3월 1일이다
    vi.setSystemTime(new Date("2028-02-28T14:00:00.000Z"));
    await subscriber.handle(new TodoToggledEvent(1, inviteeId, true, "Asia/Seoul"));

    // When
    vi.setSystemTime(new Date("2028-02-28T14:01:00.000Z"));
    await subscriber.handle(new TodoToggledEvent(1, inviteeId, true, "Pacific/Kiritimati"));

    // Then
    const redemption = await client.orm.public.InviteRedemption.where({ id: redemptionId })
      .select("status")
      .include("activeDays", (day) => day.count())
      .first();
    expect(redemption).toEqual({ status: "JOINED", activeDays: 1 });
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
      occurredAt: new Date("2028-02-28T03:00:00.000Z"),
    });

    // When
    const result = await recordActivity.execute({
      inviteeId: secondId,
      occurredAt: new Date("2028-02-29T03:00:00.000Z"),
    });

    // Then
    expect(second).toMatchObject({ outcome: "REDEEMED", rewards: [] });
    expect(result).toMatchObject({ status: "qualified", grantCount: 0 });
    expect(
      await client.orm.public.RewardGrant.where({ recipientId: inviterId }).select("id").all(),
    ).toEqual([]);
  });

  it("기능이 꺼진 동안은 사용 시작과 원장만 남기고 지급하지 않다가 다시 켜면 정비 작업이 적용한다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("OFFINVTR", "OFFINVTE");
    const disabled = grantRewardsWith({ isEnabled: false });
    const disabledResult = await disabled.execute({ redemptionId, countsAttempt: true });
    const pending = await client.orm.public.RewardGrant.where({ recipientId: inviterId })
      .select("status", "attempts")
      .all();

    // When
    const maintenance = await context.module.get(ExpireStaleRedemptions).execute({
      now: new Date("2028-03-01T00:00:00.000Z"),
      runDate: "2028-03-01",
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
        await client.orm.public.RewardGrant.where({ recipientId: inviterId }).select("status").all()
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
      { userId: inviterId, body: "프리미엄 7일을 받았고, 친구도 1명 더 추가할 수 있어" },
    ]);
  });

  it("큐 재시도는 시도 횟수를 늘리지 않고 마지막 정비 재시도가 실패하면 한 번 알린다", async () => {
    // Given
    const { inviterId, redemptionId } = await qualified("CAPATTMR", "CAPATTME");
    const exhausted: string[] = [];
    const failing = grantRewardsWith({ failing: () => true, exhausted });
    await expect(failing.execute({ redemptionId, countsAttempt: true })).rejects.toThrow();
    await expect(failing.execute({ redemptionId, countsAttempt: false })).rejects.toThrow();
    const afterQueueRetry = await client.orm.public.RewardGrant.where({
      recipientId: inviterId,
      rewardType: "PREMIUM_DAYS",
    })
      .select("attempts")
      .first();
    await client.orm.public.RewardGrant.where({
      recipientId: inviterId,
      rewardType: "PREMIUM_DAYS",
    }).updateAndCount(encodePatch("RewardGrant", { attempts: 4 }));

    // When
    await expect(failing.execute({ redemptionId, countsAttempt: true })).rejects.toThrow();
    const retryable = await context.module
      .get<RewardGrantRepositoryPort>(REWARD_GRANT_REPOSITORY)
      .findRetryableSourceIds({
        maxAttempts: INVITE_REWARD_MAX_ATTEMPTS,
        createdBefore: new Date("2028-03-10T00:00:00.000Z"),
        limit: 10,
      });
    const totals = await context.module
      .get<RewardGrantRepositoryPort>(REWARD_GRANT_REPOSITORY)
      .summarizeInviterRewards(inviterId, new Date("2028-02-01T00:00:00.000Z"));

    // Then
    expect(afterQueueRetry).toEqual({ attempts: 1 });
    expect(exhausted).toHaveLength(1);
    expect(retryable).not.toContain(redemptionId);
    // 재시도를 다 쓴 프리미엄은 받지 못한 보상이라 상한 집계에서 빠진다
    expect(totals.find((total) => total.rewardType === "PREMIUM_DAYS")).toBeUndefined();
  });
});
