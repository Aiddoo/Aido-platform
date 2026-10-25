import { FOLLOW_LIMITS, myInviteResponseSchema, redeemInviteResponseSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { and } from "@prisma/orm-postgres/orm-client";
import request from "supertest";

import { INVITE_CONFIG } from "#api/modules/social/application/ports/invites/invite.config.port";
import { encodePatch } from "#api/platform/database/database-records";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

import type { VerifiedUser } from "./helpers/e2e-helpers.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const PASSWORD = "Test1234!";

describe("초대 수락 HTTP (실제 DB)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(INVITE_CONFIG).useValue({ isEnabled: true }),
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  async function inviteCodeOf(inviter: VerifiedUser): Promise<string> {
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/invites/me")
      .set("Authorization", `Bearer ${inviter.accessToken}`)
      .expect(200);
    return myInviteResponseSchema.parse(response.body.data).code;
  }

  function redeem(invitee: VerifiedUser, code: string, installationId?: string) {
    return request(ctx.app.getHttpServer())
      .post(`/v1/invites/${code}/redeem`)
      .set("Authorization", `Bearer ${invitee.accessToken}`)
      .send(installationId === undefined ? {} : { installationId });
  }

  async function pendingGrantsOf(userId: string) {
    return ctx.testDatabase
      .getClient()
      .orm.public.RewardGrant.where((grant) =>
        and(grant.recipientId.eq(userId), grant.status.eq("PENDING")),
      )
      .select("rewardType", "quantity")
      .all();
  }

  it("새 사용자는 친구가 되고 7일 보상을 받으며 응답을 놓쳐 다시 수락하면 같은 결과를 돌려준다", async () => {
    // Given
    const inviter = await ctx.helpers.createVerifiedUser("redeem-inviter@test.com", PASSWORD, {
      name: "매튜",
    });
    const invitee = await ctx.helpers.createVerifiedUser("redeem-invitee@test.com", PASSWORD, {
      name: "존",
    });
    const code = await inviteCodeOf(inviter);

    // When
    const first = await redeem(invitee, code, "device-1").expect(200);
    const repeated = await redeem(invitee, code, "device-1").expect(200);

    // Then
    expect(redeemInviteResponseSchema.parse(first.body.data)).toEqual({
      outcome: "REDEEMED",
      inviter: {
        userId: inviter.userId,
        name: "매튜",
        userTag: inviter.userTag,
        profileImage: null,
      },
      friendship: "FRIENDS",
      rewards: [{ rewardType: "PREMIUM_DAYS", quantity: 7 }],
    });
    expect(repeated.body.data).toEqual(first.body.data);
    expect(await pendingGrantsOf(invitee.userId)).toEqual([
      { rewardType: "PREMIUM_DAYS", quantity: 7 },
    ]);
    const joined = await ctx.testDatabase
      .getClient()
      .orm.public.Notification.where((row) =>
        and(row.userId.eq(inviter.userId), row._type.eq("INVITE_JOINED")),
      )
      .select("title", "metadata")
      .all();
    expect(joined).toHaveLength(1);
    expect(joined[0]?.title).toContain("존");
    expect(joined[0]?.metadata).toMatchObject({ redemptionId: expect.any(String) });
  });

  it("같은 기기로 다른 계정이 수락하면 친구는 되지만 보상은 받지 않는다", async () => {
    // Given
    const inviter = await ctx.helpers.createVerifiedUser("device-inviter@test.com", PASSWORD);
    const first = await ctx.helpers.createVerifiedUser("device-first@test.com", PASSWORD);
    const second = await ctx.helpers.createVerifiedUser("device-second@test.com", PASSWORD);
    const code = await inviteCodeOf(inviter);
    await redeem(first, code, "shared-device").expect(200);

    // When
    const response = await redeem(second, code, "shared-device").expect(200);

    // Then
    expect(redeemInviteResponseSchema.parse(response.body.data)).toMatchObject({
      outcome: "REDEEMED",
      friendship: "FRIENDS",
      rewards: [],
    });
    expect(await pendingGrantsOf(second.userId)).toEqual([]);
  });

  it("가입한 지 7일이 지난 사용자는 보상 없이 CONNECTED로 친구를 맺는다", async () => {
    // Given
    const inviter = await ctx.helpers.createVerifiedUser("old-inviter@test.com", PASSWORD);
    const veteran = await ctx.helpers.createVerifiedUser("old-invitee@test.com", PASSWORD);
    await ctx.testDatabase
      .getClient()
      .orm.public.User.where({ id: veteran.userId })
      .updateAndCount(encodePatch("User", { createdAt: subtractDays(8) }));
    const code = await inviteCodeOf(inviter);

    // When
    const response = await redeem(veteran, code, "veteran-device").expect(200);

    // Then
    expect(redeemInviteResponseSchema.parse(response.body.data)).toMatchObject({
      outcome: "CONNECTED",
      friendship: "FRIENDS",
    });
    expect(await pendingGrantsOf(veteran.userId)).toEqual([]);
  });

  it("초대한 사람 친구 자리가 꽉 차 있으면 친구 요청만 보내고 보상 기록은 남긴다", async () => {
    // Given
    const inviter = await ctx.helpers.createVerifiedUser("full-inviter@test.com", PASSWORD);
    for (let index = 0; index < FOLLOW_LIMITS.FREE_MAX_FRIENDS; index++) {
      const friend = await ctx.helpers.createVerifiedUser(
        `full-friend-${index}@test.com`,
        PASSWORD,
      );
      await ctx.helpers.createFriendship(inviter, friend);
    }
    const invitee = await ctx.helpers.createVerifiedUser("full-invitee@test.com", PASSWORD);
    const code = await inviteCodeOf(inviter);

    // When
    const response = await redeem(invitee, code, "full-device").expect(200);

    // Then
    expect(redeemInviteResponseSchema.parse(response.body.data)).toMatchObject({
      outcome: "REDEEMED",
      friendship: "REQUESTED",
      rewards: [{ rewardType: "PREMIUM_DAYS", quantity: 7 }],
    });
  });

  it("내 코드는 INVITE_2103, 바뀐 코드는 INVITE_2102, 없는 코드는 INVITE_2101이다", async () => {
    // Given
    const inviter = await ctx.helpers.createVerifiedUser("error-inviter@test.com", PASSWORD);
    const invitee = await ctx.helpers.createVerifiedUser("error-invitee@test.com", PASSWORD);
    const oldCode = await inviteCodeOf(inviter);
    await request(ctx.app.getHttpServer())
      .post("/v1/invites/me/rotate")
      .set("Authorization", `Bearer ${inviter.accessToken}`)
      .expect(200);
    const newCode = await inviteCodeOf(inviter);

    // When
    const self = await redeem(inviter, newCode).expect(400);
    const revoked = await redeem(invitee, oldCode).expect(410);
    const unknown = await redeem(invitee, "BBBBBB").expect(404);

    // Then
    expect(self.body.error.code).toBe(ErrorCode.INVITE_2103);
    expect(revoked.body.error.code).toBe(ErrorCode.INVITE_2102);
    expect(unknown.body.error.code).toBe(ErrorCode.INVITE_2101);
  });

  it("이미 다른 초대를 수락했으면 INVITE_2104이고 이미 친구인 초대한 사람은 ALREADY_FRIENDS다", async () => {
    // Given
    const firstInviter = await ctx.helpers.createVerifiedUser("first-inviter@test.com", PASSWORD);
    const secondInviter = await ctx.helpers.createVerifiedUser("second-inviter@test.com", PASSWORD);
    const invitee = await ctx.helpers.createVerifiedUser("double-invitee@test.com", PASSWORD);
    await redeem(invitee, await inviteCodeOf(firstInviter), "double-device").expect(200);

    // When
    const other = await redeem(invitee, await inviteCodeOf(secondInviter)).expect(409);
    await ctx.helpers.createFriendship(invitee, secondInviter);
    const friends = await redeem(invitee, await inviteCodeOf(secondInviter)).expect(200);

    // Then
    expect(other.body.error.code).toBe(ErrorCode.INVITE_2104);
    expect(redeemInviteResponseSchema.parse(friends.body.data).outcome).toBe("ALREADY_FRIENDS");
  });

  it("초대한 사람이 먼저 보낸 친구 요청이 있으면 수락으로 바꿔 친구가 된다", async () => {
    // Given
    const inviter = await ctx.helpers.createVerifiedUser("pending-inviter@test.com", PASSWORD);
    const invitee = await ctx.helpers.createVerifiedUser("pending-invitee@test.com", PASSWORD);
    await request(ctx.app.getHttpServer())
      .post(`/v1/follows/${invitee.userTag}`)
      .set("Authorization", `Bearer ${inviter.accessToken}`)
      .expect(201);
    const code = await inviteCodeOf(inviter);

    // When
    const response = await redeem(invitee, code, "pending-device").expect(200);

    // Then
    expect(redeemInviteResponseSchema.parse(response.body.data)).toMatchObject({
      outcome: "REDEEMED",
      friendship: "FRIENDS",
    });
    const follows = await ctx.testDatabase
      .getClient()
      .orm.public.Follow.where((row) =>
        and(row.followerId.eq(inviter.userId), row.followingId.eq(invitee.userId)),
      )
      .select("status")
      .all();
    expect(follows).toEqual([{ status: "ACCEPTED" }]);
  });

  it("탈퇴 대기 중인 사람의 초대 코드는 없는 코드로 응답한다", async () => {
    // Given
    const inviter = await ctx.helpers.createVerifiedUser("deleted-inviter@test.com", PASSWORD);
    const code = await inviteCodeOf(inviter);
    await ctx.testDatabase
      .getClient()
      .orm.public.User.where({ id: inviter.userId })
      .updateAndCount(encodePatch("User", { deletedAt: new Date() }));

    // When
    const preview = await request(ctx.app.getHttpServer()).get(`/v1/invites/${code}`).expect(404);

    // Then
    expect(preview.body.error.code).toBe(ErrorCode.INVITE_2101);
  });
});
