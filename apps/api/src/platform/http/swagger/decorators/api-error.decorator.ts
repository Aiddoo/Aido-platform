import { ErrorCode, type ErrorCodeType, Errors } from "@aido/api/errors";
import { HttpStatus } from "@nestjs/common";
import { DECORATORS } from "@nestjs/swagger";

import type { ApiErrorResponseOptions } from "../interfaces/swagger.interface.js";

interface DocumentedError {
  readonly code: ErrorCodeType;
  readonly message: string;
}

/** examples는 문서 스냅샷에 그대로 남으므로 생성 시각 대신 고정 epoch을 쓴다. */
const EXAMPLE_TIMESTAMP = 1_700_000_000_000;

/** 핸들러별·상태별로 문서화한 오류. 데코레이터 순서와 상관없이 한 상태의 코드를 모두 모은다. */
const documentedErrors = new WeakMap<object, Map<number, DocumentedError[]>>();

function messageOf(errorCode: ErrorCodeType, fallback: string): string {
  return Errors[errorCode]?.message ?? fallback;
}

function createErrorSchema(errors: readonly [DocumentedError, ...DocumentedError[]]) {
  const [first] = errors;
  const code =
    errors.length === 1
      ? { type: "string", example: first.code }
      : { type: "string", example: first.code, enum: errors.map((error) => error.code) };

  return {
    type: "object",
    properties: {
      success: { type: "boolean", example: false },
      error: {
        type: "object",
        properties: {
          code,
          message: { type: "string", example: first.message },
          details: { type: "object", nullable: true, example: null },
        },
        required: ["code", "message"],
      },
      timestamp: { type: "number", example: Date.now() },
    },
    required: ["success", "error", "timestamp"],
  };
}

function createErrorResponse(errors: readonly [DocumentedError, ...DocumentedError[]]) {
  const [first] = errors;
  if (errors.length === 1) {
    return { description: first.message, schema: createErrorSchema(errors) };
  }

  return {
    description: errors.map((error) => `${error.code}: ${error.message}`).join("\n\n"),
    schema: createErrorSchema(errors),
    examples: Object.fromEntries(
      errors.map((error) => [
        error.code,
        {
          summary: error.message,
          value: {
            success: false,
            error: { code: error.code, message: error.message, details: null },
            timestamp: EXAMPLE_TIMESTAMP,
          },
        },
      ]),
    ),
  };
}

/**
 * 상태별 오류 코드를 모아 그 상태의 응답 하나로 다시 쓴다.
 *
 * Swagger의 ApiResponse는 같은 상태를 `{ ...이전, ...나중 }`으로 합쳐 schema는 마지막 것만,
 * 설명은 이어 붙여 남긴다. 그래서 응답을 합치지 않고 지금까지 모은 코드 전체로 교체한다.
 * 코드가 하나면 `error.code` example, 둘 이상이면 enum과 코드별 examples로 선언한다.
 */
export function documentErrors(
  status: HttpStatus,
  errors: readonly DocumentedError[],
): MethodDecorator {
  return (_target, _key, descriptor) => {
    const handler: unknown = descriptor.value;
    if (typeof handler !== "function") {
      return descriptor;
    }

    const byStatus = documentedErrors.get(handler) ?? new Map<number, DocumentedError[]>();
    const previous = byStatus.get(status) ?? [];
    const merged = [
      ...previous,
      ...errors.filter((error) => !previous.some((known) => known.code === error.code)),
    ];
    byStatus.set(status, merged);
    documentedErrors.set(handler, byStatus);

    const [first, ...rest] = merged;
    if (first == null) {
      return descriptor;
    }
    const responses: unknown = Reflect.getMetadata(DECORATORS.API_RESPONSE, handler);
    Reflect.defineMetadata(
      DECORATORS.API_RESPONSE,
      {
        ...(typeof responses === "object" && responses != null ? responses : {}),
        [status]: createErrorResponse([first, ...rest]),
      },
      handler,
    );
    return descriptor;
  };
}

function documentErrorCode(
  status: HttpStatus,
  errorCode: ErrorCodeType,
  fallback: string,
  description?: string,
): MethodDecorator {
  return documentErrors(status, [
    { code: errorCode, message: description ?? messageOf(errorCode, fallback) },
  ]);
}

/**
 * 에러 응답 데코레이터
 *
 * 기존 ERROR_CODE, ERROR_MESSAGE, ERROR_HTTP_STATUS 상수를 재사용하여
 * Swagger 에러 응답 문서를 생성합니다.
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiErrorResponse({ errorCode: 'USER_NOT_FOUND' })
 * findById(@Param('id') id: number) { ... }
 * ```
 */
export function ApiErrorResponse(options: ApiErrorResponseOptions): MethodDecorator {
  const { errorCode, description } = options;
  const status = Errors[errorCode]?.httpStatus ?? HttpStatus.BAD_REQUEST;

  return documentErrorCode(status, errorCode, "Unknown error", description);
}

