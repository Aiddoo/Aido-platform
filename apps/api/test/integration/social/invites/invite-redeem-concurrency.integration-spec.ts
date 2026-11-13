import { ErrorCode } from "@aido/api/errors";
import { and, count as countRows, eq, inArray } from "drizzle-orm";

import { PremiumAccessReaderPort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { InviteConfigPort } from "#api/modules/social/invites/application/ports/invite-config.port";
import { GetMyInviteUseCase } from "#api/modules/social/invites/application/use-cases/get-my-invite.use-case";
import { RedeemInviteUseCase } from "#api/modules/social/invites/application/use-cases/redeem-invite.use-case";
import { RotateInviteCodeUseCase } from "#api/modules/social/invites/application/use-cases/rotate-invite-code.use-case";
import {
  follow,
  inviteRedemption,
  premiumGrant,
  rewardClaim,
  rewardGrant,
  user,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

describe("초대 수락 동시성 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let redeemInvite: RedeemInviteUseCase;
  let getMyInvite: GetMyInviteUseCase;

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
  });

  beforeEach(async () => {
    await context.reset();
  });

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function createUser(userTag: string): Promise<string> {
    const id = createEntityId();
    await client
      .insert(user)
      .values(UserFixture.create({ id, userTag, email: `${userTag.toLowerCase()}@example.test` }));
    return id;
  }

  async function count(
    table: typeof inviteRedemption | typeof rewardGrant | typeof rewardClaim | typeof premiumGrant,
  ) {
    const [result] = await client.select({ count: countRows() }).from(table);
    return result?.count ?? 0;
  }

  it("같은 초대받은 사람이 동시에 여러 번 수락해도 수락 기록과 보상은 한 번만 남는다", async () => {
    // Given
    const inviterId = await createUser("CONCINV1");
    const inviteeId = await createUser("CONCINV2");
    const { code } = await getMyInvite.execute({ inviterId });

    // When
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        redeemInvite.execute({
          inviteeId,
          code,
          installationId: `device-${index}`,
          timezone: "Asia/Seoul",
        }),
      ),
    );

    // Then
    const outcomes = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value.outcome] : [],
    );
    const fulfilled = results.flatMap((result) =>
      result.status === "fulfilled" && result.value.outcome === "REDEEMED" ? [result.value] : [],
    );
    expect(outcomes).toEqual(Array.from({ length: 6 }, () => "REDEEMED"));
    expect(fulfilled.filter((result) => !result.isReplay)).toHaveLength(1);
    expect(new Set(fulfilled.map((result) => result.redemptionId)).size).toBe(1);
    expect(await count(inviteRedemption)).toBe(1);
    expect(await count(rewardGrant)).toBe(1);
    expect(await count(premiumGrant)).toBe(1);
  });

  it("초대 수락과 초대받은 사람의 스토어 구매 웹훅이 동시에 와도 교착 없이 보상을 한 번만 남긴다", async () => {
    // Given
    const inviterId = await createUser("CONCPUR1");
    const inviteeId = await createUser("CONCPUR2");
    const { code } = await getMyInvite.execute({ inviterId });
    const purchasedAt = Date.now();
    const purchase = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(inviteeId)
      .withOriginalTransactionId("redeem-purchase-chain")
      .withTransactionId("redeem-purchase-chain")
      .withEventId("redeem-purchase")
      .withPurchasedAtMs(purchasedAt)
      .withExpirationAtMs(purchasedAt + 30 * 24 * 60 * 60 * 1000)
      .build();

    // When
    const [redeemed] = await Promise.all([
      redeemInvite.execute({
        inviteeId,
        code,
        installationId: "purchase-device",
        timezone: "Asia/Seoul",
      }),
      context.module.get(RevenueCatWebhookReceiver).receive({ body: purchase }),
    ]);

    // Then
    expect(redeemed.outcome).toBe("REDEEMED");
    const access = await context.module
      .get<PremiumAccessReaderPort>(PremiumAccessReaderPort)
      .getPremiumAccess(UserId.reconstitute(inviteeId));
    expect(access).toMatchObject({ source: "STORE", bankedDays: 7 });
    expect(
      await client
        .select({ status: rewardGrant.status })
        .from(rewardGrant)
        .where(eq(rewardGrant.recipientId, inviteeId)),
    ).toEqual([{ status: "APPLIED" }]);
  });

  it("서로의 초대를 동시에 수락해도 잠금 순서가 같아 교착 없이 한쪽만 수락된다", async () => {
    // Given
    const firstId = await createUser("CROSSAAA");
    const secondId = await createUser("CROSSBBB");
    const [first, second] = await Promise.all([
      getMyInvite.execute({ inviterId: firstId }),
      getMyInvite.execute({ inviterId: secondId }),
    ]);

    // When
    const results = await Promise.allSettled([
      redeemInvite.execute({
        inviteeId: firstId,
        code: second.code,
        installationId: "cross-a",
        timezone: "Asia/Seoul",
      }),
      redeemInvite.execute({
        inviteeId: secondId,
        code: first.code,
        installationId: "cross-b",
        timezone: "Asia/Seoul",
      }),
    ]);

    // Then
    const outcomes = results.map((result) =>
      result.status === "fulfilled" ? result.value.outcome : "rejected",
    );
    expect(outcomes.sort()).toEqual(["ALREADY_FRIENDS", "REDEEMED"]);
    expect(await count(inviteRedemption)).toBe(1);
  });

  it("수락 중에 초대 코드를 재발급하면 수락은 이전 코드 기준으로 끝나거나 INVITE_2102다", async () => {
    // Given
    const inviterId = await createUser("ROTATEIN");
    const inviteeId = await createUser("ROTATEEE");
    const { code } = await getMyInvite.execute({ inviterId });

    // When
    const [redeemed, rotated] = await Promise.allSettled([
      redeemInvite.execute({
        inviteeId,
        code,
        installationId: "rotate-device",
        timezone: "Asia/Seoul",
      }),
      context.module.get(RotateInviteCodeUseCase).execute({ inviterId }),
    ]);

    // Then
    expect(rotated.status).toBe("fulfilled");
    if (redeemed.status === "fulfilled") {
      expect(redeemed.value.outcome).toBe("REDEEMED");
      expect(await count(inviteRedemption)).toBe(1);
    } else {
      expect(redeemed.reason).toMatchObject({ errorCode: ErrorCode.INVITE_2102 });
      expect(await count(inviteRedemption)).toBe(0);
    }
  });

  it("같은 기기로 여러 계정이 동시에 수락하면 모두 친구가 되고 보상은 하나만 받는다", async () => {
    // Given
    const inviterId = await createUser("DEVICEIN");
    const inviteeIds = await Promise.all(
      ["DEVICEA1", "DEVICEA2", "DEVICEA3", "DEVICEA4"].map((tag) => createUser(tag)),
    );
    const { code } = await getMyInvite.execute({ inviterId });

    // When
    const results = await Promise.all(
      inviteeIds.map((inviteeId) =>
        redeemInvite.execute({
          inviteeId,
          code,
          installationId: "shared-device",
          timezone: "Asia/Seoul",
        }),
      ),
    );

    // Then
    expect(results.map((result) => result.outcome)).toEqual([
      "REDEEMED",
      "REDEEMED",
      "REDEEMED",
      "REDEEMED",
    ]);
    const rewarded = results.filter(
      (result) => result.outcome === "REDEEMED" && result.rewards.length > 0,
    );
    expect(rewarded).toHaveLength(1);
    expect(await count(inviteRedemption)).toBe(4);
    expect(await count(rewardGrant)).toBe(1);
    const redemptions = await client.query.inviteRedemption.findMany({
      columns: { inviterRewardEligible: true, timezone: true },
      where: { inviterId },
    });
    expect(redemptions.filter((row) => row.inviterRewardEligible)).toHaveLength(1);
    expect(new Set(redemptions.map((row) => row.timezone))).toEqual(new Set(["Asia/Seoul"]));
    expect(await count(rewardClaim)).toBe(2);
  });

  it("처음 수락 뒤 친구를 끊고 같은 초대를 다시 누르면 추정하지 않고 친구 관계를 다시 맞춘다", async () => {
    // Given
    const inviterId = await createUser("REPLAYIN");
    const inviteeId = await createUser("REPLAYEE");
    const { code } = await getMyInvite.execute({ inviterId });
    const request = { inviteeId, code, installationId: "replay-device", timezone: "Asia/Seoul" };
    const first = await redeemInvite.execute(request);
    await client
      .delete(follow)
      .where(
        and(
          inArray(follow.followerId, [inviterId, inviteeId]),
          inArray(follow.followingId, [inviterId, inviteeId]),
        ),
      );

    // When
    const replayed = await redeemInvite.execute({ ...request, timezone: "Pacific/Kiritimati" });

    // Then
    expect(first).toMatchObject({ outcome: "REDEEMED", friendship: "FRIENDS", isReplay: false });
    expect(replayed).toMatchObject({ outcome: "REDEEMED", friendship: "FRIENDS", isReplay: true });
    expect(await count(inviteRedemption)).toBe(1);
    expect(
      await client.query.inviteRedemption.findFirst({
        columns: { timezone: true },
        where: { inviteeId },
      }),
    ).toEqual({ timezone: "Asia/Seoul" });
  });
});
