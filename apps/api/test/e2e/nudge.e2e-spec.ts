/**
 * Nudge E2E 테스트
 *
 * @description
 * 콕 찌르기(Nudge) 기능 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 콕 찌르기 보내기
 * 2. 받은/보낸 콕 찌름 목록 조회
 * 3. 일일 제한 및 쿨다운 확인
 * 4. 읽음 처리
 */

import { PLAN_CATALOG, quotaErrorDetailsSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { toIsoString } from "#api/shared/domain/time/instant";
import { nowInstant, dayWindowIn } from "#test/fixtures/clock.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("찔러보기 E2E", () => {
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
  function activeDateRange(): { startDate: string; endDate: string } {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      startDate: start.toISOString().split("T")[0] ?? "",
      endDate: end.toISOString().split("T")[0] ?? "",
    };
  }

  /** receiver의 오늘 Todo 생성 헬퍼 */
  async function createReceiverTodo(receiverToken: string): Promise<number> {
    const categoryId = await testContext.helpers.getDefaultCategoryId(receiverToken);
    const todoResponse = await request(testContext.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${receiverToken}`)
      .send({ title: "테스트 할일", ...activeDateRange(), categoryId });
    return todoResponse.body.data?.todo?.id;
  }

  describe("콕 찌르기 전송", () => {
    describe("POST /nudges - 콕 찌르기", () => {
      it("친구에게 콕 찌르기를 보내고, 쿨다운 기간 내 동일 Todo에 다시 콕 찌르기 시 429 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-sender@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-receiver@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);
        const receiverTodoId = await createReceiverTodo(receiver.accessToken);

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId: receiverTodoId })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.nudge.id).toBeDefined();
        expect(response.body.data.nudge.senderId).toBe(sender.userId);
        expect(response.body.data.nudge.receiverId).toBe(receiver.userId);

        // When
        const cooldownResponse = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId: receiverTodoId })
          .expect(429);

        // Then
        expect(cooldownResponse.body.success).toBe(false);
        expect(cooldownResponse.body.error.code).toBe("NUDGE_1102");
      });

      it("하루 한도를 다 쓰면 429 NUDGE_1101과 차감 없음·X-Timezone 자정 기준 featureQuota를 준다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-limit-sender@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-limit-receiver@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);
        for (let index = 0; index < PLAN_CATALOG.NUDGE.free; index += 1) {
          const todoId = await createReceiverTodo(receiver.accessToken);
          await request(testContext.app.getHttpServer())
            .post("/v1/nudges")
            .set("Authorization", `Bearer ${sender.accessToken}`)
            .set("X-Timezone", "Asia/Seoul")
            .send({ receiverId: receiver.userId, todoId })
            .expect(201);
        }

        const lastTodoId = await createReceiverTodo(receiver.accessToken);

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ receiverId: receiver.userId, todoId: lastTodoId })
          .expect(429);

        // Then
        expect(response.body.error.code).toBe(ErrorCode.NUDGE_1101);
        expect(quotaErrorDetailsSchema.parse(response.body.error.details)).toEqual({
          charged: false,
          featureQuota: {
            feature: "NUDGE",
            allowed: true,
            limit: PLAN_CATALOG.NUDGE.free,
            used: PLAN_CATALOG.NUDGE.free,
            remaining: 0,
            period: "day",
            resetsAt: toIsoString(dayWindowIn(nowInstant(), "Asia/Seoul").endsAt),
            isFairUse: false,
            perUse: null,
          },
        });
      });

      it("친구가 아닌 사용자에게 콕 찌르기 시 403 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-sender2@test.com",
          password,
        );
        const stranger = await testContext.helpers.createVerifiedUser(
          "nudge-stranger@test.com",
          password,
        );

        const strangerTodoId = await createReceiverTodo(stranger.accessToken);

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: stranger.userId, todoId: strangerTodoId })
          .expect(403);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NUDGE_1103");
      });

      it("자기 자신에게 콕 찌르기 시 400 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-self@test.com",
          password,
        );
        const categoryId = await testContext.helpers.getDefaultCategoryId(sender.accessToken);
        const todoResponse = await request(testContext.app.getHttpServer())
          .post("/v1/todos")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ title: "Self Todo", ...activeDateRange(), categoryId });
        const selfTodoId = todoResponse.body.data?.todo?.id;

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: sender.userId, todoId: selfTodoId })
          .expect(400);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NUDGE_1104");
      });

      it("비공개 Todo에 콕 찌르기 시 404 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-private-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-private-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        const categoryId = await testContext.helpers.getDefaultCategoryId(receiver.accessToken);
        const todoResponse = await request(testContext.app.getHttpServer())
          .post("/v1/todos")
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .send({
            title: "Private Todo",
            ...activeDateRange(),
            categoryId,
            visibility: "PRIVATE",
          });
        const privateTodoId = todoResponse.body.data?.todo?.id;

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId: privateTodoId })
          .expect(404);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("TODO_0801");
      });

      it("오늘이 아닌 Todo에 콕 찌르기 시 400 에러 반환", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-yesterday-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-yesterday-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);

        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayDate = yesterday.toISOString().split("T")[0];
        const categoryId = await testContext.helpers.getDefaultCategoryId(receiver.accessToken);
        const todoResponse = await request(testContext.app.getHttpServer())
          .post("/v1/todos")
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .send({
            title: "Yesterday Todo",
            startDate: yesterdayDate,
            categoryId,
          });
        const yesterdayTodoId = todoResponse.body.data?.todo?.id;

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId: yesterdayTodoId })
          .expect(400);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NUDGE_1106");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .send({ receiverId: "some-user-id", todoId: 1 });

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("콕 찌름 목록 조회", () => {
    describe("GET /nudges/received - 받은 콕 찌름 목록", () => {
      it("받은 콕 찌름 목록을 조회한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-list-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-list-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);
        const todoId = await createReceiverTodo(receiver.accessToken);

        await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId });

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/nudges/received")
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.nudges).toBeInstanceOf(Array);
        expect(response.body.data.nudges.length).toBeGreaterThanOrEqual(1);
        expect(response.body.data.hasMore).toBeDefined();
      });

      it("limit 파라미터로 조회 개수를 제한한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-limit-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-limit-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);
        const todoId = await createReceiverTodo(receiver.accessToken);

        await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId });

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/nudges/received")
          .query({ limit: 1 })
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.nudges).toBeInstanceOf(Array);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get("/v1/nudges/received");

        // Then
        expect(response.status).toBe(401);
      });
    });

    describe("GET /nudges/sent - 보낸 콕 찌름 목록", () => {
      it("보낸 콕 찌름 목록을 조회한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-sent-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-sent-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);
        const todoId = await createReceiverTodo(receiver.accessToken);

        await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId });

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/nudges/sent")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.nudges).toBeInstanceOf(Array);
        expect(response.body.data.nudges.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("일일 제한 및 쿨다운", () => {
    describe("GET /nudges/limit - 일일 제한 정보 조회", () => {
      it("일일 제한 정보를 조회한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "nudge-lim-user@test.com",
          password,
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .get("/v1/nudges/limit")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.usedToday).toBeDefined();
        expect(response.body.data.remainingToday).toBeDefined();
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get("/v1/nudges/limit");

        // Then
        expect(response.status).toBe(401);
      });
    });

    describe("GET /nudges/cooldown/:userId - 쿨다운 상태 조회", () => {
      it("쿨다운 상태를 조회한다", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "nudge-cd-user@test.com",
          password,
        );
        const friend = await testContext.helpers.createVerifiedUser(
          "nudge-cd-friend@test.com",
          password,
        );
        await testContext.helpers.createFriendship(user, friend);

        // When
        const response = await request(testContext.app.getHttpServer())
          .get(`/v1/nudges/cooldown/${friend.userId}`)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.canNudge).toBe("boolean");
        expect(
          response.body.data.remainingSeconds === null ||
            typeof response.body.data.remainingSeconds === "number",
        ).toBe(true);
      });

      it.each(["/v1/nudges/cooldown/not-a-cuid", "/v1/nudges/remind/cooldown/not-a-cuid"])(
        "CUID가 아닌 userId(%s)는 400 SYS_0002를 반환한다",
        async (path) => {
          // Given
          const user = await testContext.helpers.createVerifiedUser(
            `nudge-cd-invalid-${path.length}@test.com`,
            password,
          );

          // When
          const response = await request(testContext.app.getHttpServer())
            .get(path)
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(400);

          // Then
          expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
        },
      );

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).get(
          "/v1/nudges/cooldown/some-user-id",
        );

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("읽음 처리", () => {
    describe("PATCH /nudges/:id/read - 읽음 처리", () => {
      it("받은 콕 찌름을 읽음 처리한다", async () => {
        // Given
        const sender = await testContext.helpers.createVerifiedUser(
          "nudge-read-s@test.com",
          password,
        );
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-read-r@test.com",
          password,
        );
        await testContext.helpers.createFriendship(sender, receiver);
        const todoId = await createReceiverTodo(receiver.accessToken);

        const nudgeResponse = await request(testContext.app.getHttpServer())
          .post("/v1/nudges")
          .set("Authorization", `Bearer ${sender.accessToken}`)
          .send({ receiverId: receiver.userId, todoId });
        const nudgeId = nudgeResponse.body.data.nudge.id;

        // When
        const response = await request(testContext.app.getHttpServer())
          .patch(`/v1/nudges/${nudgeId}/read`)
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(200);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.readCount).toBe(1);
      });

      it("존재하지 않는 콕 찌름 읽음 처리 시 404 에러 반환", async () => {
        // Given
        const receiver = await testContext.helpers.createVerifiedUser(
          "nudge-read-404@test.com",
          password,
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .patch("/v1/nudges/99999/read")
          .set("Authorization", `Bearer ${receiver.accessToken}`)
          .expect(404);

        // Then
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NUDGE_1105");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // When
        const response = await request(testContext.app.getHttpServer()).patch("/v1/nudges/1/read");

        // Then
        expect(response.status).toBe(401);
      });
    });
  });
});
