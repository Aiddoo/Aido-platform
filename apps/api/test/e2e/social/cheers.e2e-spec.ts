/**
 * Cheer E2E 테스트
 *
 * @description
 * 응원(Cheer) 기능 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 응원 보내기
 * 2. 받은/보낸 응원 목록 조회
 * 3. 일일 제한 및 쿨다운 확인
 * 4. 읽음 처리
 */

import { PLAN_CATALOG, quotaErrorDetailsSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { toIsoString } from "#api/shared/domain/time/instant";
import { nowInstant, dayWindowIn } from "#test/fixtures/clock.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "../helpers/index.js";

describe("응원 E2E", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    testContext = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  const password = "Test1234!";

  describe("응원 전송", () => {
    describe("POST /cheers - 응원 보내기", () => {
      it("친구에게 응원을 보내고, 쿨다운 기간 내 동일 대상에게 다시 응원 시 429 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-sender@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-receiver@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({
            receiverId: receiver.userId,
            message: "화이팅!",
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.cheer.id).toBeDefined();
        expect(response.body.data.cheer.senderId).toBe(sender.userId);
        expect(response.body.data.cheer.receiverId).toBe(receiver.userId);
        expect(response.body.data.cheer.message).toBe("화이팅!");

        // When
        const cooldownResponse = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId })
          .expect(429);

        // Then
        expect(cooldownResponse.body.success).toBe(false);
        expect(cooldownResponse.body.error.code).toBe("CHEER_1202");
      });

      it("하루 한도를 다 쓰면 429 CHEER_1201과 차감 없음·X-Timezone 자정 기준 featureQuota를 준다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-limit-sender@test.com",
          password,
        );
        const receivers = [];
        for (let index = 0; index <= PLAN_CATALOG.CHEER.free; index += 1) {
          const receiver = await testContext.helpers.createVerifiedUser(
            `cheer-limit-receiver-${index}@test.com`,
            password,
          );
          await testContext.helpers.createFriendship(sender, receiver);
          receivers.push(receiver);
        }
        for (const receiver of receivers.slice(0, PLAN_CATALOG.CHEER.free)) {
          await request(testContext.app.getHttpServer())
            .post("/v1/cheers")
            .set("Authorization", `Bearer ${sender.accessToken}`)
            .set("X-Timezone", "Asia/Seoul")
            .send({ receiverId: receiver.userId })
            .expect(201);
        }

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ receiverId: receivers[PLAN_CATALOG.CHEER.free]?.userId })
          .expect(429);

        // Then
        expect(response.body.error.code).toBe(ErrorCode.CHEER_1201);
        expect(quotaErrorDetailsSchema.parse(response.body.error.details)).toEqual({
          charged: false,
          featureQuota: {
            feature: "CHEER",
            allowed: true,
            limit: PLAN_CATALOG.CHEER.free,
            used: PLAN_CATALOG.CHEER.free,
            remaining: 0,
            period: "day",
            resetsAt: toIsoString(dayWindowIn(nowInstant(), "Asia/Seoul").endsAt),
            isFairUse: false,
            perUse: null,
          },
        });
      });

      it("메시지 없이도 응원을 보낼 수 있다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-sender2@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-receiver2@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.cheer.id).toBeDefined();
      });

      it("친구가 아닌 사용자에게 응원 시 403 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-sender3@test.com",
          password,
        );
        const stranger = await testContext.helpers.createVerifiedUser(
          "cheer-stranger@test.com",
          password,
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: stranger.userId })
          .expect(403);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("CHEER_1203");
      });

      it("자기 자신에게 응원 시 400 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-self@test.com",
          password,
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: sender.userId })
          .expect(400);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("CHEER_1204");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .send({ receiverId: "some-user-id" });

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("응원 목록 조회", () => {
    describe("GET /cheers/received - 받은 응원 목록", () => {
      it("받은 응원 목록을 조회한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-list-sender@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-list-receiver@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, message: "테스트 응원" });

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/cheers/received")
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.cheers).toBeInstanceOf(Array);
        expect(response.body.data.cheers.length).toBeGreaterThanOrEqual(1);
        expect(response.body.data.hasMore).toBeDefined();
      });

      it("limit 파라미터로 조회 개수를 제한한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-limit-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-limit-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId });

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/cheers/received")
          .query({ limit: 1 })
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.cheers).toBeInstanceOf(Array);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get("/v1/cheers/received");

        // Then
        expect(response.status).toBe(401);
      });
    });

    describe("GET /cheers/sent - 보낸 응원 목록", () => {
      it("보낸 응원 목록을 조회한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-sent-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-sent-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId });

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/cheers/sent")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.cheers).toBeInstanceOf(Array);
        expect(response.body.data.cheers.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("일일 제한 및 쿨다운", () => {
    describe("GET /cheers/limit - 일일 제한 정보 조회", () => {
      it("일일 제한 정보를 조회한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "cheer-limit-user@test.com",
          password,
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/cheers/limit")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.usedToday).toBeDefined();
        expect(response.body.data.remainingToday).toBeDefined();
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get("/v1/cheers/limit");

        // Then
        expect(response.status).toBe(401);
      });
    });

    describe("GET /cheers/cooldown/:userId - 쿨다운 상태 조회", () => {
      it("쿨다운 상태를 조회한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "cheer-cd-user@test.com",
          password,
        );
        const friend = await testContext.helpers.createVerifiedUser(
          "cheer-cd-friend@test.com",
          password,
        );
        await testContext.helpers.createFriendship(user, friend);

        // When
        const response = await request(testContext.app.getHttpServer())
          .get(`/v1/cheers/cooldown/${friend.userId}`)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.canCheer).toBe("boolean");
      });

      it("CUID가 아닌 userId는 400 SYS_0002를 반환한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "cheer-cd-invalid@test.com",
          password,
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/cheers/cooldown/not-a-cuid")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(400);

        // Then
        expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get(
          "/v1/cheers/cooldown/some-user-id",
        );

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("읽음 처리", () => {
    describe("PATCH /cheers/:id/read - 단일 응원 읽음 처리", () => {
      it("받은 응원을 읽음 처리한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "cheer-read-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-read-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        const cheerResponse = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, message: "읽음 처리 테스트" });
        const cheerId = cheerResponse.body.data.cheer.id;

        // When
        const response = await request(testContext.app.getHttpServer())
          .patch(`/v1/cheers/${cheerId}/read`)
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.readCount).toBe(1);
      });

      it("존재하지 않는 응원 읽음 처리 시 404 에러 반환", async () => {
        // Given
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-read-404@test.com",
          password,
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .patch("/v1/cheers/99999/read")
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(404);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("CHEER_1205");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).patch("/v1/cheers/1/read");

        // Then
        expect(response.status).toBe(401);
      });
    });

    describe("PATCH /cheers/read - 여러 응원 읽음 처리", () => {
      it("여러 응원을 한번에 읽음 처리한다", async () => {
        // Given
        const sender1 = await testContext.helpers.createVerifiedUser(
          "cheer-bulk-s1@test.com",
          password,
        );
        const sender2 = await testContext.helpers.createVerifiedUser(
          "cheer-bulk-s2@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "cheer-bulk-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender1, receiver);
        await testContext.helpers.createFriendship(sender2, receiver);

        const resp1 = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender1.accessToken}`)
          .send({ receiverId: receiver.userId });
        const resp2 = await request(testContext.app.getHttpServer())
          .post("/v1/cheers")
          .set("Authorization", `Bearer ${sender2.accessToken}`)
          .send({ receiverId: receiver.userId });

        const cheerIds = [resp1.body.data.cheer.id, resp2.body.data.cheer.id];

        // When
        const response = await request(testContext.app.getHttpServer())
          .patch("/v1/cheers/read")
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .send({ cheerIds })
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.readCount).toBe("number");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer())
          .patch("/v1/cheers/read")
          .send({ cheerIds: [1] });

        // Then
        expect(response.status).toBe(401);
      });
    });
  });
});
