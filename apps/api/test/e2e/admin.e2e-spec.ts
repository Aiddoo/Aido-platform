import { eq } from "drizzle-orm";
import request from "supertest";

import { PUSH_DELIVERY_QUEUE } from "#api/modules/notification/push/infrastructure/jobs/push-delivery.queue";
import { BROADCAST_DELIVERY_QUEUE } from "#api/modules/operations/broadcasts/infrastructure/jobs/broadcast-delivery.queue";
import { BROADCAST_FAN_OUT_QUEUE } from "#api/modules/operations/broadcasts/infrastructure/jobs/broadcast-fan-out.queue";
import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { user as userTable, userPreference } from "#api/platform/database/schema/index";
import { JobQueuePort, type QueueDefinition } from "#api/shared/application/ports/job-queue.port";
import type { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("관리자 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  async function createAdminUser(email: string, password: string) {
    const user = await ctx.helpers.createVerifiedUser(email, password);
    const database = ctx.module.get<Database>(DRIZZLE);
    await database.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, user.userId));
    const loginResult = await ctx.helpers.loginUser(email, password);
    return { ...user, accessToken: loginResult.accessToken };
  }

  describe("관리자 알림 발송", () => {
    describe("POST /admin/notifications/broadcast — 브로드캐스트 알림", () => {
      it("관리자가 브로드캐스트 알림을 발송한다", async () => {
        // Given
        const adminUser = await createAdminUser("admin-e2e@example.com", "Test1234!");

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/broadcast")
          .set("Authorization", `Bearer ${adminUser.accessToken}`)
          .send({
            title: "E2E 테스트 알림",
            body: "전체 사용자 알림입니다",
            targetFilter: "ALL",
            force: true,
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.totalTargets).toBeGreaterThanOrEqual(1);
        expect(response.body.data.successCount).toBeGreaterThanOrEqual(1);
      });

      it("비관리자가 호출하면 403을 반환한다", async () => {
        // Given
        const regularUser = await ctx.helpers.createVerifiedUser(
          "regular-e2e@example.com",
          "Test1234!",
        );

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/broadcast")
          .set("Authorization", `Bearer ${regularUser.accessToken}`)
          .send({
            title: "권한 없는 알림",
            body: "이 요청은 실패해야 합니다",
            targetFilter: "ALL",
          })
          .expect(403);

        // Then
        expect(response.body.success).toBe(false);
      });

      it("인증 없이 호출하면 401을 반환한다", async () => {
        // Given

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/broadcast")
          .send({
            title: "인증 없는 알림",
            body: "이 요청은 실패해야 합니다",
            targetFilter: "ALL",
          })
          .expect(401);

        // Then
      });
    });

    describe("POST /admin/notifications/targeted — 타겟 알림", () => {
      it("관리자가 타겟 알림을 발송한다", async () => {
        // Given
        const adminUser = await createAdminUser("admin-target@example.com", "Test1234!");
        const regularUser = await ctx.helpers.createVerifiedUser(
          "target-user@example.com",
          "Test1234!",
        );

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/targeted")
          .set("Authorization", `Bearer ${adminUser.accessToken}`)
          .send({
            title: "타겟 알림 테스트",
            body: "지정 사용자 알림입니다",
            userIds: [regularUser.userId],
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.totalTargets).toBe(1);
        expect(response.body.data.successCount).toBe(1);
      });
    });
  });
  describe("POST·GET /v2/admin/notifications/broadcasts — 브로드캐스트 캠페인", () => {
    const requestId = "0f8b8a52-5b0e-4f39-9f8b-6f3b3c1f2a10";
    const campaignBody = {
      requestId,
      title: "새 기능 안내",
      body: "지금 확인해 보세요.",
      targetFilter: "WITH_PUSH_TOKEN",
      force: true,
    };

    function jobQueue(): InMemoryJobQueue {
      return ctx.module.get<typeof JobQueuePort, InMemoryJobQueue>(JobQueuePort);
    }

    // 분배·현지 시각 발송·푸시 발송 작업을 모두 새 큐 포트(메모리)에서 돌린다
    async function runQueued(queue: QueueDefinition<object>): Promise<number> {
      const count = jobQueue().jobsIn(queue).length;
      await jobQueue().drain(queue);
      return count;
    }

    async function registerRecipient(email: string, deviceId: string, acceptLanguage = "ko-KR") {
      const recipient = await ctx.helpers.createVerifiedUser(email, "Test1234!");
      await request(ctx.app.getHttpServer())
        .post("/v1/notifications/token")
        .set("Authorization", `Bearer ${recipient.accessToken}`)
        .set("Accept-Language", acceptLanguage)
        .send({ token: `ExponentPushToken[${deviceId}-e2e-token]`, deviceId })
        .expect(201);
      return recipient;
    }

    it("접수 즉시 202와 캠페인 ID를 돌려주고 분배·발송 결과를 조회로 보여 준다", async () => {
      // Given
      const admin = await createAdminUser("admin-campaign@example.com", "Test1234!");
      await registerRecipient("campaign-recipient-1@example.com", "ios_device-one");
      await registerRecipient("campaign-recipient-2@example.com", "android_device-two");
      jobQueue().clear();

      // When
      const accepted = await request(ctx.app.getHttpServer())
        .post("/v2/admin/notifications/broadcasts")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send(campaignBody)
        .expect(202);
      const queuedBeforeFanOut = await request(ctx.app.getHttpServer())
        .get(`/v2/admin/notifications/broadcasts/${accepted.body.data.campaignId}`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(200);
      expect(await runQueued(BROADCAST_FAN_OUT_QUEUE)).toBe(1);
      await runQueued(PUSH_DELIVERY_QUEUE);
      const delivered = await request(ctx.app.getHttpServer())
        .get(`/v2/admin/notifications/broadcasts/${accepted.body.data.campaignId}`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(200);

      // Then
      expect(accepted.body.data).toMatchObject({ requestId, status: "QUEUED" });
      expect(queuedBeforeFanOut.body.data).toMatchObject({
        status: "QUEUED",
        recipients: { processed: 0, queued: 0 },
      });
      expect(delivered.body.data).toMatchObject({
        status: "COMPLETED",
        recipients: { processed: 2, queued: 2 },
        dispatches: { sent: 2, pending: 0, failed: 0 },
        deliveries: { accepted: 2, delivered: 0 },
      });
    });

    it("같은 요청 ID로 다시 보내면 같은 캠페인을 돌려주고 분배 작업을 하나만 남긴다", async () => {
      // Given
      const admin = await createAdminUser("admin-replay@example.com", "Test1234!");
      await registerRecipient("replay-recipient@example.com", "ios_device-replay");
      jobQueue().clear();
      const send = () =>
        request(ctx.app.getHttpServer())
          .post("/v2/admin/notifications/broadcasts")
          .set("Authorization", `Bearer ${admin.accessToken}`)
          .send(campaignBody)
          .expect(202);

      // When
      const first = await send();
      const replay = await send();

      // Then
      expect(replay.body.data.campaignId).toBe(first.body.data.campaignId);
      expect(jobQueue().jobsIn(BROADCAST_FAN_OUT_QUEUE)).toHaveLength(1);
    });

    it("언어별 문구를 주면 수신자 언어로 알림을 만들고 없는 언어는 기본 문구로 보낸다", async () => {
      // Given
      const admin = await createAdminUser("admin-localized@example.com", "Test1234!");
      const korean = await registerRecipient("localized-ko@example.com", "ios_device-ko");
      const english = await registerRecipient("localized-en@example.com", "ios_device-en", "en-US");
      jobQueue().clear();

      // When
      await request(ctx.app.getHttpServer())
        .post("/v2/admin/notifications/broadcasts")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({
          ...campaignBody,
          localizedContent: { en: { title: "New feature", body: "Check it out." } },
        })
        .expect(202);
      await runQueued(BROADCAST_FAN_OUT_QUEUE);

      // Then
      const client = ctx.testDatabase.getClient();
      const notifications = await client.query.notification.findMany({
        where: { type: "ADMIN_BROADCAST" },
      });
      const titleOf = (userId: string) =>
        notifications.find((notification) => notification.userId === userId)?.title;
      expect(titleOf(english.userId)).toBe("New feature");
      expect(titleOf(korean.userId)).toBe("새 기능 안내");
    });

    it("수신자 현지 시각 발송은 분배 때 알림을 만들지 않고 그 시각의 작업을 남긴다", async () => {
      // Given
      const admin = await createAdminUser("admin-local-time@example.com", "Test1234!");
      const seoul = await registerRecipient("local-seoul@example.com", "ios_device-seoul");
      const losAngeles = await registerRecipient("local-la@example.com", "ios_device-la");
      const client = ctx.testDatabase.getClient();
      await client
        .update(userPreference)
        .set({ timezone: "Asia/Seoul" })
        .where(eq(userPreference.userId, seoul.userId));
      await client
        .update(userPreference)
        .set({ timezone: "America/Los_Angeles" })
        .where(eq(userPreference.userId, losAngeles.userId));
      jobQueue().clear();

      // When
      const accepted = await request(ctx.app.getHttpServer())
        .post("/v2/admin/notifications/broadcasts")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({
          ...campaignBody,
          delivery: { mode: "RECIPIENT_LOCAL_TIME", localTime: "10:00", date: "2099-01-01" },
        })
        .expect(202);
      await runQueued(BROADCAST_FAN_OUT_QUEUE);

      // Then - 분배가 끝나도 알림은 아직 없고 시간대별 발송 작업이 남는다
      expect(
        await client.query.notification.findMany({ where: { type: "ADMIN_BROADCAST" } }),
      ).toEqual([]);
      const scheduled = jobQueue().jobsIn(BROADCAST_DELIVERY_QUEUE);
      expect(scheduled.map((job) => job.options.startAfter?.toString()).toSorted()).toEqual([
        "2099-01-01T01:00:00Z",
        "2099-01-01T18:00:00Z",
      ]);
      expect(scheduled.every((job) => job.options.priority === 0)).toBe(true);

      // When - 그 시각이 되어 작업이 돌면
      expect(await runQueued(BROADCAST_DELIVERY_QUEUE)).toBe(2);

      // Then
      const notifications = await client.query.notification.findMany({
        where: { type: "ADMIN_BROADCAST" },
      });
      expect(notifications.map(({ userId }) => userId).toSorted()).toEqual(
        [seoul.userId, losAngeles.userId].toSorted(),
      );
      const detail = await request(ctx.app.getHttpServer())
        .get(`/v2/admin/notifications/broadcasts/${accepted.body.data.campaignId}`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(200);
      expect(detail.body.data).toMatchObject({
        status: "COMPLETED",
        recipients: { processed: 2, queued: 2 },
      });
    });

    it("같은 요청 ID로 다른 내용을 보내면 409를 반환한다", async () => {
      // Given
      const admin = await createAdminUser("admin-conflict@example.com", "Test1234!");
      await registerRecipient("conflict-recipient@example.com", "ios_device-conflict");
      await request(ctx.app.getHttpServer())
        .post("/v2/admin/notifications/broadcasts")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send(campaignBody)
        .expect(202);

      // When
      const response = await request(ctx.app.getHttpServer())
        .post("/v2/admin/notifications/broadcasts")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ ...campaignBody, body: "바뀐 본문" })
        .expect(409);

      // Then
      expect(response.body.error.code).toBe("ADMIN_1405");
    });

    it("대상이 없으면 404, 없는 캠페인 조회도 404, 비관리자는 403을 반환한다", async () => {
      // Given
      const admin = await createAdminUser("admin-empty@example.com", "Test1234!");
      const regular = await ctx.helpers.createVerifiedUser("not-admin@example.com", "Test1234!");

      // When
      const empty = await request(ctx.app.getHttpServer())
        .post("/v2/admin/notifications/broadcasts")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ ...campaignBody, targetFilter: "SUBSCRIBERS" })
        .expect(404);
      const missing = await request(ctx.app.getHttpServer())
        .get("/v2/admin/notifications/broadcasts/c0000000000000000000000ff")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(404);
      await request(ctx.app.getHttpServer())
        .post("/v2/admin/notifications/broadcasts")
        .set("Authorization", `Bearer ${regular.accessToken}`)
        .send(campaignBody)
        .expect(403);

      // Then
      expect(empty.body.error.code).toBe("ADMIN_1402");
      expect(missing.body.error.code).toBe("ADMIN_1404");
    });
  });

  describe("GET /v1/admin/growth/summary — 성장 지표", () => {
    it("활성 사용자 수와 함께 stickiness(DAU/MAU %)를 돌려준다", async () => {
      // Given
      const admin = await createAdminUser("admin-growth@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/admin/growth/summary")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .expect(200);

      // Then
      expect(response.body.data).toEqual(
        expect.objectContaining({
          dau: expect.any(Number),
          mau: expect.any(Number),
          stickiness: expect.any(Number),
        }),
      );
    });
  });
});
