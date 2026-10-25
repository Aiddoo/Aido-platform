/**
 * 사용자 차단·신고 E2E 테스트
 *
 * 차단·해제·목록과 신고 접수의 HTTP 계약(상태 코드·오류 코드·envelope)과
 * 차단이 친구 요청을 막는 흐름을 실제 앱과 PostgreSQL로 확인한다.
 */

import request from "supertest";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  type VerifiedUser,
} from "./helpers/index.js";

describe("사용자 차단·신고 E2E", () => {
  let ctx: E2eTestContext;
  let me: VerifiedUser;
  let other: VerifiedUser;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    me = await ctx.helpers.createVerifiedUser("block-me@example.com", "Test1234!");
    other = await ctx.helpers.createVerifiedUser("block-other@example.com", "Test1234!");
  });

  function server() {
    return ctx.app.getHttpServer();
  }

  describe("차단", () => {
    it("친구를 차단하면 친구 목록에서 사라지고 차단 목록에 보인다", async () => {
      // Given
      await ctx.helpers.createFriendship(me, other);

      // When
      const blocked = await request(server())
        .post(`/v1/blocks/${other.userId}`)
        .set("Authorization", `Bearer ${me.accessToken}`)
        .expect(200);

      // Then
      expect(blocked.body.data).toMatchObject({
        blockedUserId: other.userId,
        blockedAt: expect.any(String),
      });
      const friends = await request(server())
        .get("/v1/follows/friends")
        .set("Authorization", `Bearer ${other.accessToken}`)
        .expect(200);
      expect(friends.body.data.friends).toEqual([]);
      const list = await request(server())
        .get("/v1/blocks")
        .set("Authorization", `Bearer ${me.accessToken}`)
        .expect(200);
      expect(list.body.data).toEqual({
        items: [
          expect.objectContaining({
            id: other.userId,
            userTag: other.userTag,
            blockedAt: blocked.body.data.blockedAt,
          }),
        ],
        totalCount: 1,
        hasMore: false,
        nextCursor: null,
      });
    });

    it("차단한 쪽의 친구 요청은 BLOCK_2203, 차단당한 쪽은 FOLLOW_0905로 거부한다", async () => {
      // Given
      await request(server())
        .post(`/v1/blocks/${other.userId}`)
        .set("Authorization", `Bearer ${me.accessToken}`)
        .expect(200);

      // When
      const fromBlocker = await request(server())
        .post(`/v1/follows/${other.userTag}`)
        .set("Authorization", `Bearer ${me.accessToken}`);
      const fromBlocked = await request(server())
        .post(`/v1/follows/${me.userTag}`)
        .set("Authorization", `Bearer ${other.accessToken}`);

      // Then
      expect(fromBlocker.status).toBe(403);
      expect(fromBlocker.body.error.code).toBe("BLOCK_2203");
      expect(fromBlocked.status).toBe(404);
      expect(fromBlocked.body.error.code).toBe("FOLLOW_0905");
    });

    it("차단을 해제하면 다시 친구 요청을 보낼 수 있다", async () => {
      // Given
      await request(server())
        .post(`/v1/blocks/${other.userId}`)
        .set("Authorization", `Bearer ${me.accessToken}`)
        .expect(200);

      // When
      await request(server())
        .delete(`/v1/blocks/${other.userId}`)
        .set("Authorization", `Bearer ${me.accessToken}`)
        .expect(200);

      // Then
      await request(server())
        .post(`/v1/follows/${other.userTag}`)
        .set("Authorization", `Bearer ${me.accessToken}`)
        .expect(201);
    });

    it("자기 자신은 차단할 수 없다", async () => {
      // When
      const response = await request(server())
        .post(`/v1/blocks/${me.userId}`)
        .set("Authorization", `Bearer ${me.accessToken}`);

      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("BLOCK_2201");
    });

    it("인증 없이 차단 목록을 볼 수 없다", async () => {
      await request(server()).get("/v1/blocks").expect(401);
    });
  });

  describe("신고", () => {
    const profileReport = { targetType: "PROFILE", reason: "IMPERSONATION" } as const;

    it("프로필을 신고하면 접수하고 운영자에게 한 번 알린다", async () => {
      // When
      const first = await request(server())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${me.accessToken}`)
        .send({ ...profileReport, targetUserId: other.userId, detail: "다른 사람을 사칭해요" })
        .expect(201);
      const repeated = await request(server())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${me.accessToken}`)
        .send({ ...profileReport, targetUserId: other.userId })
        .expect(201);

      // Then
      expect(first.body.data.report).toMatchObject({ status: "OPEN" });
      expect(repeated.body.data.report.id).toBe(first.body.data.report.id);
      expect(ctx.fakeEmailService.getSentUserReports()).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            reportId: first.body.data.report.id,
            targetUserTag: other.userTag,
            reasonLabel: "사칭",
            detail: "다른 사람을 사칭해요",
          }),
        }),
      ]);
    });

    it("콘텐츠 신고에 콘텐츠 ID가 없으면 400으로 거부한다", async () => {
      // When
      const response = await request(server())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${me.accessToken}`)
        .send({ targetUserId: other.userId, targetType: "COMMENT", reason: "SPAM" });

      // Then
      expect(response.status).toBe(400);
      expect(ctx.fakeEmailService.getSentUserReports()).toEqual([]);
    });

    it("댓글 ID 형식이 아니면 REPORT_2253으로 거부한다", async () => {
      // When
      const response = await request(server())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${me.accessToken}`)
        .send({
          targetUserId: other.userId,
          targetType: "COMMENT",
          targetId: "42",
          reason: "SPAM",
        });

      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("REPORT_2253");
    });

    it("자기 자신은 신고할 수 없다", async () => {
      // When
      const response = await request(server())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${me.accessToken}`)
        .send({ ...profileReport, targetUserId: me.userId });

      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("REPORT_2251");
    });
  });
});
