import { randomUUID } from "node:crypto";

import {
  marketingPushOptOutResponseSchema,
  notificationInboxResponseSchema,
  notificationListResponseSchema,
  pushDeviceResponseSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
/**
 * Notification E2E 테스트
 *
 * @description
 * 알림 시스템 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 푸시 토큰 등록/해제
 * 2. 알림 목록 조회
 * 3. 읽지 않은 알림 수 조회
 * 4. 알림 읽음 처리
 */
import { eq } from "drizzle-orm";
import request from "supertest";

import { UpcomingRenewalNotifierPort } from "#api/modules/billing/subscriptions/application/ports/upcoming-renewal-notifier.port";
import { createBillingIssueNotificationMessage } from "#api/modules/notification/push/application/messages/notification.messages";
import { MarketingPushOptOutTokenPort } from "#api/modules/notification/push/application/ports/marketing-push-opt-out-token.port";
import { SendBillingIssueNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-billing-issue-notification.use-case";
import { requireRecord } from "#api/platform/database/database-error.util";
import {
  notification,
  pushDevice,
  pushToken,
  userConsent,
} from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { instantFromDate } from "#api/shared/domain/time/instant";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("알림 E2E", () => {
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

  const password = "Test1234!";

  /** 시드 알림 데이터 삽입 헬퍼 */
  async function seedNotifications(userId: string): Promise<void> {
    const client = ctx.testDatabase.getClient();
    const notifications = [];

    // SOCIAL 타입 알림 5개
    for (let i = 0; i < 5; i++) {
      notifications.push({
        userId,
        type: "FOLLOW_NEW" as const,
        title: `소셜 알림 ${i + 1}`,
        body: `소셜 알림 본문 ${i + 1}`,
        isRead: i < 2, // 2개는 읽음, 3개는 안읽음
      });
    }

    // NOTICE 타입 알림 3개
    for (let i = 0; i < 3; i++) {
      notifications.push({
        userId,
        type: "SYSTEM_NOTICE" as const,
        title: `공지 알림 ${i + 1}`,
        body: `공지 알림 본문 ${i + 1}`,
        isRead: false,
      });
    }

    // TODO 타입 알림 17개 (페이지네이션 테스트용)
    for (let i = 0; i < 17; i++) {
      notifications.push({
        userId,
        type: "TODO_REMINDER" as const,
        title: `할일 알림 ${i + 1}`,
        body: `할일 알림 본문 ${i + 1}`,
        isRead: false,
      });
    }

    // MORNING_REMINDER 알림: 할일 있는 사용자용 (치환된 title)
    notifications.push({
      userId,
      type: "MORNING_REMINDER" as const,
      title: "오늘 할일 3개",
      body: "미루면 저녁의 내가 울어",
      isRead: false,
    });

    // MORNING_REMINDER 알림: 할일 없는 사용자용
    notifications.push({
      userId,
      type: "MORNING_REMINDER" as const,
      title: "할일이 하나도 없다",
      body: "한가한 거 맞아? 뭐라도 적어봐",
      isRead: false,
    });

    await client.insert(notification).values(notifications);
  }

  describe("푸시 토큰 관리", () => {
    describe("POST /notifications/token - 푸시 토큰 등록", () => {
      it("유효한 Expo 토큰을 등록한다", async () => {
        // Given - 인증된 사용자와 유효한 Expo 토큰
        const user = await ctx.helpers.createVerifiedUser("notif-token1@test.com", password);

        // When - 푸시 토큰 등록 API 호출
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
            deviceId: "ios_test-device-001",
          })
          .expect(201);

        // Then - 토큰 등록 성공 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.registered).toBe(true);
      });

      it("동일한 deviceId로 토큰을 등록 후 갱신한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("notif-token2@test.com", password);

        // When - 첫 번째 토큰 등록
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
            deviceId: "ios_test-device-001",
          })
          .expect(201);

        // When - 동일한 deviceId로 새 토큰 등록 API 호출
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]",
            deviceId: "ios_test-device-001",
          })
          .expect(201);

        // Then - 토큰 갱신 성공 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.registered).toBe(true);
      });

      it("Accept-Language: en 헤더로 등록하면 UserPreference.locale이 en으로 저장된다", async () => {
        // Given
        const user = await ctx.helpers.createVerifiedUser("notif-locale-en@test.com", password);

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("Accept-Language", "en-US,en;q=0.9")
          .send({
            token: "ExponentPushToken[locale-en-xxxxxxxxxxxx]",
            deviceId: "ios_test-device-locale-en",
          })
          .expect(201);

        // Then
        const client = ctx.testDatabase.getClient();
        const preference = await client.query.userPreference.findFirst({
          where: { userId: user.userId },
        });
        expect(preference?.locale).toBe("en");
      });

      it("Accept-Language 미전송(1.3.x 구버전)은 저장된 locale을 덮어쓰지 않는다", async () => {
        // Given
        const user = await ctx.helpers.createVerifiedUser("notif-locale-none@test.com", password);
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("Accept-Language", "en")
          .send({
            token: "ExponentPushToken[locale-none-xxxxxxxxxx]",
            deviceId: "ios_test-device-locale-none",
          })
          .expect(201);

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "ExponentPushToken[locale-none-old-device]",
            deviceId: "ios_test-device-locale-none-old",
          })
          .expect(201);

        // Then
        const client = ctx.testDatabase.getClient();
        const preference = await client.query.userPreference.findFirst({
          where: { userId: user.userId },
        });
        expect(preference?.locale).toBe("en");
      });

      it("미지원 언어(Accept-Language: ja)는 ko로 폴백된다", async () => {
        // Given
        const user = await ctx.helpers.createVerifiedUser("notif-locale-ja@test.com", password);

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("Accept-Language", "ja-JP")
          .send({
            token: "ExponentPushToken[locale-ja-xxxxxxxxxxxx]",
            deviceId: "ios_test-device-locale-ja",
          })
          .expect(201);

        // Then
        const client = ctx.testDatabase.getClient();
        const preference = await client.query.userPreference.findFirst({
          where: { userId: user.userId },
        });
        expect(preference?.locale).toBe("ko");
      });

      it("언어 변경 후 재등록하면 locale이 갱신된다", async () => {
        // Given
        const user = await ctx.helpers.createVerifiedUser("notif-locale-switch@test.com", password);
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("Accept-Language", "en")
          .send({
            token: "ExponentPushToken[locale-switch-xxxxxxxx]",
            deviceId: "ios_test-device-locale-switch",
          })
          .expect(201);

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("Accept-Language", "ko")
          .send({
            token: "ExponentPushToken[locale-switch-xxxxxxxx]",
            deviceId: "ios_test-device-locale-switch",
          })
          .expect(201);

        // Then
        const client = ctx.testDatabase.getClient();
        const preference = await client.query.userPreference.findFirst({
          where: { userId: user.userId },
        });
        expect(preference?.locale).toBe("ko");
      });

      it("유효하지 않은 토큰 형식은 400 에러 반환", async () => {
        // Given - 유효하지 않은 토큰 형식
        const user = await ctx.helpers.createVerifiedUser("notif-token3@test.com", password);

        // When - 유효하지 않은 토큰으로 등록 API 호출
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "invalid-token-format",
            deviceId: "ios_test-device-002",
          })
          .expect(400);

        // Then - 유효성 검증 에러 검증
        expect(response.body.success).toBe(false);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // Given - 인증 토큰 없음

        // When - 인증 없이 푸시 토큰 등록 API 호출
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .send({
            token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
          })
          .expect(401);

        // Then - 401 Unauthorized 응답 확인 (expect에서 검증)
      });
    });

    describe("PUT /notifications/push-devices/:deviceId - 푸시 기기 보고", () => {
      it("허용 권한과 토큰을 보고하면 계약 응답을 돌려주고 토큰을 플랫폼과 함께 저장한다", async () => {
        // Given
        const user = await ctx.helpers.createVerifiedUser("push-device-1@test.com", password);

        // When
        const response = await request(ctx.app.getHttpServer())
          .put("/v1/notifications/push-devices/android_e2e-1")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("X-App-Version", "1.14.2")
          .send({
            permission: { status: "GRANTED", canAskAgain: false },
            token: "ExponentPushToken[push-device-e2e-1]",
            payloadVersion: 2,
          })
          .expect(200);

        // Then
        expect(pushDeviceResponseSchema.parse(response.body.data)).toMatchObject({
          deviceId: "android_e2e-1",
          platform: "ANDROID",
          hasActiveToken: true,
        });
        const [row] = await ctx.testDatabase
          .getClient()
          .select()
          .from(pushToken)
          .where(eq(pushToken.userId, user.userId));
        expect(row).toMatchObject({ platform: "ANDROID", payloadVersion: 2, appVersion: "1.14.2" });
      });

      it("권한을 거절하면 토큰을 지우고 권한 상태만 남긴다", async () => {
        // Given 허용 상태로 보고한 기기
        const user = await ctx.helpers.createVerifiedUser("push-device-2@test.com", password);
        const report = (body: object) =>
          request(ctx.app.getHttpServer())
            .put("/v1/notifications/push-devices/ios_e2e-2")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .send(body);
        await report({
          permission: { status: "GRANTED", canAskAgain: false },
          token: "ExponentPushToken[push-device-e2e-2]",
          payloadVersion: 2,
        }).expect(200);

        // When
        const response = await report({
          permission: { status: "DENIED", canAskAgain: false },
          token: null,
          payloadVersion: 2,
        }).expect(200);

        // Then
        expect(response.body.data).toMatchObject({ hasActiveToken: false, platform: "IOS" });
        expect(
          await ctx.testDatabase.getClient().$count(pushToken, eq(pushToken.userId, user.userId)),
        ).toBe(0);
        const [device] = await ctx.testDatabase
          .getClient()
          .select()
          .from(pushDevice)
          .where(eq(pushDevice.userId, user.userId));
        expect(device).toMatchObject({ permissionStatus: "DENIED", permissionCanAskAgain: false });
      });

      it("deviceId 접두어로 플랫폼을 알 수 없으면 400 NOTIFICATION_1006을 돌려준다", async () => {
        const user = await ctx.helpers.createVerifiedUser("push-device-3@test.com", password);

        const response = await request(ctx.app.getHttpServer())
          .put("/v1/notifications/push-devices/web_e2e-3")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            permission: { status: "NOT_DETERMINED", canAskAgain: true },
            token: null,
            payloadVersion: 2,
          })
          .expect(400);

        expect(response.body.error.code).toBe(ErrorCode.NOTIFICATION_1006);
      });
    });

    describe("1.14.1 이하 앱 호환", () => {
      it("deviceId 없이 등록해도 X-Device-Type 헤더로 플랫폼을 정해 201을 돌려준다", async () => {
        // Given deviceId를 보내지 않는 오래된 요청
        const user = await ctx.helpers.createVerifiedUser("push-legacy-1@test.com", password);

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("X-Device-Type", "ANDROID")
          .send({ token: "ExponentPushToken[push-legacy-e2e-1]" })
          .expect(201);

        // Then
        const [row] = await ctx.testDatabase
          .getClient()
          .select()
          .from(pushToken)
          .where(eq(pushToken.userId, user.userId));
        expect(row).toMatchObject({ deviceId: "default", platform: "ANDROID" });
      });

      it("토큰 해제는 기기 권한 기록도 함께 지운다", async () => {
        const user = await ctx.helpers.createVerifiedUser("push-legacy-2@test.com", password);
        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ token: "ExponentPushToken[push-legacy-e2e-2]", deviceId: "ios_legacy-2" })
          .expect(201);

        await request(ctx.app.getHttpServer())
          .delete("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .query({ deviceId: "ios_legacy-2" })
          .expect(200);

        expect(
          await ctx.testDatabase.getClient().$count(pushDevice, eq(pushDevice.userId, user.userId)),
        ).toBe(0);
        expect(
          await ctx.testDatabase.getClient().$count(pushToken, eq(pushToken.userId, user.userId)),
        ).toBe(0);
      });
    });

    describe("DELETE /notifications/token - 푸시 토큰 해제", () => {
      it("특정 deviceId의 토큰을 해제한다", async () => {
        // Given - 토큰이 등록된 deviceId
        const user = await ctx.helpers.createVerifiedUser("notif-del1@test.com", password);

        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "ExponentPushToken[deletetest1111111111]",
            deviceId: "ios_delete-test-device",
          })
          .expect(201);

        // When - 특정 deviceId의 토큰 해제 API 호출
        const response = await request(ctx.app.getHttpServer())
          .delete("/v1/notifications/token")
          .query({ deviceId: "ios_delete-test-device" })
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 토큰 해제 성공 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.registered).toBe(false);
      });

      it("100자를 넘는 deviceId는 400 SYS_0002를 반환한다", async () => {
        // Given
        const user = await ctx.helpers.createVerifiedUser("notif-del-invalid@test.com", password);

        // When
        const response = await request(ctx.app.getHttpServer())
          .delete("/v1/notifications/token")
          .query({ deviceId: "d".repeat(101) })
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(400);

        // Then
        expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
      });

      it("모든 토큰을 해제한다 (deviceId 미지정)", async () => {
        // Given - 여러 deviceId에 토큰이 등록된 상태
        const user = await ctx.helpers.createVerifiedUser("notif-del2@test.com", password);

        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "ExponentPushToken[multidevice111111111]",
            deviceId: "ios_multi-device-1",
          })
          .expect(201);

        await request(ctx.app.getHttpServer())
          .post("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({
            token: "ExponentPushToken[multidevice222222222]",
            deviceId: "ios_multi-device-2",
          })
          .expect(201);

        // When - deviceId 미지정으로 모든 토큰 해제 API 호출
        const response = await request(ctx.app.getHttpServer())
          .delete("/v1/notifications/token")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 모든 토큰 해제 성공 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.registered).toBe(false);
      });
    });
  });

  describe("알림 조회", () => {
    describe("GET /notifications - 알림 목록 조회", () => {
      it("알림 목록을 조회한다 (빈 목록)", async () => {
        // Given - 알림이 없는 상태의 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("notif-list1@test.com", password);

        // When - 알림 목록 조회 API 호출
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/notifications")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 빈 알림 목록 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.notifications).toBeInstanceOf(Array);
        expect(response.body.data.unreadCount).toBeDefined();
        expect(response.body.data.hasMore).toBe(false);
      });

      it("limit 파라미터로 조회 개수를 제한한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("notif-list2@test.com", password);

        // When - limit을 5로 설정하여 알림 목록 조회 API 호출
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/notifications")
          .query({ limit: 5 })
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - limit 적용 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.notifications).toBeInstanceOf(Array);
      });

      it("unreadOnly=true로 읽지 않은 알림만 조회한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("notif-list3@test.com", password);

        // When - unreadOnly=true로 알림 목록 조회 API 호출
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/notifications")
          .query({ unreadOnly: true })
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 읽지 않은 알림만 조회됨 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.notifications).toBeInstanceOf(Array);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // Given - 인증 토큰 없음

        // When - 인증 없이 알림 목록 조회 API 호출
        await request(ctx.app.getHttpServer()).get("/v1/notifications").expect(401);

        // Then - 401 Unauthorized 응답 확인 (expect에서 검증)
      });

      describe("카테고리 필터링", () => {
        it("category=ALL이면 모든 알림을 반환해야 한다", async () => {
          // Given - 인증된 사용자
          const user = await ctx.helpers.createVerifiedUser("notif-cat-all@test.com", password);

          // When - category=ALL로 알림 목록 조회
          const response = await request(ctx.app.getHttpServer())
            .get("/v1/notifications?category=ALL")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(200);

          // Then - 모든 알림 반환 검증
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty("notifications");
          expect(response.body.data).toHaveProperty("hasMore");
        });

        it("category 미지정이면 기본값 ALL로 동작해야 한다", async () => {
          // Given - 인증된 사용자
          const user = await ctx.helpers.createVerifiedUser("notif-cat-default@test.com", password);

          // When - category 미지정으로 알림 목록 조회
          const response = await request(ctx.app.getHttpServer())
            .get("/v1/notifications")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(200);

          // Then - 기본값 ALL 동작 검증
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty("notifications");
        });

        it("유효하지 않은 category이면 400을 반환해야 한다", async () => {
          // Given - 유효하지 않은 category 값
          const user = await ctx.helpers.createVerifiedUser("notif-cat-invalid@test.com", password);

          // When - 유효하지 않은 category로 알림 목록 조회
          const response = await request(ctx.app.getHttpServer())
            .get("/v1/notifications?category=INVALID")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(400);

          // Then - 400 Bad Request 반환 검증
          expect(response.body.success).toBe(false);
        });

        it("category=SOCIAL이면 소셜 알림만 반환해야 한다", async () => {
          // Given - 인증된 사용자
          const user = await ctx.helpers.createVerifiedUser("notif-cat-social@test.com", password);

          // When - category=SOCIAL로 알림 목록 조회
          const response = await request(ctx.app.getHttpServer())
            .get("/v1/notifications?category=SOCIAL")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(200);

          // Then - 소셜 알림만 반환 검증
          expect(response.body.success).toBe(true);
          const notifications = response.body.data.notifications;
          const socialTypes = [
            "FOLLOW_NEW",
            "FOLLOW_ACCEPTED",
            "NUDGE_RECEIVED",
            "CHEER_RECEIVED",
            "FRIEND_COMPLETED",
          ];
          for (const notification of notifications) {
            expect(socialTypes).toContain(notification.type);
          }
        });

        it("category=NOTICE이면 공지 알림만 반환해야 한다", async () => {
          // Given - 인증된 사용자
          const user = await ctx.helpers.createVerifiedUser("notif-cat-notice@test.com", password);

          // When - category=NOTICE로 알림 목록 조회
          const response = await request(ctx.app.getHttpServer())
            .get("/v1/notifications?category=NOTICE")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(200);

          // Then - 공지 알림만 반환 검증
          expect(response.body.success).toBe(true);
          const notifications = response.body.data.notifications;
          const noticeTypes = [
            "SYSTEM_NOTICE",
            "ADMIN_BROADCAST",
            "ADMIN_TARGETED",
            "WEEKLY_ACHIEVEMENT",
            "WEEKLY_REPORT",
          ];
          for (const notification of notifications) {
            expect(noticeTypes).toContain(notification.type);
          }
        });

        it("category=TODO이면 할일 알림만 반환해야 한다", async () => {
          // Given - 인증된 사용자
          const user = await ctx.helpers.createVerifiedUser("notif-cat-todo@test.com", password);

          // When - category=TODO로 알림 목록 조회
          const response = await request(ctx.app.getHttpServer())
            .get("/v1/notifications?category=TODO")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(200);

          // Then - 할일 알림만 반환 검증
          expect(response.body.success).toBe(true);
          const notifications = response.body.data.notifications;
          const todoTypes = [
            "TODO_REMINDER",
            "TODO_SHARED",
            "DAILY_COMPLETE",
            "MORNING_REMINDER",
            "EVENING_REMINDER",
          ];
          for (const notification of notifications) {
            expect(todoTypes).toContain(notification.type);
          }
        });

        it("category와 unreadOnly를 함께 사용할 수 있어야 한다", async () => {
          // Given - 인증된 사용자
          const user = await ctx.helpers.createVerifiedUser("notif-cat-combo@test.com", password);

          // When - category와 unreadOnly 동시 사용
          const response = await request(ctx.app.getHttpServer())
            .get("/v1/notifications?category=SOCIAL&unreadOnly=true")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(200);

          // Then - 정상 응답 검증
          expect(response.body.success).toBe(true);
        });
      });
    });

    describe("GET /notifications/unread-count - 읽지 않은 알림 수 조회", () => {
      it("읽지 않은 알림 수를 조회한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("notif-unread@test.com", password);

        // When - 읽지 않은 알림 수 조회 API 호출
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/notifications/unread-count")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 읽지 않은 알림 수 검증
        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.unreadCount).toBe("number");
        expect(response.body.data.unreadCount).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("시드 데이터 기반 알림 조회", () => {
    it("category=SOCIAL 필터링 시 소셜 알림만 반환해야 한다", async () => {
      // Given - 시드 데이터로 다양한 타입의 알림 생성
      const user = await ctx.helpers.createVerifiedUser("notif-seed-social@test.com", password);
      await seedNotifications(user.userId);

      // When - category=SOCIAL로 알림 목록 조회
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/notifications?category=SOCIAL")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - 소셜 알림 5개만 반환 검증
      const notifications = response.body.data.notifications;
      expect(notifications.length).toBe(5);
      const socialTypes = [
        "FOLLOW_NEW",
        "FOLLOW_ACCEPTED",
        "NUDGE_RECEIVED",
        "CHEER_RECEIVED",
        "FRIEND_COMPLETED",
      ];
      for (const notification of notifications) {
        expect(socialTypes).toContain(notification.type);
      }
    });

    it("페이지네이션이 정상 동작해야 한다 (limit=10)", async () => {
      // Given - 27개의 시드 데이터 알림
      const user = await ctx.helpers.createVerifiedUser("notif-seed-page@test.com", password);
      await seedNotifications(user.userId);

      // When - 1페이지
      const page1 = await request(ctx.app.getHttpServer())
        .get("/v1/notifications?limit=10")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - 1페이지
      expect(page1.body.data.notifications.length).toBe(10);
      expect(page1.body.data.hasMore).toBe(true);
      expect(page1.body.data.nextCursor).toBeDefined();

      // When - 2페이지
      const page2 = await request(ctx.app.getHttpServer())
        .get(`/v1/notifications?limit=10&cursor=${page1.body.data.nextCursor}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - 2페이지
      expect(page2.body.data.notifications.length).toBe(10);
      expect(page2.body.data.hasMore).toBe(true);

      // When - 3페이지
      const page3 = await request(ctx.app.getHttpServer())
        .get(`/v1/notifications?limit=10&cursor=${page2.body.data.nextCursor}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - 3페이지 (마지막)
      expect(page3.body.data.notifications.length).toBe(7);
      expect(page3.body.data.hasMore).toBe(false);

      // 모든 페이지의 알림 ID가 중복되지 않는지 확인
      const allIds = [
        ...page1.body.data.notifications.map((n: { id: number }) => n.id),
        ...page2.body.data.notifications.map((n: { id: number }) => n.id),
        ...page3.body.data.notifications.map((n: { id: number }) => n.id),
      ];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(27);
    });

    it("카테고리 + 페이지네이션 조합이 동작해야 한다", async () => {
      // Given - TODO 카테고리 알림 19개 (TODO_REMINDER 17 + MORNING_REMINDER 2)
      const user = await ctx.helpers.createVerifiedUser("notif-seed-catpage@test.com", password);
      await seedNotifications(user.userId);

      // When - TODO 카테고리 1페이지 (10개)
      const page1 = await request(ctx.app.getHttpServer())
        .get("/v1/notifications?category=TODO&limit=10")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - 1페이지 검증
      expect(page1.body.data.notifications.length).toBe(10);
      expect(page1.body.data.hasMore).toBe(true);
      const todoTypes = [
        "TODO_REMINDER",
        "TODO_SHARED",
        "DAILY_COMPLETE",
        "MORNING_REMINDER",
        "EVENING_REMINDER",
      ];
      for (const notification of page1.body.data.notifications) {
        expect(todoTypes).toContain(notification.type);
      }

      // When - TODO 카테고리 2페이지 (나머지 9개)
      const page2 = await request(ctx.app.getHttpServer())
        .get(`/v1/notifications?category=TODO&limit=10&cursor=${page1.body.data.nextCursor}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - 2페이지 검증
      expect(page2.body.data.notifications.length).toBe(9);
      expect(page2.body.data.hasMore).toBe(false);
      for (const notification of page2.body.data.notifications) {
        expect(todoTypes).toContain(notification.type);
      }
    });

    it("cursor=0으로 요청하면 첫 페이지와 동일한 결과를 반환한다", async () => {
      // Given - 시드 데이터 생성 및 cursor=0은 유효한 요청 (nonnegative 정수)
      const user = await ctx.helpers.createVerifiedUser("notif-seed-cursor0@test.com", password);
      await seedNotifications(user.userId);

      // When - cursor=0으로 조회
      const cursorZeroPage = await request(ctx.app.getHttpServer())
        .get("/v1/notifications?limit=10&cursor=0")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - 400 에러가 나지 않고, 정상 응답이어야 한다
      expect(cursorZeroPage.body.success).toBe(true);
      expect(cursorZeroPage.body.data.notifications).toBeInstanceOf(Array);
      expect(cursorZeroPage.body.data).toHaveProperty("hasMore");
    });

    it("MORNING_REMINDER 알림이 치환된 title로 정상 조회되어야 한다", async () => {
      // Given - 시드 데이터로 MORNING_REMINDER 알림 2개 생성
      const user = await ctx.helpers.createVerifiedUser("notif-seed-morning@test.com", password);
      await seedNotifications(user.userId);

      // When - 전체 알림 조회
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/notifications?limit=50")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - MORNING_REMINDER 알림이 포함되어 있어야 한다
      const morningReminders = response.body.data.notifications.filter(
        (n: { type: string }) => n.type === "MORNING_REMINDER",
      );
      expect(morningReminders.length).toBe(2);

      // 할일 있는 사용자용 알림: {count}가 치환된 title
      const withTodos = morningReminders.find(
        (n: { title: string }) => n.title === "오늘 할일 3개",
      );
      expect(withTodos).toBeDefined();
      expect(withTodos.title).not.toContain("{count}");
      expect(withTodos.body).toBe("미루면 저녁의 내가 울어");

      // 할일 없는 사용자용 알림
      const noTodos = morningReminders.find(
        (n: { title: string }) => n.title === "할일이 하나도 없다",
      );
      expect(noTodos).toBeDefined();
      expect(noTodos.body).toBe("한가한 거 맞아? 뭐라도 적어봐");
    });

    it("category=TODO 필터로 MORNING_REMINDER가 조회되어야 한다", async () => {
      // Given - 시드 데이터로 TODO 카테고리 알림 생성
      const user = await ctx.helpers.createVerifiedUser(
        "notif-seed-todomorning@test.com",
        password,
      );
      await seedNotifications(user.userId);

      // When - TODO 카테고리 필터링
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/notifications?category=TODO&limit=50")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - MORNING_REMINDER가 TODO 카테고리에 포함되어야 한다
      const notifications = response.body.data.notifications;
      const morningReminders = notifications.filter(
        (n: { type: string }) => n.type === "MORNING_REMINDER",
      );
      expect(morningReminders.length).toBe(2);

      // 모든 알림이 TODO 카테고리 타입이어야 한다
      const todoTypes = [
        "TODO_REMINDER",
        "TODO_SHARED",
        "DAILY_COMPLETE",
        "MORNING_REMINDER",
        "EVENING_REMINDER",
      ];
      for (const notification of notifications) {
        expect(todoTypes).toContain(notification.type);
      }
    });

    it("category=SOCIAL 필터에 MORNING_REMINDER가 포함되지 않아야 한다", async () => {
      // Given - 시드 데이터로 다양한 타입의 알림 생성
      const user = await ctx.helpers.createVerifiedUser("notif-seed-nosocial@test.com", password);
      await seedNotifications(user.userId);

      // When - SOCIAL 카테고리 필터링
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/notifications?category=SOCIAL&limit=50")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then - MORNING_REMINDER가 SOCIAL 카테고리에 포함되지 않아야 한다
      const morningReminders = response.body.data.notifications.filter(
        (n: { type: string }) => n.type === "MORNING_REMINDER",
      );
      expect(morningReminders.length).toBe(0);
    });
  });

  describe("알림 읽음 처리", () => {
    describe("POST /notifications/:id/opened - 푸시 탭 기록", () => {
      it("탭을 멱등 기록하고 알림을 즉시 읽음 처리한다", async () => {
        const user = await ctx.helpers.createVerifiedUser("notif-opened@test.com", password);
        const client = ctx.testDatabase.getClient();
        const [created] = await client
          .insert(notification)
          .values({
            userId: user.userId,
            type: "TODO_REMINDER",
            title: "열림 기록 테스트",
            body: "본문",
          })
          .returning();
        const target = requireRecord(created);

        const first = await request(ctx.app.getHttpServer())
          .post(`/v1/notifications/${target.id}/opened`)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);
        const second = await request(ctx.app.getHttpServer())
          .post(`/v1/notifications/${target.id}/opened`)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        expect(first.body.data.opened).toBe(true);
        expect(second.body.data.opened).toBe(false);
        const persisted = requireRecord(
          await client.query.notification.findFirst({ where: { id: target.id } }),
        );
        expect(persisted.openedAt).toBeInstanceOf(Temporal.Instant);
        expect(persisted.isRead).toBe(true);
      });
    });

    describe("PATCH /notifications/:id/read - 단일 알림 읽음 처리", () => {
      it("존재하지 않는 알림 읽음 처리 시 404 에러 반환", async () => {
        // Given - 존재하지 않는 알림 ID
        const user = await ctx.helpers.createVerifiedUser("notif-read-404@test.com", password);

        // When - 존재하지 않는 알림 읽음 처리 API 호출
        const response = await request(ctx.app.getHttpServer())
          .patch("/v1/notifications/99999/read")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(404);

        // Then - 알림 없음 에러 검증
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NOTIFICATION_1004");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // Given - 인증 토큰 없음

        // When - 인증 없이 단일 알림 읽음 처리 API 호출
        await request(ctx.app.getHttpServer()).patch("/v1/notifications/1/read").expect(401);

        // Then - 401 Unauthorized 응답 확인 (expect에서 검증)
      });
    });

    describe("PATCH /notifications/read-all - 모든 알림 읽음 처리", () => {
      it("모든 알림을 읽음 처리한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("notif-readall@test.com", password);

        // When - 모든 알림 읽음 처리 API 호출
        const response = await request(ctx.app.getHttpServer())
          .patch("/v1/notifications/read-all")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 모든 알림 읽음 처리 성공 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBeDefined();
        expect(typeof response.body.data.readCount).toBe("number");
      });
    });
  });

  describe("광고성 푸시 수신 철회", () => {
    it("서명 토큰으로 로그인 없이 동의를 철회한다", async () => {
      const user = await ctx.helpers.createVerifiedUser("notif-opt-out@test.com", password);
      const client = ctx.testDatabase.getClient();
      await client
        .insert(userConsent)
        .values({
          userId: user.userId,
          marketingPushAgreedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        })
        .onConflictDoUpdate({
          target: userConsent.userId,
          set: { marketingPushAgreedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()) },
        });
      const tokenPort = ctx.app.get(MarketingPushOptOutTokenPort);

      const response = await request(ctx.app.getHttpServer())
        .post("/v1/notifications/marketing-push/opt-out")
        .send({ token: tokenPort.issue(user.userId) })
        .expect(200);

      expect(marketingPushOptOutResponseSchema.parse(response.body.data)).toMatchObject({
        optedOut: true,
        marketingPushWithdrawnAt: expect.any(String),
      });
      const consent = requireRecord(
        await client.query.userConsent.findFirst({ where: { userId: user.userId } }),
      );
      expect(consent.marketingPushAgreedAt).toBeNull();
    });

    it("잘못된 토큰도 동일한 응답을 반환해 토큰 유효성을 노출하지 않는다", async () => {
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/notifications/marketing-push/opt-out")
        .send({ token: "invalid.token" })
        .expect(200);

      // 처리 시각도 유효한 토큰과 같은 모양이라 응답만으로 구별할 수 없다
      expect(
        Object.keys(marketingPushOptOutResponseSchema.parse(response.body.data)).sort(),
      ).toEqual(["marketingPushWithdrawnAt", "optedOut"]);
    });
  });

  describe("앱 버전별 새 알림 노출", () => {
    it("1.12.1 이하 앱은 초대·보상 종료 알림을 받지 못하고 1.13.0부터 알림함에 보인다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("notif-invite@test.com", password);
      await ctx.testDatabase
        .getClient()
        .insert(notification)
        .values(
          (["FOLLOW_NEW", "INVITE_JOINED", "PREMIUM_GRANT_ENDING"] as const).map((type) => ({
            userId: user.userId,
            type,
            title: type,
            body: type,
          })),
        );

      // When
      const released = await request(ctx.app.getHttpServer())
        .get("/v1/notifications/inbox")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-App-Version", "1.12.1")
        .expect(200);
      const legacy = await request(ctx.app.getHttpServer())
        .get("/v1/notifications")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      const updated = await request(ctx.app.getHttpServer())
        .get("/v1/notifications/inbox")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-App-Version", "1.13.0")
        .expect(200);

      // Then
      const releasedInbox = notificationInboxResponseSchema.parse(released.body.data);
      expect(releasedInbox.notifications.map((item) => item.type)).toEqual(["FOLLOW_NEW"]);
      expect(releasedInbox.unreadCount).toBe(1);
      expect(
        notificationListResponseSchema
          .parse(legacy.body.data)
          .notifications.map((item) => item.type),
      ).toEqual(["FOLLOW_NEW"]);
      const updatedInbox = notificationInboxResponseSchema.parse(updated.body.data);
      expect(updatedInbox.notifications.map((item) => item.type).sort()).toEqual([
        "FOLLOW_NEW",
        "INVITE_JOINED",
        "PREMIUM_GRANT_ENDING",
      ]);
      expect(updatedInbox.unreadCount).toBe(3);
    });

    it.each([
      { name: "버전 헤더 없음", version: undefined, visible: ["FOLLOW_NEW"] },
      { name: "1.12.1", version: "1.12.1", visible: ["FOLLOW_NEW"] },
      {
        name: "1.13.0",
        version: "1.13.0",
        visible: [
          "FOLLOW_NEW",
          "INVITE_JOINED",
          "INVITE_PROGRESS",
          "INVITE_QUALIFY_REMINDER",
          "INVITE_REWARDED",
          "PREMIUM_GRANT_ENDING",
        ],
      },
    ])(
      "$name 앱의 알림함·안 읽은 수는 버전 헤더로 초대·보상 알림을 거르고 구 목록 API는 항상 숨긴다",
      async ({ version, visible }) => {
        // Given
        const user = await ctx.helpers.createVerifiedUser(
          `notif-gate-${version ?? "none"}@test.com`,
          password,
        );
        await ctx.testDatabase
          .getClient()
          .insert(notification)
          .values(
            (
              [
                "FOLLOW_NEW",
                "INVITE_JOINED",
                "INVITE_REWARDED",
                "INVITE_PROGRESS",
                "INVITE_QUALIFY_REMINDER",
                "PREMIUM_GRANT_ENDING",
              ] as const
            ).map((type) => ({ userId: user.userId, type, title: type, body: type })),
          );
        const get = (path: string) => {
          const call = request(ctx.app.getHttpServer())
            .get(path)
            .set("Authorization", `Bearer ${user.accessToken}`);
          return (version == null ? call : call.set("X-App-Version", version)).expect(200);
        };

        // When
        const [inbox, list, unread] = await Promise.all([
          get("/v1/notifications/inbox"),
          get("/v1/notifications"),
          get("/v1/notifications/inbox/unread-count"),
        ]);

        // Then
        expect(
          notificationInboxResponseSchema
            .parse(inbox.body.data)
            .notifications.map((item) => item.type)
            .sort(),
        ).toEqual(visible);
        expect(
          notificationListResponseSchema
            .parse(list.body.data)
            .notifications.map((item) => item.type),
        ).toEqual(["FOLLOW_NEW"]);
        expect(unread.body.data.unreadCount).toBe(visible.length);
      },
    );
  });

  describe("공지 알림의 앱 이동 경로", () => {
    it("결제 문제 공지는 알림함에 구독 화면 DEEP_LINK를 싣는다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("notif-billing@test.com", password);

      // When
      await ctx.module.get(SendBillingIssueNotificationUseCase).execute({ userId: user.userId });
      const inbox = await request(ctx.app.getHttpServer())
        .get("/v1/notifications/inbox")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-App-Version", "1.13.0")
        .expect(200);

      // Then
      const [notice] = notificationInboxResponseSchema.parse(inbox.body.data).notifications;
      expect(notice).toMatchObject({
        type: "SYSTEM_NOTICE",
        action: { type: "DEEP_LINK", url: "/settings/subscription" },
      });
    });

    it.each([undefined, "1.13.0"])(
      "연간 갱신 안내는 앱 버전 %s 알림함에 SYSTEM_NOTICE·구독 화면 DEEP_LINK로 보이고 공지 카테고리에 든다",
      async (version) => {
        // Given
        const user = await ctx.helpers.createVerifiedUser("notif-renewal@test.com", password);
        const now = new Date();
        await ctx.module.get(UnitOfWorkPort).run(() =>
          ctx.module.get(UpcomingRenewalNotifierPort).notify(
            [
              {
                subscriptionId: 1,
                userId: user.userId,
                expiresAt: instantFromDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
                isCurrentChain: true,
              },
            ],
            instantFromDate(now),
          ),
        );
        const get = (path: string) => {
          const call = request(ctx.app.getHttpServer())
            .get(path)
            .set("Authorization", `Bearer ${user.accessToken}`);
          return (version == null ? call : call.set("X-App-Version", version)).expect(200);
        };

        // When
        const [inbox, notices] = await Promise.all([
          get("/v1/notifications/inbox"),
          get("/v1/notifications?category=NOTICE"),
        ]);

        // Then
        const [notice] = notificationInboxResponseSchema.parse(inbox.body.data).notifications;
        expect(notice).toMatchObject({
          type: "SYSTEM_NOTICE",
          action: { type: "DEEP_LINK", url: "/settings/subscription" },
        });
        expect(
          notificationListResponseSchema
            .parse(notices.body.data)
            .notifications.map((item) => item.type),
        ).toEqual(["SYSTEM_NOTICE"]);
      },
    );
  });

  describe("알림함 요청 언어", () => {
    it("한국어로 만든 알림은 Accept-Language: en 알림함에 영어로 보이고 copyKey 없는 옛 알림은 저장 문구를 준다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("notif-locale@test.com", password);
      await ctx.module.get(SendBillingIssueNotificationUseCase).execute({ userId: user.userId });
      await ctx.testDatabase.getClient().insert(notification).values({
        userId: user.userId,
        type: "FOLLOW_NEW",
        title: "옛 알림 제목",
        body: "옛 알림 본문",
      });
      const korean = createBillingIssueNotificationMessage({ locale: "ko" });
      const english = createBillingIssueNotificationMessage({ locale: "en" });
      const get = (path: string) =>
        request(ctx.app.getHttpServer())
          .get(path)
          .set("Authorization", `Bearer ${user.accessToken}`)
          .set("X-App-Version", "1.13.0")
          .set("Accept-Language", "en")
          .expect(200);

      // When
      const [inbox, list] = await Promise.all([
        get("/v1/notifications/inbox"),
        get("/v1/notifications"),
      ]);

      // Then
      const stored = await ctx.testDatabase
        .getClient()
        .select({ title: notification.title, copyKey: notification.copyKey })
        .from(notification)
        .where(eq(notification.type, "SYSTEM_NOTICE"));
      expect(stored).toEqual([{ title: korean.title, copyKey: korean.copyKey }]);
      for (const items of [
        notificationInboxResponseSchema.parse(inbox.body.data).notifications,
        notificationListResponseSchema.parse(list.body.data).notifications,
      ]) {
        expect(items.find((item) => item.type === "SYSTEM_NOTICE")).toMatchObject({
          title: english.title,
          body: english.body,
        });
        expect(items.find((item) => item.type === "FOLLOW_NEW")).toMatchObject({
          title: "옛 알림 제목",
          body: "옛 알림 본문",
        });
      }
    });
  });

  describe("할 일 알림의 이동 재료", () => {
    it("친구 할 일에 댓글을 받으면 알림함 metadata에 할 일 주인과 날짜를 싣는다", async () => {
      // Given
      const owner = await ctx.helpers.createVerifiedUser("notif-todo-owner@test.com", password);
      const friend = await ctx.helpers.createVerifiedUser("notif-todo-friend@test.com", password);
      await ctx.helpers.createFriendship(owner, friend);
      const categoryId = await ctx.helpers.getDefaultCategoryId(owner.accessToken);
      const todo = await request(ctx.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ title: "친구 할 일", categoryId, startDate: "2026-08-14", visibility: "PUBLIC" })
        .expect(201);
      const todoId: number = todo.body.data.todo.id;

      // When
      await request(ctx.app.getHttpServer())
        .post(`/v1/todos/${todoId}/comments`)
        .set("Authorization", `Bearer ${friend.accessToken}`)
        .send({ parentId: null, items: [{ clientRequestId: randomUUID(), content: "응원해" }] })
        .expect(201);
      const inbox = await request(ctx.app.getHttpServer())
        .get("/v1/notifications/inbox")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .set("X-App-Version", "1.13.0")
        .expect(200);

      // Then
      const [notification] = notificationInboxResponseSchema.parse(inbox.body.data).notifications;
      expect(notification).toMatchObject({
        type: "TODO_SHARED",
        context: { todoId },
        metadata: { todoOwnerId: owner.userId, todoDate: "2026-08-14" },
      });
    });
  });
});
