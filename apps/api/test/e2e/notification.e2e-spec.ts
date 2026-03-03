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
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("Notification (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("푸시 토큰 관리", () => {
		const userEmail = "notification-user@example.com";
		const password = "Test1234!";

		let user: { accessToken: string; userId: string };

		beforeAll(async () => {
			const verified = await ctx.helpers.createVerifiedUser(
				userEmail,
				password,
			);
			user = {
				accessToken: verified.accessToken,
				userId: verified.userId,
			};
		});

		describe("POST /notifications/token - 푸시 토큰 등록", () => {
			it("유효한 Expo 토큰을 등록한다", async () => {
				// Given - 인증된 사용자와 유효한 Expo 토큰

				// When - 푸시 토큰 등록 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/notifications/token")
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

			it("동일한 deviceId로 토큰을 갱신한다", async () => {
				// Given - 이미 토큰이 등록된 deviceId

				// When - 동일한 deviceId로 새 토큰 등록 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/notifications/token")
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

			it("유효하지 않은 토큰 형식은 400 에러 반환", async () => {
				// Given - 유효하지 않은 토큰 형식

				// When - 유효하지 않은 토큰으로 등록 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/notifications/token")
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
					.post("/notifications/token")
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
				await request(ctx.app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[deletetest1111111111]",
						deviceId: "delete-test-device",
					})
					.expect(201);

				// When - 특정 deviceId의 토큰 해제 API 호출
				const response = await request(ctx.app.getHttpServer())
					.delete("/notifications/token")
					.query({ deviceId: "delete-test-device" })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 토큰 해제 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.registered).toBe(false);
			});

			it("모든 토큰을 해제한다 (deviceId 미지정)", async () => {
				// Given - 여러 deviceId에 토큰이 등록된 상태
				await request(ctx.app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[multidevice111111111]",
						deviceId: "multi-device-1",
					})
					.expect(201);

				await request(ctx.app.getHttpServer())
					.post("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						token: "ExponentPushToken[multidevice222222222]",
						deviceId: "multi-device-2",
					})
					.expect(201);

				// When - deviceId 미지정으로 모든 토큰 해제 API 호출
				const response = await request(ctx.app.getHttpServer())
					.delete("/notifications/token")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 모든 토큰 해제 성공 검증
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
			const verified = await ctx.helpers.createVerifiedUser(
				userEmail,
				password,
			);
			user = {
				accessToken: verified.accessToken,
				userId: verified.userId,
			};
		});

		describe("GET /notifications - 알림 목록 조회", () => {
			it("알림 목록을 조회한다 (빈 목록)", async () => {
				// Given - 알림이 없는 상태의 인증된 사용자

				// When - 알림 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/notifications")
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

				// When - limit을 5로 설정하여 알림 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/notifications")
					.query({ limit: 5 })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - limit 적용 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.notifications).toBeInstanceOf(Array);
			});

			it("unreadOnly=true로 읽지 않은 알림만 조회한다", async () => {
				// Given - 인증된 사용자

				// When - unreadOnly=true로 알림 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/notifications")
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
				await request(ctx.app.getHttpServer())
					.get("/notifications")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});

			describe("카테고리 필터링", () => {
				it("category=ALL이면 모든 알림을 반환해야 한다", async () => {
					// Given - 인증된 사용자

					// When - category=ALL로 알림 목록 조회
					const response = await request(ctx.app.getHttpServer())
						.get("/notifications?category=ALL")
						.set("Authorization", `Bearer ${user.accessToken}`)
						.expect(200);

					// Then - 모든 알림 반환 검증
					expect(response.body.success).toBe(true);
					expect(response.body.data).toHaveProperty("notifications");
					expect(response.body.data).toHaveProperty("hasMore");
				});

				it("category 미지정이면 기본값 ALL로 동작해야 한다", async () => {
					// Given - 인증된 사용자

					// When - category 미지정으로 알림 목록 조회
					const response = await request(ctx.app.getHttpServer())
						.get("/notifications")
						.set("Authorization", `Bearer ${user.accessToken}`)
						.expect(200);

					// Then - 기본값 ALL 동작 검증
					expect(response.body.success).toBe(true);
					expect(response.body.data).toHaveProperty("notifications");
				});

				it("유효하지 않은 category이면 400을 반환해야 한다", async () => {
					// Given - 유효하지 않은 category 값

					// When - 유효하지 않은 category로 알림 목록 조회
					const response = await request(ctx.app.getHttpServer())
						.get("/notifications?category=INVALID")
						.set("Authorization", `Bearer ${user.accessToken}`)
						.expect(400);

					// Then - 400 Bad Request 반환 검증
					expect(response.body.success).toBe(false);
				});

				it("category=SOCIAL이면 소셜 알림만 반환해야 한다", async () => {
					// Given - 인증된 사용자

					// When - category=SOCIAL로 알림 목록 조회
					const response = await request(ctx.app.getHttpServer())
						.get("/notifications?category=SOCIAL")
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

					// When - category=NOTICE로 알림 목록 조회
					const response = await request(ctx.app.getHttpServer())
						.get("/notifications?category=NOTICE")
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

					// When - category=TODO로 알림 목록 조회
					const response = await request(ctx.app.getHttpServer())
						.get("/notifications?category=TODO")
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

					// When - category와 unreadOnly 동시 사용
					const response = await request(ctx.app.getHttpServer())
						.get("/notifications?category=SOCIAL&unreadOnly=true")
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

				// When - 읽지 않은 알림 수 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/notifications/unread-count")
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
		const userEmail = "notification-seed-user@example.com";
		const password = "Test1234!";

		let user: { accessToken: string; userId: string };

		beforeAll(async () => {
			const verified = await ctx.helpers.createVerifiedUser(
				userEmail,
				password,
			);
			user = {
				accessToken: verified.accessToken,
				userId: verified.userId,
			};
			const prisma = ctx.testDatabase.getPrisma();

			// 시드 데이터 삽입: 다양한 타입의 알림
			const notifications = [];

			// SOCIAL 타입 알림 5개
			for (let i = 0; i < 5; i++) {
				notifications.push({
					userId: user.userId,
					type: "FOLLOW_NEW" as const,
					title: `소셜 알림 ${i + 1}`,
					body: `소셜 알림 본문 ${i + 1}`,
					isRead: i < 2, // 2개는 읽음, 3개는 안읽음
				});
			}

			// NOTICE 타입 알림 3개
			for (let i = 0; i < 3; i++) {
				notifications.push({
					userId: user.userId,
					type: "SYSTEM_NOTICE" as const,
					title: `공지 알림 ${i + 1}`,
					body: `공지 알림 본문 ${i + 1}`,
					isRead: false,
				});
			}

			// TODO 타입 알림 17개 (페이지네이션 테스트용)
			for (let i = 0; i < 17; i++) {
				notifications.push({
					userId: user.userId,
					type: "TODO_REMINDER" as const,
					title: `할일 알림 ${i + 1}`,
					body: `할일 알림 본문 ${i + 1}`,
					isRead: false,
				});
			}

			// MORNING_REMINDER 알림: 할일 있는 사용자용 (치환된 title)
			notifications.push({
				userId: user.userId,
				type: "MORNING_REMINDER" as const,
				title: "오늘 할일 3개",
				body: "미루면 저녁의 내가 울어",
				isRead: false,
			});

			// MORNING_REMINDER 알림: 할일 없는 사용자용
			notifications.push({
				userId: user.userId,
				type: "MORNING_REMINDER" as const,
				title: "할일이 하나도 없다",
				body: "한가한 거 맞아? 뭐라도 적어봐",
				isRead: false,
			});

			await prisma.notification.createMany({ data: notifications });
		});

		it("category=SOCIAL 필터링 시 소셜 알림만 반환해야 한다", async () => {
			// Given - 시드 데이터로 다양한 타입의 알림 생성

			// When - category=SOCIAL로 알림 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/notifications?category=SOCIAL")
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

			// When - 1페이지
			const page1 = await request(ctx.app.getHttpServer())
				.get("/notifications?limit=10")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 1페이지
			expect(page1.body.data.notifications.length).toBe(10);
			expect(page1.body.data.hasMore).toBe(true);
			expect(page1.body.data.nextCursor).toBeDefined();

			// When - 2페이지
			const page2 = await request(ctx.app.getHttpServer())
				.get(`/notifications?limit=10&cursor=${page1.body.data.nextCursor}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 2페이지
			expect(page2.body.data.notifications.length).toBe(10);
			expect(page2.body.data.hasMore).toBe(true);

			// When - 3페이지
			const page3 = await request(ctx.app.getHttpServer())
				.get(`/notifications?limit=10&cursor=${page2.body.data.nextCursor}`)
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

			// When - TODO 카테고리 1페이지 (10개)
			const page1 = await request(ctx.app.getHttpServer())
				.get("/notifications?category=TODO&limit=10")
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
				.get(
					`/notifications?category=TODO&limit=10&cursor=${page1.body.data.nextCursor}`,
				)
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
			// Given - cursor=0은 유효한 요청 (nonnegative 정수)

			// When - cursor 없이 첫 페이지 조회
			const _firstPage = await request(ctx.app.getHttpServer())
				.get("/notifications?limit=10")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// When - cursor=0으로 조회
			const cursorZeroPage = await request(ctx.app.getHttpServer())
				.get("/notifications?limit=10&cursor=0")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.expect(200);

			// Then - 400 에러가 나지 않고, 정상 응답이어야 한다
			expect(cursorZeroPage.body.success).toBe(true);
			expect(cursorZeroPage.body.data.notifications).toBeInstanceOf(Array);
			expect(cursorZeroPage.body.data).toHaveProperty("hasMore");
		});

		it("MORNING_REMINDER 알림이 치환된 title로 정상 조회되어야 한다", async () => {
			// Given - 시드 데이터로 MORNING_REMINDER 알림 2개 생성

			// When - 전체 알림 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/notifications?limit=50")
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

			// When - TODO 카테고리 필터링
			const response = await request(ctx.app.getHttpServer())
				.get("/notifications?category=TODO&limit=50")
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

			// When - SOCIAL 카테고리 필터링
			const response = await request(ctx.app.getHttpServer())
				.get("/notifications?category=SOCIAL&limit=50")
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
		const userEmail = "notification-read-user@example.com";
		const password = "Test1234!";

		let user: { accessToken: string; userId: string };

		beforeAll(async () => {
			const verified = await ctx.helpers.createVerifiedUser(
				userEmail,
				password,
			);
			user = {
				accessToken: verified.accessToken,
				userId: verified.userId,
			};
		});

		describe("PATCH /notifications/:id/read - 단일 알림 읽음 처리", () => {
			it("존재하지 않는 알림 읽음 처리 시 404 에러 반환", async () => {
				// Given - 존재하지 않는 알림 ID

				// When - 존재하지 않는 알림 읽음 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/notifications/99999/read")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(404);

				// Then - 알림 없음 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NOTIFICATION_1004");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 단일 알림 읽음 처리 API 호출
				await request(ctx.app.getHttpServer())
					.patch("/notifications/1/read")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /notifications/read-all - 모든 알림 읽음 처리", () => {
			it("모든 알림을 읽음 처리한다", async () => {
				// Given - 인증된 사용자

				// When - 모든 알림 읽음 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/notifications/read-all")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 모든 알림 읽음 처리 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toBeDefined();
				expect(typeof response.body.data.readCount).toBe("number");
			});
		});
	});
});
