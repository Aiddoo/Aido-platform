/**
 * Inquiry E2E 테스트
 *
 * @description
 * 문의 접수 기능 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 인증된 사용자 문의 접수 성공
 * 2. 인증 없이 요청 시 401
 * 3. 잘못된 카테고리 → 400
 * 4. 내용 너무 짧음 → 400
 * 5. 각 카테고리 타입 정상 작동
 */

import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("문의 E2E", () => {
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

  describe("POST /inquiries - 문의 접수", () => {
    it("인증된 사용자가 문의를 접수한다 (201)", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "inquiry-user@example.com",
        "Test1234!",
      );

      // When
      const response = await request(testContext.app.getHttpServer())
        .post("/v1/inquiries")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({
          category: "BUG_REPORT",
          content: "앱에서 할 일 추가 시 가끔 오류가 발생합니다.",
        })
        .expect(201);

      // Then
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("문의가 접수되었습니다.");
    });

    it("문의 접수 시 FakeEmailService에 문의가 기록된다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "inquiry-email@example.com",
        "Test1234!",
      );

      // When
      await request(testContext.app.getHttpServer())
        .post("/v1/inquiries")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({
          category: "BUG_REPORT",
          content: "앱에서 할 일 추가 시 가끔 오류가 발생합니다.",
        })
        .expect(201);

      // Then
      const lastInquiry = testContext.fakeEmailService.getLastInquiry();
      expect(lastInquiry).toBeDefined();
      expect(lastInquiry?.data).toMatchObject({
        userEmail: "inquiry-email@example.com",
        category: "BUG_REPORT",
        categoryLabel: "버그 신고",
        content: "앱에서 할 일 추가 시 가끔 오류가 발생합니다.",
      });
      expect(testContext.fakeEmailService.getInquiryCount()).toBe(1);
    });

    it("메일 전송 실패는 INQUIRY_1501을 반환하고 접수 성공으로 기록하지 않는다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "inquiry-failure@example.test",
        "Test1234!",
      );
      testContext.fakeEmailService.simulateFailures(1);
      // When
      const response = await request(testContext.app.getHttpServer())
        .post("/v1/inquiries")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ category: "OTHER", content: "합성 문의 전송 실패를 확인합니다." })
        .expect(502);
      // Then
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INQUIRY_1501");
      expect(response.body.error.message).toBe("문의 이메일 발송에 실패했습니다.");
      expect(testContext.fakeEmailService.getFailureCount()).toBe(1);
      expect(testContext.fakeEmailService.getInquiryCount()).toBe(0);
    });

    it("인증 없이 요청 시 401 에러 반환", async () => {
      // When
      const response = await request(testContext.app.getHttpServer()).post("/v1/inquiries").send({
        category: "BUG_REPORT",
        content: "앱에서 할 일 추가 시 가끔 오류가 발생합니다.",
      });

      // Then
      expect(response.status).toBe(401);
    });

    it("잘못된 카테고리 시 400 에러 반환", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "inquiry-badcat@example.com",
        "Test1234!",
      );

      // When
      const response = await request(testContext.app.getHttpServer())
        .post("/v1/inquiries")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({
          category: "INVALID_CATEGORY",
          content: "잘못된 카테고리 테스트입니다.",
        })
        .expect(400);

      // Then
      expect(response.body.success).toBe(false);
    });

    it("내용이 너무 짧으면 400 에러 반환", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "inquiry-short@example.com",
        "Test1234!",
      );

      // When
      const response = await request(testContext.app.getHttpServer())
        .post("/v1/inquiries")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({
          category: "BUG_REPORT",
          content: "짧은내용",
        })
        .expect(400);

      // Then
      expect(response.body.success).toBe(false);
    });

    describe("각 카테고리 타입 정상 작동", () => {
      it("FEATURE_REQUEST 카테고리로 문의 접수", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "inquiry-feature@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/inquiries")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            category: "FEATURE_REQUEST",
            content: "새로운 기능을 추가해주시면 좋겠습니다. 상세 내용입니다.",
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe("문의가 접수되었습니다.");
      });

      it("PAYMENT 카테고리로 결제·구독 문의 접수", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "inquiry-payment@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/inquiries")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            category: "PAYMENT",
            content: "구독을 결제했는데 프리미엄이 적용되지 않습니다. 확인 부탁드립니다.",
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe("문의가 접수되었습니다.");
      });

      it("OTHER 카테고리로 문의 접수", async () => {
        // Given
        const user = await testContext.helpers.createVerifiedUser(
          "inquiry-other@example.com",
          "Test1234!",
        );

        // When
        const response = await request(testContext.app.getHttpServer())
          .post("/v1/inquiries")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            category: "OTHER",
            content: "기타 문의 내용입니다. 상세 내용을 작성합니다.",
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe("문의가 접수되었습니다.");
      });
    });
  });
});
