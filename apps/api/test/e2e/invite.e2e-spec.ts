import {
  inviteAvailabilityResponseSchema,
  invitedFriendsListResponseSchema,
  invitePreviewResponseSchema,
  myInviteResponseSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { INVITE_CONFIG } from "#api/modules/social/application/ports/invites/invite.config.port";
import { encodeCreate } from "#api/platform/database/database-records";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const PASSWORD = "Test1234!";

describe("친구 초대 HTTP 계약 (실제 DB)", () => {
  describe("기능이 켜져 있으면", () => {
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

    async function getMyInvite(accessToken: string) {
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/invites/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      return myInviteResponseSchema.parse(response.body.data);
    }

    it("처음 조회에서 코드를 한 번만 발급하고 다시 조회해도 같은 코드와 빈 요약을 반환한다", async () => {
      // Given
      const inviter = await ctx.helpers.createVerifiedUser("invite-owner@test.com", PASSWORD);

      // When
      const concurrent = await Promise.all(
        Array.from({ length: 5 }, () => getMyInvite(inviter.accessToken)),
      );
      const repeated = await getMyInvite(inviter.accessToken);

      // Then
      expect(new Set(concurrent.map((invite) => invite.code)).size).toBe(1);
      expect(repeated).toMatchObject({
        code: concurrent[0]?.code,
        link: `https://aido.kr/i/${concurrent[0]?.code}`,
        waitingCount: 0,
        qualifiedCount: 0,
        premiumDaysInWindow: 0,
        totalPremiumDays: 0,
        premiumCapState: "AVAILABLE",
        nextMilestone: {
          qualifiedCount: 1,
          rewards: [
            { rewardType: "PREMIUM_DAYS", quantity: 7 },
            { rewardType: "FRIEND_SLOT", quantity: 1 },
          ],
        },
        rewardsEarned: [],
      });
    });

    it("로그인 없이 소문자·하이픈 코드로 미리보기하고, 재발급하면 이전 코드는 INVITE_2102다", async () => {
      // Given
      const inviter = await ctx.helpers.createVerifiedUser("invite-preview@test.com", PASSWORD, {
        name: "매튜",
      });
      const { code } = await getMyInvite(inviter.accessToken);
      const pasted = `${code.slice(0, 3).toLowerCase()}-${code.slice(3).toLowerCase()}`;

      // When
      const preview = await request(ctx.app.getHttpServer())
        .get(`/v1/invites/${pasted}`)
        .expect(200);
      const rotated = await request(ctx.app.getHttpServer())
        .post("/v1/invites/me/rotate")
        .set("Authorization", `Bearer ${inviter.accessToken}`)
        .expect(200);
      const revoked = await request(ctx.app.getHttpServer()).get(`/v1/invites/${code}`).expect(410);
      const unknown = await request(ctx.app.getHttpServer()).get("/v1/invites/BBBBBB").expect(404);
      const malformed = await request(ctx.app.getHttpServer())
        .get("/v1/invites/AB0O1I")
        .expect(400);

      // Then
      expect(invitePreviewResponseSchema.parse(preview.body.data).inviter).toMatchObject({
        name: "매튜",
      });
      // 비로그인 미리보기에는 친구 요청에 쓰는 태그와 사용자 ID를 싣지 않는다
      expect(preview.body.data.inviter).not.toHaveProperty("userId");
      expect(preview.body.data.inviter).not.toHaveProperty("userTag");
      expect(myInviteResponseSchema.parse(rotated.body.data).code).not.toBe(code);
      expect(revoked.body.error.code).toBe(ErrorCode.INVITE_2102);
      expect(unknown.body.error.code).toBe(ErrorCode.INVITE_2101);
      expect(malformed.body.error.code).toBe(ErrorCode.SYS_0002);
    });

    it("초대한 친구가 없으면 빈 목록과 0명을 반환하고 로그인 없이 본 사용 가능 여부는 true다", async () => {
      // Given
      const inviter = await ctx.helpers.createVerifiedUser("invite-list@test.com", PASSWORD);

      // When
      const invitees = await request(ctx.app.getHttpServer())
        .get("/v1/invites/me/invitees?limit=10")
        .set("Authorization", `Bearer ${inviter.accessToken}`)
        .expect(200);
      const availability = await request(ctx.app.getHttpServer())
        .get("/v1/invites/availability")
        .expect(200);

      // Then
      expect(invitedFriendsListResponseSchema.parse(invitees.body.data)).toEqual({
        items: [],
        totalCount: 0,
        hasMore: false,
      });
      expect(inviteAvailabilityResponseSchema.parse(availability.body.data)).toEqual({
        enabled: true,
      });
    });

    it("상태로 거르면 그 상태만 수락 시각 내림차순으로 겹치지 않게 넘기고 totalCount도 그 상태의 수다", async () => {
      // Given
      const inviter = await ctx.helpers.createVerifiedUser("invite-filter@test.com", PASSWORD);
      const invitees = await Promise.all(
        ["a", "b", "c", "d"].map((suffix) =>
          ctx.helpers.createVerifiedUser(`invite-filter-${suffix}@test.com`, PASSWORD),
        ),
      );
      // 같은 수락 시각 두 명으로 tie-break까지 확인한다
      const sameJoinedAt = new Date("2026-10-20T00:00:00.000Z");
      const rows = [
        { invitee: invitees[0], status: "JOINED", joinedAt: sameJoinedAt },
        { invitee: invitees[1], status: "JOINED", joinedAt: sameJoinedAt },
        {
          invitee: invitees[2],
          status: "QUALIFIED",
          joinedAt: new Date("2026-10-21T00:00:00.000Z"),
        },
        {
          invitee: invitees[3],
          status: "REJECTED",
          joinedAt: new Date("2026-10-19T00:00:00.000Z"),
        },
      ] as const;
      await ctx.testDatabase.getClient().orm.public.InviteRedemption.createAndCount(
        rows.map((row) =>
          encodeCreate("InviteRedemption", {
            inviterId: inviter.userId,
            inviteeId: row.invitee?.userId ?? "",
            status: row.status,
            timezone: "Asia/Seoul",
            joinedAt: row.joinedAt,
            qualifiedAt: row.status === "QUALIFIED" ? row.joinedAt : null,
            rejectionReason: row.status === "REJECTED" ? "EXPIRED" : null,
            expiresAt: new Date("2026-11-03T00:00:00.000Z"),
          }),
        ),
      );
      const list = (query: string) =>
        request(ctx.app.getHttpServer())
          .get(`/v1/invites/me/invitees?${query}`)
          .set("Authorization", `Bearer ${inviter.accessToken}`);

      // When
      const first = invitedFriendsListResponseSchema.parse(
        (await list("status=JOINED&limit=1").expect(200)).body.data,
      );
      const second = invitedFriendsListResponseSchema.parse(
        (await list(`status=JOINED&limit=1&cursor=${first.items[0]?.userId}`).expect(200)).body
          .data,
      );
      const all = invitedFriendsListResponseSchema.parse(
        (await list("limit=20").expect(200)).body.data,
      );
      const tooLarge = await list("limit=51").expect(400);

      // Then
      expect(first).toMatchObject({ totalCount: 2, hasMore: true });
      expect(second).toMatchObject({ totalCount: 2, hasMore: false });
      expect(new Set([...first.items, ...second.items].map((item) => item.userId))).toEqual(
        new Set([invitees[0]?.userId, invitees[1]?.userId]),
      );
      expect(all.totalCount).toBe(4);
      expect(all.items.map((item) => [item.status, item.rejectionReason])).toEqual([
        ["QUALIFIED", null],
        ["JOINED", null],
        ["JOINED", null],
        ["REJECTED", "EXPIRED"],
      ]);
      expect(tooLarge.body.error.code).toBe(ErrorCode.SYS_0002);
    });
  });

  describe("기능이 꺼져 있으면", () => {
    let ctx: E2eTestContext;

    beforeAll(async () => {
      ctx = await createE2eApp({
        customizeBuilder: (builder) =>
          builder.overrideProvider(INVITE_CONFIG).useValue({ isEnabled: false }),
      });
    }, 60_000);

    afterAll(async () => {
      await destroyE2eApp(ctx);
    });

    beforeEach(async () => {
      await ctx.reset();
    });

    it("초대 API는 INVITE_2105를 반환하고 사용 가능 여부는 false다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("invite-off@test.com", PASSWORD);
      const auth = `Bearer ${user.accessToken}`;

      // When
      const responses = await Promise.all([
        request(ctx.app.getHttpServer()).get("/v1/invites/me").set("Authorization", auth),
        request(ctx.app.getHttpServer()).post("/v1/invites/me/rotate").set("Authorization", auth),
        request(ctx.app.getHttpServer()).get("/v1/invites/me/invitees").set("Authorization", auth),
        request(ctx.app.getHttpServer()).get("/v1/invites/K7M2QX"),
        request(ctx.app.getHttpServer())
          .post("/v1/invites/K7M2QX/redeem")
          .set("Authorization", auth)
          .send({}),
      ]);
      const availability = await request(ctx.app.getHttpServer())
        .get("/v1/invites/availability")
        .expect(200);

      // Then
      for (const response of responses) {
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe(ErrorCode.INVITE_2105);
      }
      expect(availability.body.data).toEqual({ enabled: false });
    });
  });
});
