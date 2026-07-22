import request from "supertest";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
	restartE2eAppPreservingDatabase,
} from "./helpers";

describe("인증 세션 재시작 내구성 E2E", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	});

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	it("재시작 전 access/refresh token을 재시작 후에도 사용할 수 있다", async () => {
		// Given
		const email = "restart-session@example.com";
		const password = "Test1234!";
		await ctx.helpers.createVerifiedUser(email, password);
		const tokens = await ctx.helpers.loginUser(email, password);

		// When
		ctx = await restartE2eAppPreservingDatabase(ctx);

		// Then
		await request(ctx.app.getHttpServer())
			.get("/auth/me")
			.set("Authorization", `Bearer ${tokens.accessToken}`)
			.expect(200);

		const refreshResponse = await request(ctx.app.getHttpServer())
			.post("/auth/refresh")
			.set("Authorization", `Bearer ${tokens.refreshToken}`)
			.expect(200);
		expect(refreshResponse.body.data.accessToken).toBeDefined();
		expect(refreshResponse.body.data.refreshToken).toBeDefined();
	});
});
