import { Logger } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { Resource } from "#api/modules/access/access-entitlement.public";
import { HandleWebhookEvent } from "#api/modules/billing/application/use-cases/subscriptions/handle-webhook-event.use-case";
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

  async function premiumGrantsOf(userId: string) {
    return decodeRecord(
      "PremiumGrant",
      await client.orm.public.PremiumGrant.where({ userId })
        .select("durationDays", "status", "endsAt")
        .all(),
    );
  }

  it("같은 지급 작업이 동시에 두 번 돌아도 보상 기간은 하나만 생긴다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("JOBINVTR", "JOBINVTE");

    // When
    const results = await Promise.all([
      grantInviteRewards.execute({ redemptionId }),
      grantInviteRewards.execute({ redemptionId }),
    ]);
    const rerun = await grantInviteRewards.execute({ redemptionId });

    // Then
    expect(results.map((result) => result.appliedCount).sort()).toEqual([0, 1]);
    expect(rerun.appliedCount).toBe(0);
    expect(await premiumGrantsOf(inviteeId)).toEqual([
      { durationDays: 7, status: "ACTIVE", endsAt: new Date("2028-03-06T03:00:00.000Z") },
    ]);
  });

  it("서로 다른 이틀 할 일을 마치면 초대한 사람에게 7일과 친구 자리를 주고 보상 완료로 바꾼다", async () => {
    // Given
    const { inviterId, inviteeId, redemptionId } = await redeemed("QUALINVR", "QUALINVE");
    await recordActivity.execute({
      inviteeId,
      timezone: "Asia/Seoul",
      occurredAt: new Date("2028-02-28T14:59:00.000Z"),
    });

    // When
    const qualified = await recordActivity.execute({
      inviteeId,
      timezone: "Asia/Seoul",
      occurredAt: new Date("2028-02-28T15:01:00.000Z"),
    });
    await grantInviteRewards.execute({ redemptionId });

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
      { userId: inviterId, body: "프리미엄 7일과 친구 자리 1개를 받았어" },
    ]);
  });

  it("적용이 실패하면 FAILED와 시도 횟수를 남기고 다음 실행에서 한 번만 적용한다", async () => {
    // Given
    const { inviteeId, redemptionId } = await redeemed("FAILINVR", "FAILINVE");
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
      unitOfWork: context.module.get<UnitOfWorkPort>(UNIT_OF_WORK),
      logger: new Logger("GrantInviteRewardsTest"),
    });

    // When
    const failed = flaky.execute({ redemptionId });
    await expect(failed).rejects.toMatchObject({ name: "InviteRewardGrantFailedError" });
    const afterFailure = await client.orm.public.RewardGrant.where({ recipientId: inviteeId })
      .select("status", "attempts", "lastErrorCode")
      .all();
    shouldFail = false;
    const retried = await flaky.execute({ redemptionId });

    // Then
    expect(afterFailure).toEqual([
      { status: "FAILED", attempts: 1, lastErrorCode: "APPLY_FAILED" },
    ]);
    expect(await premiumGrantsOf(inviteeId)).toHaveLength(1);
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
      timezone: "Asia/Seoul",
      occurredAt: new Date("2028-02-28T03:00:00.000Z"),
    });

    // When
    const qualified = await recordActivity.execute({
      inviteeId,
      timezone: "Asia/Seoul",
      occurredAt: new Date("2028-02-29T03:00:00.000Z"),
    });
    await grantInviteRewards.execute({ redemptionId });

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

  it("보상 지급 작업과 스토어 첫 결제 웹훅이 동시에 와도 보상 기간은 하나이고 프리미엄은 끊기지 않는다", async () => {
    // Given
    const storeExpiry = new Date("2028-03-28T03:00:00.000Z");
    const scenarios = await Promise.all(
      ["A", "B", "C"].map((suffix) => redeemed(`RACEIVR${suffix}`, `RACEIVE${suffix}`)),
    );
    const webhook = context.module.get(HandleWebhookEvent);

    // When
    await Promise.all(
      scenarios.flatMap(({ inviteeId, redemptionId }) => [
        grantInviteRewards.execute({ redemptionId }),
        webhook.execute({
          body: SubscriptionEventBuilder.initialPurchase()
            .withAppUserId(inviteeId)
            .withOriginalTransactionId(`race-${inviteeId}`)
            .withTransactionId(`race-${inviteeId}`)
            .withEventId(`race-${inviteeId}`)
            .withExpirationAtMs(storeExpiry.getTime())
            .build(),
        }),
      ]),
    );

    // Then
    const entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
    for (const { inviteeId } of scenarios) {
      const grants = await premiumGrantsOf(inviteeId);
      expect(grants).toHaveLength(1);
      expect(grants[0]?.durationDays).toBe(7);
      expect(await entitlement.hasPremiumAccessInTx(inviteeId)).toBe(true);
      const projection = decodeRecord(
        "User",
        await client.orm.public.User.where({ id: inviteeId })
          .select("subscriptionStatus", "subscriptionExpiresAt")
          .first(),
      );
      expect(projection?.subscriptionStatus).toBe("ACTIVE");
      expect(projection?.subscriptionExpiresAt?.getTime()).toBeGreaterThanOrEqual(
        storeExpiry.getTime(),
      );
    }
  });

  it("정비 작업은 마감이 지난 수락만 거절하고 남은 지급이 있는 수락의 작업을 다시 만든다", async () => {
    // Given
    const stale = await redeemed("MNTINVR1", "MNTINVE1");
    const fresh = await redeemed("MNTINVR2", "MNTINVE2");
    await client.orm.public.InviteRedemption.where({ id: fresh.redemptionId }).updateAndCount(
      encodePatch("InviteRedemption", { expiresAt: new Date("2028-04-01T00:00:00.000Z") }),
    );
    const maintenance = context.module.get(ExpireStaleRedemptions);

    // When
    const result = await maintenance.execute({
      now: new Date("2028-03-20T00:00:00.000Z"),
      runDate: "2028-03-20",
    });

    // Then
    expect(result.expiredCount).toBe(1);
    expect(result.retriedCount).toBe(2);
    const statuses = await client.orm.public.InviteRedemption.where((row) =>
      row.id.in([stale.redemptionId, fresh.redemptionId]),
    )
      .select("id", "status", "rejectionReason")
      .all();
    expect(statuses).toEqual(
      expect.arrayContaining([
        { id: stale.redemptionId, status: "REJECTED", rejectionReason: "EXPIRED" },
        { id: fresh.redemptionId, status: "JOINED", rejectionReason: null },
      ]),
    );
  });
});
