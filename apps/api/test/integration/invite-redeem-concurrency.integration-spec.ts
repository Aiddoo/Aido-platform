import { ErrorCode } from "@aido/api/errors";
import { and } from "@prisma/orm-postgres/orm-client";

import { INVITE_CONFIG } from "#api/modules/social/application/ports/invites/invite.config.port";
import { GetMyInvite } from "#api/modules/social/application/use-cases/invites/get-my-invite.use-case";
import { RedeemInvite } from "#api/modules/social/application/use-cases/invites/redeem-invite.use-case";
import { RotateInviteCode } from "#api/modules/social/application/use-cases/invites/rotate-invite-code.use-case";
import { encodeCreate } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

describe("초대 수락 동시성 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let redeemInvite: RedeemInvite;
  let getMyInvite: GetMyInvite;

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
  });

  beforeEach(async () => {
    await context.reset();
  });

  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function createUser(userTag: string): Promise<string> {
    const id = createEntityId();
    await client.orm.public.User.create(
      encodeCreate(
        "User",
        UserFixture.create({ id, userTag, email: `${userTag.toLowerCase()}@example.test` }),
      ),
    );
    return id;
  }

  async function count(model: "InviteRedemption" | "RewardGrant" | "RewardClaim") {
    const result = await client.orm.public[model].aggregate((aggregate) => ({
      count: aggregate.count(),
    }));
    return result.count;
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
    expect(await count("InviteRedemption")).toBe(1);
    expect(await count("RewardGrant")).toBe(1);
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
    expect(await count("InviteRedemption")).toBe(1);
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
      context.module.get(RotateInviteCode).execute({ inviterId }),
    ]);

    // Then
    expect(rotated.status).toBe("fulfilled");
    if (redeemed.status === "fulfilled") {
      expect(redeemed.value.outcome).toBe("REDEEMED");
      expect(await count("InviteRedemption")).toBe(1);
    } else {
      expect(redeemed.reason).toMatchObject({ errorCode: ErrorCode.INVITE_2102 });
      expect(await count("InviteRedemption")).toBe(0);
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
    expect(await count("InviteRedemption")).toBe(4);
    expect(await count("RewardGrant")).toBe(1);
    // 기기 claim에서 진 수락은 초대한 사람 보상 자격도 없고, 함께 넣으려던 신원 claim도 남기지 않는다
    const redemptions = await client.orm.public.InviteRedemption.where({ inviterId })
      .select("inviterRewardEligible", "timezone")
      .all();
    expect(redemptions.filter((row) => row.inviterRewardEligible)).toHaveLength(1);
    expect(new Set(redemptions.map((row) => row.timezone))).toEqual(new Set(["Asia/Seoul"]));
    expect(await count("RewardClaim")).toBe(2);
  });

  it("처음 수락 뒤 친구를 끊고 같은 초대를 다시 누르면 추정하지 않고 친구 관계를 다시 맞춘다", async () => {
    // Given
    const inviterId = await createUser("REPLAYIN");
    const inviteeId = await createUser("REPLAYEE");
    const { code } = await getMyInvite.execute({ inviterId });
    const request = { inviteeId, code, installationId: "replay-device", timezone: "Asia/Seoul" };
    const first = await redeemInvite.execute(request);
    await client.orm.public.Follow.where((row) =>
      and(row.followerId.in([inviterId, inviteeId]), row.followingId.in([inviterId, inviteeId])),
    ).deleteAndCount();

    // When
    const replayed = await redeemInvite.execute({ ...request, timezone: "Pacific/Kiritimati" });

    // Then
    expect(first).toMatchObject({ outcome: "REDEEMED", friendship: "FRIENDS", isReplay: false });
    expect(replayed).toMatchObject({ outcome: "REDEEMED", friendship: "FRIENDS", isReplay: true });
    expect(await count("InviteRedemption")).toBe(1);
    expect(
      await client.orm.public.InviteRedemption.where({ inviteeId }).select("timezone").first(),
    ).toEqual({ timezone: "Asia/Seoul" });
  });
});
