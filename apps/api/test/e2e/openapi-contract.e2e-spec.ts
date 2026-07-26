/**
 * OpenAPI 계약 스냅샷 테스트
 *
 * @description
 * 전체 앱의 OpenAPI 문서를 스냅샷으로 고정해 클라이언트 계약(라우트, 요청/응답 스키마)이
 * 의도치 않게 변하지 않음을 보증하는 상시 계약 게이트입니다(CI e2e에서 실행).
 * 모든 서버 변경에 대해 "클라이언트 영향 0"을 기계적으로 증명하는 장치입니다.
 *
 * 의도된 계약 변경 시에만 `jest --config ./test/jest-e2e.json -u`로 스냅샷을 갱신하고,
 * PR 리뷰에서 스냅샷 diff를 계약 변경으로 취급합니다.
 */

import { createHash } from "node:crypto";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { RELEASED_V1_OPENAPI_CONTRACT } from "./fixtures/released-v1-openapi-contract";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
} from "./helpers/e2e-app-factory";

const DOCUMENTATION_ONLY_FIELDS = new Set([
	"description",
	"example",
	"examples",
	"summary",
	"title",
]);

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

function stableContract(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(stableContract);
	}
	if (value === null || typeof value !== "object") {
		return value;
	}

	const record = value as Record<string, unknown>;
	return Object.fromEntries(
		Object.keys(record)
			.filter((key) => !DOCUMENTATION_ONLY_FIELDS.has(key))
			.sort()
			.map((key) => [key, stableContract(record[key])]),
	);
}

function contractFingerprint(value: unknown): string {
	return createHash("sha256")
		.update(JSON.stringify(stableContract(value)))
		.digest("hex");
}

function selectReleasedContract(
	source: Record<string, unknown>,
	releasedNames: readonly string[],
): Record<string, unknown> {
	return Object.fromEntries(
		releasedNames
			.filter((name) => name in source)
			.map((name) => [name, source[name]]),
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

	beforeEach(async () => {
		await ctx.reset();
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

	it("스토어 배포된 1.7.x 클라이언트의 요청·응답·상태 코드 계약을 보존한다", () => {
		// Given - 운영과 같은 /v1 prefix가 적용된 현재 OpenAPI 계약
		const config = new DocumentBuilder()
			.setTitle("Aido API")
			.setVersion("1.0.0")
			.build();
		const document = cleanupOpenApiDoc(
			SwaggerModule.createDocument(ctx.app, config),
		);
		const currentSchemas = (document.components?.schemas ?? {}) as Record<
			string,
			unknown
		>;
		const currentPaths = Object.fromEntries(
			Object.entries(document.paths).map(([route, contract]) => [
				route === "/health" ? route : route.replace(/^\/v1/, ""),
				contract,
			]),
		);

		// When - 배포 클라이언트가 알고 있는 surface만 선택 (새 API 추가는 허용)
		const missingSchemas = RELEASED_V1_OPENAPI_CONTRACT.schemaNames.filter(
			(name) => !(name in currentSchemas),
		);
		const missingPaths = RELEASED_V1_OPENAPI_CONTRACT.pathNames.filter(
			(route) => !(route in currentPaths),
		);
		const releasedSchemas = selectReleasedContract(
			currentSchemas,
			RELEASED_V1_OPENAPI_CONTRACT.schemaNames,
		);
		const releasedPaths = selectReleasedContract(
			currentPaths,
			RELEASED_V1_OPENAPI_CONTRACT.pathNames,
		);

		// Then - 문구 변경은 무시하되 Zod shape/request/response/status 구조는 동일
		expect({
			releasedClientVersion: RELEASED_V1_OPENAPI_CONTRACT.releasedClientVersion,
			missingSchemas,
			missingPaths,
			schemasFingerprint: contractFingerprint(releasedSchemas),
			pathsFingerprint: contractFingerprint(releasedPaths),
		}).toEqual({
			releasedClientVersion: "1.7.x",
			missingSchemas: [],
			missingPaths: [],
			schemasFingerprint: RELEASED_V1_OPENAPI_CONTRACT.schemasFingerprint,
			pathsFingerprint: RELEASED_V1_OPENAPI_CONTRACT.pathsFingerprint,
		});
	});
});
