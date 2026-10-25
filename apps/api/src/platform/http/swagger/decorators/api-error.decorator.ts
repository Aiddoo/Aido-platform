import { type ErrorCodeType, Errors } from "@aido/api/errors";
import { applyDecorators, HttpStatus } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";

import type { ApiErrorResponseOptions } from "../interfaces/swagger.interface.js";

/**
 * 에러 응답 스키마 생성 (에러 코드, 메시지 포함)
 */
function createErrorSchema(
  errorCode: ErrorCodeType,
  message: string,
  codeSchema: { type: "string"; example: ErrorCodeType; enum?: ErrorCodeType[] } = {
    type: "string",
    example: errorCode,
  },
) {
  return {
    type: "object",
    properties: {
      success: { type: "boolean", example: false },
      error: {
        type: "object",
        properties: {
          code: codeSchema,
          message: { type: "string", example: message },
          details: { type: "object", nullable: true, example: null },
        },
        required: ["code", "message"],
      },
      timestamp: { type: "number", example: Date.now() },
    },
    required: ["success", "error", "timestamp"],
  };
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

  const errorDef = Errors[errorCode];
  const httpStatus = errorDef?.httpStatus ?? HttpStatus.BAD_REQUEST;
  const message = description ?? errorDef?.message ?? "Unknown error";

  return applyDecorators(
    ApiResponse({
      status: httpStatus,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
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
  const message = Errors[errorCode]?.message ?? "Not found";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
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
  const code = errorCode ?? ("AUTH_0107" as ErrorCodeType);
  const message = Errors[code]?.message ?? "인증이 필요합니다.";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: message,
      schema: createErrorSchema(code, message),
    }),
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
  const message = Errors[errorCode]?.message ?? "접근 권한이 없습니다.";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
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
  const message = Errors[errorCode]?.message ?? "Conflict";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
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
  const message = Errors[errorCode]?.message ?? "Unprocessable";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
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
  const message = Errors[errorCode]?.message ?? "Bad request";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
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
  const message = Errors[errorCode]?.message ?? "Service unavailable";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
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
  const message = description ?? Errors[errorCode]?.message ?? "Too many requests";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
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
  const message = Errors[errorCode]?.message ?? "Gone";

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.GONE,
      description: message,
      schema: createErrorSchema(errorCode, message),
    }),
  );
}

/** examples는 문서 스냅샷에 그대로 남으므로 생성 시각 대신 고정 epoch을 쓴다. */
const EXAMPLE_TIMESTAMP = 1_700_000_000_000;

/**
 * 한 HTTP 상태에 오류 코드가 둘 이상일 때 쓰는 데코레이터
 *
 * Swagger는 상태 코드마다 응답을 하나만 남기므로 같은 상태의 단일 코드 데코레이터를
 * 겹쳐 쓰면 마지막 것만 문서에 남습니다. 이 데코레이터는 `error.code`를 enum으로,
 * 코드별 메시지를 examples로 한 응답에 함께 선언합니다.
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
  const [firstCode] = errorCodes;
  const messageOf = (errorCode: ErrorCodeType) => Errors[errorCode]?.message ?? errorCode;

  return applyDecorators(
    ApiResponse({
      status,
      description: errorCodes
        .map((errorCode) => `${errorCode}: ${messageOf(errorCode)}`)
        .join("\n\n"),
      schema: createErrorSchema(firstCode, messageOf(firstCode), {
        type: "string",
        example: firstCode,
        enum: [...errorCodes],
      }),
      examples: Object.fromEntries(
        errorCodes.map((errorCode) => [
          errorCode,
          {
            summary: messageOf(errorCode),
            value: {
              success: false,
              error: { code: errorCode, message: messageOf(errorCode), details: null },
              timestamp: EXAMPLE_TIMESTAMP,
            },
          },
        ]),
      ),
    }),
  );
}
