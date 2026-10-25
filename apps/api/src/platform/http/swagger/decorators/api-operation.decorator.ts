import { ErrorCode, Errors } from "@aido/api/errors";
import { applyDecorators, HttpStatus } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants.js";
import { ApiOperation, ApiResponse, type ApiResponseOptions, DECORATORS } from "@nestjs/swagger";

import { SWAGGER_DESCRIPTION } from "../constants/swagger.constant.js";
import type { ApiDocOptions } from "../interfaces/swagger.interface.js";
import { ErrorResponseSchema } from "../schemas/response.schema.js";
import { documentErrors } from "./api-error.decorator.js";

/**
 * 엔드포인트가 같은 상태를 아직 선언하지 않았을 때만 응답을 더한다.
 *
 * Swagger는 같은 상태의 응답을 `{ ...이전, ...나중 }`으로 합친다. ApiDoc은 보통 맨 위에 있어
 * 가장 나중에 적용되므로, 그대로 더하면 공통 400의 `$ref`가 엔드포인트가 선언한 오류 schema를
 * 덮고 그 schema는 content 밖에 떠 버린다.
 */
function ApiResponseIfUndeclared(options: ApiResponseOptions & { status: HttpStatus }) {
  const apply = ApiResponse(options);

  return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    const declared: unknown =
      descriptor.value == null
        ? undefined
        : Reflect.getMetadata(DECORATORS.API_RESPONSE, descriptor.value);
    const isDeclared =
      typeof declared === "object" && declared != null && String(options.status) in declared;
    if (isDeclared) {
      return descriptor;
    }
    return apply(target, key, descriptor);
  };
}

/** `@Body/@Query/@Param({ schema })`처럼 Zod schema로 검증하는 입력이 있는지 */
function hasSchemaValidatedInput(target: object, key: string | symbol): boolean {
  const routeArgs: unknown = Reflect.getMetadata(ROUTE_ARGS_METADATA, target.constructor, key);
  if (typeof routeArgs !== "object" || routeArgs == null) {
    return false;
  }
  return Object.values(routeArgs).some(
    (arg: unknown) =>
      typeof arg === "object" && arg != null && "schema" in arg && arg.schema != null,
  );
}

/**
 * 입력 검증 실패는 전역 StandardSchemaValidationPipe가 400 SYS_0002로 보낸다.
 * 검증하는 입력이 있으면 엔드포인트가 선언한 400 코드에 SYS_0002를 더한다.
 * 파라미터 데코레이터가 메서드 데코레이터보다 먼저 적용되므로 이 시점에 입력 메타데이터가 있다.
 */
function ApiValidationErrorResponse(): MethodDecorator {
  const documentValidationError = documentErrors(HttpStatus.BAD_REQUEST, [
    { code: ErrorCode.SYS_0002, message: Errors[ErrorCode.SYS_0002].message },
  ]);

  return (target, key, descriptor) => {
    if (!hasSchemaValidatedInput(target, key)) {
      return descriptor;
    }
    return documentValidationError(target, key, descriptor);
  };
}

/**
 * API 문서화를 위한 통합 데코레이터
 *
 * 기능:
 * - ApiOperation (summary, description, deprecated) 설정
 * - Zod로 검증하는 입력이 있으면 400에 SYS_0002 추가
 * - 공통 에러 응답 (400, 500) 자동 추가 (옵션)
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiDoc({ summary: 'Todo 상세 조회' })
 * findById(@Param('id') id: number) { ... }
 * ```
 */
export function ApiDoc(options: ApiDocOptions): MethodDecorator {
  const { summary, description, operationId, deprecated, includeCommonErrors = true } = options;

  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [
    ApiOperation({
      summary,
      description,
      operationId,
      deprecated,
    }),
    ApiValidationErrorResponse(),
  ];

  if (includeCommonErrors) {
    decorators.push(
      ApiResponseIfUndeclared({
        status: HttpStatus.BAD_REQUEST,
        description: SWAGGER_DESCRIPTION.BAD_REQUEST_400,
        type: ErrorResponseSchema,
      }),
      ApiResponseIfUndeclared({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: SWAGGER_DESCRIPTION.INTERNAL_ERROR_500,
        type: ErrorResponseSchema,
      }),
    );
  }

  return applyDecorators(...decorators);
}
