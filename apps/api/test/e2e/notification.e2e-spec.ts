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

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { FakeOAuthTokenVerifierService } from "../mocks/fake-oauth-token-verifier.service";
import { TestDatabase } from "../setup/test-database";

describe("Notification (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;

	/**
	 * 테스트용 사용자 등록 및 인증 헬퍼
	 * @returns { accessToken, userId }
	 */
	async function createVerifiedUser(
		email: string,
		password: string,
	): Promise<{ accessToken: string; userId: string }> {
		// 등록
		await request(app.getHttpServer())
			.post("/auth/register")
			.send({
				email,
				password,
				passwordConfirm: password,
				termsAgreed: true,
				privacyAgreed: true,
			})
			.expect(201);

		// 인증
		const code = fakeEmailService.getLastCode(email);
		const response = await request(app.getHttpServer())
			.post("/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return {
			accessToken: response.body.data.accessToken,
			userId: response.body.data.userId,
		};
	}

	beforeAll(async () => {
		// Testcontainers로 PostgreSQL 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		// FakeEmailService 인스턴스 생성
		fakeEmailService = new FakeEmailService();

		// FakeOAuthTokenVerifierService 인스턴스 생성
		fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.overrideProvider(EmailService)
			.useValue(fakeEmailService)
			.overrideProvider(OAuthTokenVerifierService)
			.useValue(fakeOAuthTokenVerifierService)
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();
	}, 60000);

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	describe("푸시 토큰 관리", () => {
		const userEmail = "notification-user@example.com";
		const password = "Test1234!";

		let user: { accessToken: string; userId: string };

		beforeAll(async () => {
			user = await createVerifiedUser(userEmail, password);
		});

		describe("POST /notifications/token - 푸시 토큰 등록", () => {
			it("유효한 Expo 토큰을 등록한다", async () => {
				const response = await request(app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
						deviceId: "test-device-001",
					})
					.expect(201);

				expect(response.body.success).toBe(true);
				expect(response.body.data.registered).toBe(true);
			});

			it("동일한 deviceId로 토큰을 갱신한다", async () => {
				const response = await request(app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]",
						deviceId: "test-device-001",
					})
					.expect(201);

				expect(response.body.success).toBe(true);
				expect(response.body.data.registered).toBe(true);
			});

			it("유효하지 않은 토큰 형식은 400 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "invalid-token-format",
						deviceId: "test-device-002",
					})
					.expect(400);

				expect(response.body.success).toBe(false);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.post("/notifications/token")
					.send({
						token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
					})
					.expect(401);
			});
		});

		describe("DELETE /notifications/token - 푸시 토큰 해제", () => {
			it("특정 deviceId의 토큰을 해제한다", async () => {
				// 먼저 토큰 등록
				await request(app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[deletetest1111111111]",
						deviceId: "delete-test-device",
					})
					.expect(201);

				// 토큰 해제
				const response = await request(app.getHttpServer())
					.delete("/notifications/token")
					.query({ deviceId: "delete-test-device" })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.registered).toBe(false);
			});

			it("모든 토큰을 해제한다 (deviceId 미지정)", async () => {
				// 여러 토큰 등록
				await request(app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[multidevice111111111]",
						deviceId: "multi-device-1",
					})
					.expect(201);

				await request(app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[multidevice222222222]",
						deviceId: "multi-device-2",
					})
					.expect(201);

				// 모든 토큰 해제
				const response = await request(app.getHttpServer())
					.delete("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.registered).toBe(false);
			});
		});
	});

	describe("알림 조회", () => {
		const userEmail = "notification-list-user@example.com";
		const password = "Test1234!";

		let user: { accessToken: string; userId: string };

		beforeAll(async () => {
			user = await createVerifiedUser(userEmail, password);
		});

		describe("GET /notifications - 알림 목록 조회", () => {
			it("알림 목록을 조회한다 (빈 목록)", async () => {
				const response = await request(app.getHttpServer())
					.get("/notifications")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.notifications).toBeInstanceOf(Array);
				expect(response.body.data.unreadCount).toBeDefined();
				expect(response.body.data.hasMore).toBe(false);
			});

			it("limit 파라미터로 조회 개수를 제한한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/notifications")
					.query({ limit: 5 })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.notifications).toBeInstanceOf(Array);
			});

			it("unreadOnly=true로 읽지 않은 알림만 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/notifications")
					.query({ unreadOnly: true })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.notifications).toBeInstanceOf(Array);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer()).get("/notifications").expect(401);
			});
		});

		describe("GET /notifications/unread-count - 읽지 않은 알림 수 조회", () => {
			it("읽지 않은 알림 수를 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/notifications/unread-count")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(typeof response.body.data.unreadCount).toBe("number");
				expect(response.body.data.unreadCount).toBeGreaterThanOrEqual(0);
			});
		});
	});

	describe("알림 읽음 처리", () => {
		const userEmail = "notification-read-user@example.com";
		const password = "Test1234!";

		let user: { accessToken: string; userId: string };

		beforeAll(async () => {
			user = await createVerifiedUser(userEmail, password);
		});

		describe("PATCH /notifications/:id/read - 단일 알림 읽음 처리", () => {
			it("존재하지 않는 알림 읽음 처리 시 404 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.patch("/notifications/99999/read")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(404);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NOTIFICATION_1004");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.patch("/notifications/1/read")
					.expect(401);
			});
		});

		describe("PATCH /notifications/read-all - 모든 알림 읽음 처리", () => {
			it("모든 알림을 읽음 처리한다", async () => {
				const response = await request(app.getHttpServer())
					.patch("/notifications/read-all")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toBeDefined();
				expect(typeof response.body.data.readCount).toBe("number");
			});
		});
	});
});
