/**
 * OpenAPI 계약 스냅샷 테스트
 *
 * @description
 * 전체 앱의 OpenAPI 문서를 스냅샷으로 고정해 클라이언트 계약(라우트, 요청/응답 스키마)이
 * 의도치 않게 변하지 않음을 보증하는 상시 계약 게이트입니다(CI e2e에서 실행).
 * 모든 서버 변경에 대해 "클라이언트 영향 0"을 기계적으로 증명하는 장치입니다.
 *
 * 의도된 계약 변경 시에만 `pnpm --filter @aido/server test:e2e openapi-contract --update`로 스냅샷을 갱신하고,
 * PR 리뷰에서 스냅샷 diff를 계약 변경으로 취급합니다.
 */

import { createHash } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { z } from "zod";

import { convertStandardSchema } from "#api/platform/http/swagger/standard-schema.converter";

import { RELEASED_V1_OPENAPI_CONTRACT } from "./fixtures/released-v1-openapi-contract.js";
import { RELEASED_V1_8_2_OPENAPI_CONTRACT } from "./fixtures/released-v1.8.2-openapi-contract.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/e2e-app-factory.js";

const RELEASED_OPENAPI_CONTRACTS = [
  RELEASED_V1_OPENAPI_CONTRACT,
  RELEASED_V1_8_2_OPENAPI_CONTRACT,
] as const;

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
        key === "example" && typeof value === "number" && value > 1_000_000_000_000;
      if (isEpochMillisExample) {
        return 1_700_000_000_000;
      }
      return value;
    }),
  );
}

function stableContract(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableContract(item));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const isJsonSchemaPropertiesMap = parentKey === "properties";
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => isJsonSchemaPropertiesMap || !DOCUMENTATION_ONLY_FIELDS.has(key))
      .sort()
      .map((key) => [key, stableContract(record[key], key)]),
  );
}

function contractFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableContract(value)))
    .digest("hex");
}

const errorResponseCodeSchema = z.object({
  content: z.object({
    "application/json": z.object({
      schema: z.object({
        properties: z.object({
          error: z.object({
            properties: z.object({
              code: z.object({ enum: z.array(z.string()).optional(), example: z.string() }),
            }),
          }),
        }),
      }),
    }),
  }),
});

/** 응답에 선언된 오류 코드 목록. 단일 코드 응답은 example 하나, 여러 코드 응답은 enum 전체다. */
function declaredErrorCodes(response: unknown): string[] {
  const { schema } = errorResponseCodeSchema.parse(response).content["application/json"];
  const code = schema.properties.error.properties.code;
  return code.enum ?? [code.example];
}

