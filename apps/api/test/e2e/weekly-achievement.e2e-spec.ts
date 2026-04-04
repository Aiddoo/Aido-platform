/**
 * Weekly Achievement E2E 테스트
 *
 * @description
 * 주간 달성 현황 API 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 주간 달성 목록 조회 (GET /weekly-achievements)
 * 2. 특정 주 달성 상세 조회 (GET /weekly-achievements/:year/:week)
 *
 * 실행 명령:
 * pnpm --filter @aido/api test:e2e -- weekly-achievement.e2e-spec
 */

import request from "supertest";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
	type VerifiedUser,
} from "./helpers";

describe("Weekly Achievement (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("주간 달성 현황 조회", () => {
		const userEmail = "weekly-achievement@example.com";
		const password = "Test1234!";

		let user: VerifiedUser;

		beforeAll(async () => {
			user = await ctx.helpers.createVerifiedUser(userEmail, password);
		});

		describe("GET /weekly-achievements - 주간 달성 목록 조회", () => {
			it("연도별 주간 달성 목록을 조회한다", async () => {
				// Given - 인증된 사용자

				// When - 주간 달성 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/weekly-achievements")
					.query({ year: 2026 })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 목록 응답 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data).toHaveProperty("items");
				expect(response.body.data.items).toBeInstanceOf(Array);
			});

			it("size 파라미터로 조회 개수를 제한한다", async () => {
				// Given - 인증된 사용자

				// When - size를 5로 설정하여 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/weekly-achievements")
					.query({ year: 2026, size: 5 })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - size 적용 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.items.length).toBeLessThanOrEqual(5);
			});

			it("year 파라미터 없이 요청 시 400 에러 반환", async () => {
				// Given - year 미지정

				// When - year 없이 요청
				const response = await request(ctx.app.getHttpServer())
					.get("/weekly-achievements")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(400);

				// Then - 유효성 검증 에러 검증
				expect(response.body.success).toBe(false);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 요청
				await request(ctx.app.getHttpServer())
					.get("/weekly-achievements")
					.query({ year: 2026 })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /weekly-achievements/:year/:week - 특정 주 달성 상세 조회", () => {
			it("데이터가 없는 주를 조회하면 404 에러 반환", async () => {
				// Given - 달성 데이터가 없는 사용자

				// When - 존재하지 않는 주 달성 상세 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/weekly-achievements/2026/1")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(404);

				// Then - Not Found 에러 검증
				expect(response.body.success).toBe(false);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 요청
				await request(ctx.app.getHttpServer())
					.get("/weekly-achievements/2026/1")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});
});
