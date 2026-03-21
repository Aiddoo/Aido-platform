/**
 * Admin E2E 테스트
 *
 * @description
 * 관리자 알림 API 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 관리자가 브로드캐스트 알림을 발송한다
 * 2. 관리자가 타겟 알림을 발송한다
 * 3. 비관리자가 호출하면 403을 반환한다
 * 4. 인증 없이 호출하면 401을 반환한다
 */

import request from "supertest";
import { DatabaseService } from "@/database/database.service";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
	type VerifiedUser,
} from "./helpers";

describe("Admin (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("관리자 알림 발송", () => {
		const adminEmail = "admin-e2e@example.com";
		const regularEmail = "regular-e2e@example.com";
		const password = "Test1234!";

		let adminUser: VerifiedUser;
		let regularUser: VerifiedUser;

		beforeAll(async () => {
			// 관리자 사용자 생성 후 역할 업데이트
			adminUser = await ctx.helpers.createVerifiedUser(adminEmail, password);
			const database = ctx.module.get(DatabaseService);
			await database.user.update({
				where: { id: adminUser.userId },
				data: { role: "ADMIN" },
			});

			// 일반 사용자 생성
			regularUser = await ctx.helpers.createVerifiedUser(
				regularEmail,
				password,
			);
		});

		describe("POST /admin/notifications/broadcast — 브로드캐스트 알림", () => {
			it("관리자가 브로드캐스트 알림을 발송한다", async () => {
				// Given - 관리자 계정으로 로그인된 상태 (beforeAll에서 생성)

				// When - 브로드캐스트 알림 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/admin/notifications/broadcast")
					.set("Authorization", `Bearer ${adminUser.accessToken}`)
					.send({
						title: "E2E 테스트 알림",
						body: "전체 사용자 알림입니다",
						targetFilter: "ALL",
					})
					.expect(201);

				// Then - 브로드캐스트 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.totalTargets).toBeGreaterThanOrEqual(1);
				expect(response.body.data.successCount).toBeGreaterThanOrEqual(1);
			});

			it("비관리자가 호출하면 403을 반환한다", async () => {
				// Given - 일반 사용자로 로그인된 상태

				// When - 일반 사용자가 브로드캐스트 알림 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/admin/notifications/broadcast")
					.set("Authorization", `Bearer ${regularUser.accessToken}`)
					.send({
						title: "권한 없는 알림",
						body: "이 요청은 실패해야 합니다",
						targetFilter: "ALL",
					})
					.expect(403);

				// Then - 403 Forbidden 검증
				expect(response.body.success).toBe(false);
			});

			it("인증 없이 호출하면 401을 반환한다", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 브로드캐스트 알림 API 호출
				await request(ctx.app.getHttpServer())
					.post("/admin/notifications/broadcast")
					.send({
						title: "인증 없는 알림",
						body: "이 요청은 실패해야 합니다",
						targetFilter: "ALL",
					})
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("POST /admin/notifications/targeted — 타겟 알림", () => {
			it("관리자가 타겟 알림을 발송한다", async () => {
				// Given - 관리자 계정으로 로그인된 상태

				// When - 타겟 알림 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/admin/notifications/targeted")
					.set("Authorization", `Bearer ${adminUser.accessToken}`)
					.send({
						title: "타겟 알림 테스트",
						body: "지정 사용자 알림입니다",
						userIds: [regularUser.userId],
					})
					.expect(201);

				// Then - 타겟 알림 발송 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.totalTargets).toBe(1);
				expect(response.body.data.successCount).toBe(1);
			});
		});
	});
});
