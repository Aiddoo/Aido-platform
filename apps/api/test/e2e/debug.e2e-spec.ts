/**
 * Debug E2E 테스트 - 500 에러 원인 확인용
 *
 * TestDatabase를 사용하여 PostgreSQL 컨테이너를 시작합니다.
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("Debug (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();

		console.log("DATABASE_URL:", process.env.DATABASE_URL);

		// 디버깅: DatabaseService가 어떤 연결을 사용하는지 확인
		const db = ctx.testDatabase.getPrisma();
		console.log("DatabaseService instance type:", db.constructor.name);

		// 디버깅: 다양한 쿼리 테스트
		try {
			const userCount = await db.user.count();
			console.log("User count in test DB:", userCount);

			// findMany 테스트
			const users = await db.user.findMany();
			console.log("findMany result:", users.length);

			// findFirst 테스트 (조건 없음)
			const firstUser = await db.user.findFirst();
			console.log("findFirst (no where):", firstUser);

			// findFirst 테스트 (where 조건)
			const userByEmail = await db.user.findFirst({
				where: { email: "test@example.com" },
			});
			console.log("findFirst (where email):", userByEmail);

			// findFirst 테스트 (where null 조건)
			const activeUser = await db.user.findFirst({
				where: { deletedAt: null },
			});
			console.log("findFirst (where deletedAt null):", activeUser);
		} catch (error) {
			console.error("DB query error:", error);
		}
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	it("POST /auth/register - 에러 응답 확인", async () => {
		// Given - 테스트용 사용자 정보 준비
		const testEmail = "debug-test@example.com";
		const testPassword = "Test1234!";

		// When - 회원가입 API 호출
		const response = await request(ctx.app.getHttpServer())
			.post("/auth/register")
			.send({
				email: testEmail,
				password: testPassword,
				passwordConfirm: testPassword,
				termsAgreed: true,
				privacyAgreed: true,
				marketingAgreed: false,
			});

		// Then - 성공 응답 확인
		console.log("Response status:", response.status);
		console.log("Response body:", JSON.stringify(response.body, null, 2));

		expect(response.status).toBe(201);
	});
});
