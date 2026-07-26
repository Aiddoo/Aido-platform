/**
 * App E2E 테스트
 *
 * @description
 * 애플리케이션 기본 엔드포인트 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("앱 컨트롤러 E2E", () => {
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

	it("/ (GET)", () => {
		// Given - 애플리케이션이 초기화된 상태

		// When - 루트 경로 GET 요청
		return request(ctx.app.getHttpServer())
			.get("/")
			.expect(200)
			.expect((res) => {
				// Then - 응답 검증
				// ResponseTransformInterceptor가 적용되어 래핑된 응답 확인
				expect(res.body).toMatchObject({
					success: true,
					data: "Hello World!",
				});
				expect(res.body.timestamp).toBeDefined();
			});
	});

	it("CORS preflight가 X-Timezone 요청 헤더를 허용한다", async () => {
		// When - 웹 클라이언트가 timezone 헤더를 포함한 preflight를 보내면
		const response = await request(ctx.app.getHttpServer())
			.options("/")
			.set("Origin", "http://localhost:3000")
			.set("Access-Control-Request-Method", "GET")
			.set("Access-Control-Request-Headers", "x-timezone")
			.expect(204);

		// Then - 브라우저가 실제 인증 요청을 보낼 수 있도록 명시적으로 허용한다
		const allowedHeaders = String(
			response.headers["access-control-allow-headers"],
		)
			.toLowerCase()
			.split(",")
			.map((header) => header.trim());
		expect(allowedHeaders).toContain("x-timezone");
	});
});
