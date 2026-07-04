/**
 * OpenAPI 계약 스냅샷 테스트
 *
 * @description
 * 전체 앱의 OpenAPI 문서를 스냅샷으로 고정해 클라이언트 계약(라우트, 요청/응답 스키마)이
 * 의도치 않게 변하지 않음을 보증합니다. 클린아키텍처 리팩터링(웨이브 1~5) 동안
 * "클라이언트 영향 0" 불변 조건의 자동 검증 장치입니다.
 *
 * 의도된 계약 변경 시에만 `jest --config ./test/jest-e2e.json -u`로 스냅샷을 갱신하고,
 * PR 리뷰에서 스냅샷 diff를 계약 변경으로 취급합니다.
 */

import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
} from "./helpers/e2e-app-factory";

/**
 * 문서 생성 시점의 Date.now()가 example로 박히는 필드(timestamp 등)를
 * 고정 값으로 치환해 스냅샷을 결정적으로 만든다.
 */
function normalizeVolatileExamples<T>(doc: T): T {
	return JSON.parse(
		JSON.stringify(doc, (key, value) => {
			const isEpochMillisExample =
				key === "example" &&
				typeof value === "number" &&
				value > 1_000_000_000_000;
			if (isEpochMillisExample) {
				return 1_700_000_000_000;
			}
			return value;
		}),
	);
}

describe("OpenAPI 계약 (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	it("OpenAPI 문서가 스냅샷과 일치한다 (클라이언트 계약 무변경)", () => {
		// Given - main.ts와 동일한 기본 문서 설정 (paths/schemas는 컨트롤러에서 파생)
		const config = new DocumentBuilder()
			.setTitle("Aido API")
			.setVersion("1.0.0")
			.build();

		// When
		const document = normalizeVolatileExamples(
			cleanupOpenApiDoc(SwaggerModule.createDocument(ctx.app, config)),
		);

		// Then - 라우트/스키마 전체가 기준 스냅샷과 동일해야 한다
		expect(document.paths).toMatchSnapshot("openapi-paths");
		expect(document.components).toMatchSnapshot("openapi-components");
	});
});