/**
 * 404 Not Found 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiNotFoundError('USER_NOT_FOUND')
 * findById(@Param('id') id: number) { ... }
 * ```
 */
export function ApiNotFoundError(errorCode: ErrorCodeType): MethodDecorator {
  return documentErrorCode(HttpStatus.NOT_FOUND, errorCode, "Not found");
}

/**
 * 401 Unauthorized 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @ApiUnauthorizedError(ErrorCode.AUTH_0107)
 * getProfile() { ... }
 * ```
 */
export function ApiUnauthorizedError(errorCode?: ErrorCodeType): MethodDecorator {
  return documentErrorCode(
    HttpStatus.UNAUTHORIZED,
    errorCode ?? ErrorCode.AUTH_0107,
    "인증이 필요합니다.",
  );
}

/**
 * 403 Forbidden 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Delete(':id')
 * @ApiForbiddenError(ErrorCode.AUTH_0108)
 * delete(@Param('id') id: number) { ... }
 * ```
 */
export function ApiForbiddenError(errorCode: ErrorCodeType): MethodDecorator {
  return documentErrorCode(HttpStatus.FORBIDDEN, errorCode, "접근 권한이 없습니다.");
}

/**
 * 409 Conflict 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post()
 * @ApiConflictError('EMAIL_ALREADY_EXISTS')
 * create(@Body() dto: CreateUserDto) { ... }
 * ```
 */
export function ApiConflictError(errorCode: ErrorCodeType): MethodDecorator {
  return documentErrorCode(HttpStatus.CONFLICT, errorCode, "Conflict");
}

/**
 * 422 Unprocessable Entity 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post('verify')
 * @ApiUnprocessableError('VERIFICATION_CODE_EXPIRED')
 * verify(@Body() dto: VerifyDto) { ... }
 * ```
 */
export function ApiUnprocessableError(errorCode: ErrorCodeType): MethodDecorator {
  return documentErrorCode(HttpStatus.UNPROCESSABLE_ENTITY, errorCode, "Unprocessable");
}

/**
 * 400 Bad Request 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post(':userId')
 * @ApiBadRequestError('CANNOT_FOLLOW_SELF')
 * sendRequest(@Param('userId') userId: string) { ... }
 * ```
 */
export function ApiBadRequestError(errorCode: ErrorCodeType): MethodDecorator {
  return documentErrorCode(HttpStatus.BAD_REQUEST, errorCode, "Bad request");
}

/**
 * 503 Service Unavailable 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post('parse')
 * @ApiServiceUnavailableError('AI_SERVICE_UNAVAILABLE')
 * parse(@Body() dto: ParseDto) { ... }
 * ```
 */
export function ApiServiceUnavailableError(errorCode: ErrorCodeType): MethodDecorator {
  return documentErrorCode(HttpStatus.SERVICE_UNAVAILABLE, errorCode, "Service unavailable");
}

/**
 * 429 Too Many Requests 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Post('parse')
 * @ApiTooManyRequestsError('AI_USAGE_LIMIT_EXCEEDED')
 * parse(@Body() dto: ParseDto) { ... }
 * ```
 */
export function ApiTooManyRequestsError(
  errorCode: ErrorCodeType,
  description?: string,
): MethodDecorator {
  return documentErrorCode(
    HttpStatus.TOO_MANY_REQUESTS,
    errorCode,
    "Too many requests",
    description,
  );
}

/**
 * 410 Gone 에러 데코레이터
 *
 * @example
 * ```typescript
 * @Get(':code')
 * @ApiGoneError(ErrorCode.INVITE_2102)
 * preview(@Param() params: InviteCodeParamDto) { ... }
 * ```
 */
export function ApiGoneError(errorCode: ErrorCodeType): MethodDecorator {
  return documentErrorCode(HttpStatus.GONE, errorCode, "Gone");
}

/**
 * 한 HTTP 상태에 오류 코드가 둘 이상일 때 쓰는 데코레이터
 *
 * 같은 상태의 단일 코드 데코레이터를 겹쳐 써도 코드가 모이지만, 한 줄로 읽히도록 함께 선언한다.
 *
 * @example
 * ```typescript
 * @Post(':code/redeem')
 * @ApiErrorCodesResponse(HttpStatus.FORBIDDEN, [ErrorCode.INVITE_2105, ErrorCode.INVITE_2106])
 * redeem(@Param() params: InviteCodeParamDto) { ... }
 * ```
 */
export function ApiErrorCodesResponse(
  status: HttpStatus,
  errorCodes: readonly [ErrorCodeType, ErrorCodeType, ...ErrorCodeType[]],
): MethodDecorator {
  return documentErrors(
    status,
    errorCodes.map((errorCode) => ({ code: errorCode, message: messageOf(errorCode, errorCode) })),
  );
}