function selectReleasedContract(
  source: Record<string, unknown>,
  releasedNames: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    releasedNames.filter((name) => name in source).map((name) => [name, source[name]]),
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

  it("JSON Schema의 title·description 사용자 필드 변경을 fingerprint에 반영한다", () => {
    // Given - OpenAPI 문서 메타데이터와 이름이 같은 실제 JSON Schema 필드
    const releasedSchema = {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 200 },
        description: { type: "string", nullable: true },
      },
      required: ["title", "description"],
    };
    const breakingSchema = {
      type: "object",
      properties: {
        title: { type: "number" },
        description: { type: "boolean" },
      },
      required: ["title", "description"],
    };

    // When
    const releasedFingerprint = contractFingerprint(releasedSchema);
    const breakingFingerprint = contractFingerprint(breakingSchema);

    // Then - 필드 shape 변경을 문서 문구 변경으로 오인해 누락하면 안 된다
    expect(breakingFingerprint).not.toBe(releasedFingerprint);
  });

  it("OpenAPI 문서가 스냅샷과 일치한다 (클라이언트 계약 무변경)", () => {
    // Given - main.ts와 동일한 기본 문서 설정 (paths/schemas는 컨트롤러에서 파생)
    const config = new DocumentBuilder().setTitle("Aido API").setVersion("1.0.0").build();

    // When
    const document = normalizeVolatileExamples(
      SwaggerModule.createDocument(ctx.app, config, {
        standardSchemaConverter: convertStandardSchema,
      }),
    );

    // Then - 라우트/스키마 전체가 기준 스냅샷과 동일해야 한다
    expect(document.paths).toMatchSnapshot("openapi-paths");
    expect(document.components).toMatchSnapshot("openapi-components");
  });

  it("친구 초대 API는 operationId·인증·오류 상태를 문서에 선언한다", () => {
    // Given
    const config = new DocumentBuilder().setTitle("Aido API").setVersion("1.0.0").build();
    const document = SwaggerModule.createDocument(ctx.app, config, {
      standardSchemaConverter: convertStandardSchema,
    });

    // When
    const operations = {
      availability: document.paths["/v1/invites/availability"]?.get,
      myInvite: document.paths["/v1/invites/me"]?.get,
      rotate: document.paths["/v1/invites/me/rotate"]?.post,
      invitees: document.paths["/v1/invites/me/invitees"]?.get,
      preview: document.paths["/v1/invites/{code}"]?.get,
      redeem: document.paths["/v1/invites/{code}/redeem"]?.post,
    };

    // Then
    expect(Object.values(operations).map((operation) => operation?.operationId)).toEqual([
      "getInviteAvailability",
      "getMyInvite",
      "rotateInviteCode",
      "getInvitedFriends",
      "getInvitePreview",
      "redeemInvite",
    ]);
    expect(operations.preview?.security).toBeUndefined();
    expect(operations.myInvite?.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(operations.preview?.responses ?? {})).toEqual(
      expect.arrayContaining(["200", "403", "404", "410", "429"]),
    );
    expect(Object.keys(operations.preview?.responses ?? {})).not.toContain("401");
    expect(Object.keys(operations.rotate?.responses ?? {})).toEqual(
      expect.arrayContaining(["200", "401", "403", "429"]),
    );
    expect(Object.keys(operations.redeem?.responses ?? {})).toEqual(
      expect.arrayContaining(["200", "400", "401", "403", "404", "409", "410", "429"]),
    );
  });

  it("같은 상태 코드로 나가는 오류 코드를 모두 문서에 선언한다", () => {
    // Given
    const config = new DocumentBuilder().setTitle("Aido API").setVersion("1.0.0").build();
    const document = SwaggerModule.createDocument(ctx.app, config, {
      standardSchemaConverter: convertStandardSchema,
    });
    const redeemResponses = document.paths["/v1/invites/{code}/redeem"]?.post?.responses ?? {};
    const parseTodoResponses = document.paths["/v1/ai/parse-todo"]?.post?.responses ?? {};
    const parseMemoResponses = document.paths["/v1/ai/parse-memo"]?.post?.responses ?? {};
    const linkResponses = document.paths["/v1/auth/link"]?.post?.responses ?? {};
    const deleteCategoryResponses =
      document.paths["/v1/todo-categories/{id}"]?.delete?.responses ?? {};

    // When
    const declared = {
      redeem: {
        400: declaredErrorCodes(redeemResponses["400"]),
        403: declaredErrorCodes(redeemResponses["403"]),
        404: declaredErrorCodes(redeemResponses["404"]),
        409: declaredErrorCodes(redeemResponses["409"]),
        410: declaredErrorCodes(redeemResponses["410"]),
      },
      parseTodo: { 429: declaredErrorCodes(parseTodoResponses["429"]) },
      parseMemo: { 429: declaredErrorCodes(parseMemoResponses["429"]) },
      linkSocialAccount: { 409: declaredErrorCodes(linkResponses["409"]) },
      deleteTodoCategory: { 400: declaredErrorCodes(deleteCategoryResponses["400"]) },
    };

    // Then - 한 상태에 하나만 남기던 데코레이터 중첩으로 코드가 빠지면 안 된다
    expect(declared).toEqual({
      redeem: {
        400: [ErrorCode.INVITE_2103, ErrorCode.SYS_0002],
        403: [ErrorCode.INVITE_2105, ErrorCode.INVITE_2106],
        404: [ErrorCode.INVITE_2101, ErrorCode.USER_0601],
        409: [ErrorCode.INVITE_2104],
        410: [ErrorCode.INVITE_2102],
      },
      parseTodo: { 429: [ErrorCode.AI_1303, ErrorCode.AI_1310] },
      parseMemo: { 429: [ErrorCode.AI_1303, ErrorCode.AI_1310] },
      linkSocialAccount: {
        409: [
          ErrorCode.KAKAO_0306,
          ErrorCode.APPLE_0355,
          ErrorCode.GOOGLE_0405,
          ErrorCode.NAVER_0455,
        ],
      },
      deleteTodoCategory: {
        400: [ErrorCode.TODO_CATEGORY_0854, ErrorCode.TODO_CATEGORY_0855, ErrorCode.SYS_0002],
      },
    });
  });

  it("오류 응답 schema는 content 안에만 둔다 (공통 응답이 선언한 응답을 덮지 않는다)", () => {
    // Given
    const config = new DocumentBuilder().setTitle("Aido API").setVersion("1.0.0").build();
    const document = SwaggerModule.createDocument(ctx.app, config, {
      standardSchemaConverter: convertStandardSchema,
    });

    // When - content 밖 response.schema로 떠 있는 응답
    const strayResponses = Object.entries(document.paths).flatMap(([route, pathItem]) =>
      Object.entries(pathItem).flatMap(([method, operation]) =>
        Object.entries(
          z.object({ responses: z.record(z.string(), z.unknown()) }).safeParse(operation).data
            ?.responses ?? {},
        )
          .filter(([, response]) => z.object({ schema: z.unknown() }).safeParse(response).success)
          .map(([status]) => `${method.toUpperCase()} ${route} ${status}`),
      ),
    );

    // Then
    expect(strayResponses).toEqual([]);
  });

  it.each(RELEASED_OPENAPI_CONTRACTS)(
    "스토어 배포된 $releasedClientVersion 클라이언트의 요청·응답·상태 코드 계약을 보존한다",
    (releasedContract) => {
      // Given - 운영과 같은 /v1 prefix가 적용된 현재 OpenAPI 계약
      const config = new DocumentBuilder().setTitle("Aido API").setVersion("1.0.0").build();
      const document = SwaggerModule.createDocument(ctx.app, config, {
        standardSchemaConverter: convertStandardSchema,
      });
      const currentSchemas = (document.components?.schemas ?? {}) as Record<string, unknown>;
      const currentPaths = Object.fromEntries(
        Object.entries(document.paths).map(([route, contract]) => [
          route === "/health" ? route : route.replace(/^\/v1/, ""),
          contract,
        ]),
      );

      // When - 배포 클라이언트가 알고 있는 surface만 선택 (새 API 추가는 허용)
      const missingSchemas = releasedContract.schemaNames.filter(
        (name) => !(name in currentSchemas),
      );
      const missingPaths = releasedContract.pathNames.filter((route) => !(route in currentPaths));
      const releasedSchemas = selectReleasedContract(currentSchemas, releasedContract.schemaNames);
      const releasedPaths = selectReleasedContract(currentPaths, releasedContract.pathNames);

      // Then - 문구 변경은 무시하되 Zod shape/request/response/status 구조는 동일
      expect({
        releasedClientVersion: releasedContract.releasedClientVersion,
        sourceCommit: releasedContract.sourceCommit,
        missingSchemas,
        missingPaths,
        schemasFingerprint: contractFingerprint(releasedSchemas),
        pathsFingerprint: contractFingerprint(releasedPaths),
      }).toEqual({
        releasedClientVersion: releasedContract.releasedClientVersion,
        sourceCommit: releasedContract.sourceCommit,
        missingSchemas: [],
        missingPaths: [],
        schemasFingerprint: releasedContract.schemasFingerprint,
        pathsFingerprint: releasedContract.pathsFingerprint,
      });
    },
  );
});
