/**
 * App E2E 테스트
 *
 * @description
 * 애플리케이션 기본 엔드포인트 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("AppController (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
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
});
