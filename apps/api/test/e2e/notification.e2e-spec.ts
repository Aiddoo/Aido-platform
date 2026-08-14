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

import request from "supertest";

import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "@/notification/application/ports/marketing-push-opt-out-token.port";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("알림 E2E", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.reset();
	});

	const password = "Test1234!";

	/** 시드 알림 데이터 삽입 헬퍼 */
	async function seedNotifications(userId: string): Promise<void> {
		const prisma = ctx.testDatabase.getPrisma();
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

		await prisma.notification.createMany({ data: notifications });
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
						deviceId: "test-device-001",
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
						deviceId: "test-device-001",
					})
					.expect(201);

				// When - 동일한 deviceId로 새 토큰 등록 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]",
						deviceId: "test-device-001",
					})
					.expect(201);

				// Then - 토큰 갱신 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.registered).toBe(true);
			});

			it("Accept-Language: en 헤더로 등록하면 UserPreference.locale이 en으로 저장된다", async () => {
				// Given - 인증된 사용자
				const user = await ctx.helpers.createVerifiedUser("notif-locale-en@test.com", password);

				// When - Accept-Language 헤더와 함께 토큰 등록
				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.set("Accept-Language", "en-US,en;q=0.9")
					.send({
						token: "ExponentPushToken[locale-en-xxxxxxxxxxxx]",
						deviceId: "test-device-locale-en",
					})
					.expect(201);

				// Then - UserPreference.locale이 en으로 upsert된다
				const prisma = ctx.testDatabase.getPrisma();
				const preference = await prisma.userPreference.findUnique({
					where: { userId: user.userId },
				});
				expect(preference?.locale).toBe("en");
			});

			it("Accept-Language 미전송(1.3.x 구버전)은 저장된 locale을 덮어쓰지 않는다", async () => {
				// Given - en으로 저장된 사용자 (1.4.0 기기에서 영어 사용 중)
				const user = await ctx.helpers.createVerifiedUser("notif-locale-none@test.com", password);
				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.set("Accept-Language", "en")
					.send({
						token: "ExponentPushToken[locale-none-xxxxxxxxxx]",
						deviceId: "test-device-locale-none",
					})
					.expect(201);

				// When - 구버전 기기가 헤더 없이 토큰 재등록
				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[locale-none-old-device]",
						deviceId: "test-device-locale-none-old",
					})
					.expect(201);

				// Then - en이 ko로 롤백되지 않고 유지된다
				const prisma = ctx.testDatabase.getPrisma();
				const preference = await prisma.userPreference.findUnique({
					where: { userId: user.userId },
				});
				expect(preference?.locale).toBe("en");
			});

			it("미지원 언어(Accept-Language: ja)는 ko로 폴백된다", async () => {
				// Given - 인증된 사용자
				const user = await ctx.helpers.createVerifiedUser("notif-locale-ja@test.com", password);

				// When - 미지원 언어 헤더로 토큰 등록
				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.set("Accept-Language", "ja-JP")
					.send({
						token: "ExponentPushToken[locale-ja-xxxxxxxxxxxx]",
						deviceId: "test-device-locale-ja",
					})
					.expect(201);

				// Then - 화이트리스트 밖 언어는 ko
				const prisma = ctx.testDatabase.getPrisma();
				const preference = await prisma.userPreference.findUnique({
					where: { userId: user.userId },
				});
				expect(preference?.locale).toBe("ko");
			});

			it("언어 변경 후 재등록하면 locale이 갱신된다", async () => {
				// Given - en으로 등록된 사용자
				const user = await ctx.helpers.createVerifiedUser("notif-locale-switch@test.com", password);
				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.set("Accept-Language", "en")
					.send({
						token: "ExponentPushToken[locale-switch-xxxxxxxx]",
						deviceId: "test-device-locale-switch",
					})
					.expect(201);

				// When - 앱 언어를 한국어로 바꾸고 재등록 (모바일의 언어 변경 → 토큰 재등록 흐름)
				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.set("Accept-Language", "ko")
					.send({
						token: "ExponentPushToken[locale-switch-xxxxxxxx]",
						deviceId: "test-device-locale-switch",
					})
					.expect(201);

				// Then - locale이 ko로 갱신된다
				const prisma = ctx.testDatabase.getPrisma();
				const preference = await prisma.userPreference.findUnique({
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
						deviceId: "test-device-002",
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

		describe("DELETE /notifications/token - 푸시 토큰 해제", () => {
			it("특정 deviceId의 토큰을 해제한다", async () => {
				// Given - 토큰이 등록된 deviceId
				const user = await ctx.helpers.createVerifiedUser("notif-del1@test.com", password);

				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[deletetest1111111111]",
						deviceId: "delete-test-device",
					})
					.expect(201);

				// When - 특정 deviceId의 토큰 해제 API 호출
				const response = await request(ctx.app.getHttpServer())
					.delete("/v1/notifications/token")
					.query({ deviceId: "delete-test-device" })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 토큰 해제 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.registered).toBe(false);
			});

			it("모든 토큰을 해제한다 (deviceId 미지정)", async () => {
				// Given - 여러 deviceId에 토큰이 등록된 상태
				const user = await ctx.helpers.createVerifiedUser("notif-del2@test.com", password);

				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[multidevice111111111]",
						deviceId: "multi-device-1",
					})
					.expect(201);

				await request(ctx.app.getHttpServer())
					.post("/v1/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[multidevice222222222]",
						deviceId: "multi-device-2",
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
				const prisma = ctx.testDatabase.getPrisma();
				const notification = await prisma.notification.create({
					data: {
						userId: user.userId,
						type: "TODO_REMINDER",
						title: "열림 기록 테스트",
						body: "본문",
					},
				});

				const first = await request(ctx.app.getHttpServer())
					.post(`/v1/notifications/${notification.id}/opened`)
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);
				const second = await request(ctx.app.getHttpServer())
					.post(`/v1/notifications/${notification.id}/opened`)
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(first.body.data.opened).toBe(true);
				expect(second.body.data.opened).toBe(false);
				const persisted = await prisma.notification.findUniqueOrThrow({
					where: { id: notification.id },
				});
				expect(persisted.openedAt).toBeInstanceOf(Date);
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
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.userConsent.upsert({
				where: { userId: user.userId },
				create: { userId: user.userId, marketingPushAgreedAt: new Date() },
				update: { marketingPushAgreedAt: new Date() },
			});
			const tokenPort = ctx.app.get<MarketingPushOptOutTokenPort>(MARKETING_PUSH_OPT_OUT_TOKEN);

			const response = await request(ctx.app.getHttpServer())
				.post("/v1/notifications/marketing-push/opt-out")
				.send({ token: tokenPort.issue(user.userId) })
				.expect(200);

			expect(response.body.data.optedOut).toBe(true);
			const consent = await prisma.userConsent.findUniqueOrThrow({
				where: { userId: user.userId },
			});
			expect(consent.marketingPushAgreedAt).toBeNull();
		});

		it("잘못된 토큰도 동일한 응답을 반환해 토큰 유효성을 노출하지 않는다", async () => {
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/notifications/marketing-push/opt-out")
				.send({ token: "invalid.token" })
				.expect(200);

			expect(response.body.data.optedOut).toBe(true);
		});
	});
});
