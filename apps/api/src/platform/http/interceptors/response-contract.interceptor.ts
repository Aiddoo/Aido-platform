import {
  type CallHandler,
  type ExecutionContext,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { DECORATORS } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { z } from "zod";

import { HttpLogEvent, httpRequestPath } from "#api/platform/logging/http-log";

import { isRawResponse } from "../decorators/index.js";
import { toSuccessResponse } from "./response-transform.interceptor.js";

class ResponseContractViolationError extends Error {
  override readonly name = "ResponseContractViolationError";
}

function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/** `@ApiSuccessResponse`·`@ApiCreatedResponse`가 Swagger에 등록한 상태별 Zod schema */
function declaredSuccessSchemas(declared: unknown): ReadonlyMap<number, z.ZodType> {
  const schemas = new Map<number, z.ZodType>();
  if (typeof declared !== "object" || declared == null) {
    return schemas;
  }
  for (const [status, value] of Object.entries(declared)) {
    const response: unknown = value;
    const statusCode = Number(status);
    if (
      isSuccessStatus(statusCode) &&
      typeof response === "object" &&
      response != null &&
      "standardSchema" in response &&
      response.standardSchema instanceof z.ZodType
    ) {
      schemas.set(statusCode, response.standardSchema);
    }
  }
  return schemas;
}

// Express가 res.json으로 보내는 값(Date → 문자열, undefined 필드 제거)을 검증한다
function toSentJson(body: unknown): unknown {
  // nullish-strict: null은 JSON null로 보내고, undefined만 JSON.stringify가 문자열을 만들지 않는다
  return body === undefined ? undefined : JSON.parse(JSON.stringify(body));
}

/**
 * 성공 응답 body를 route가 Swagger에 선언한 Zod schema로 parse하고, 다르면 500으로 실패시킨다.
 * 운영에서는 등록하지 않는다(configureApplication). 응답 값은 바꾸지 않는다.
 */
export class ResponseContractInterceptor implements NestInterceptor {
  readonly #reflector: Reflector;
  readonly #logger = new Logger(ResponseContractInterceptor.name);
  readonly #schemasByHandler = new WeakMap<object, ReadonlyMap<number, z.ZodType>>();

  constructor(reflector: Reflector) {
    this.#reflector = reflector;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    return next.handle().pipe(
      map((body: unknown) => {
        this.#verify(context, body);
        return body;
      }),
    );
  }

  #verify(context: ExecutionContext, body: unknown): void {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    const { statusCode } = response;
    const schemas = this.#schemasOf(context.getHandler());
    // @Res()로 직접 보낸 응답과 Swagger에 Zod schema가 없는 route는 비교할 대상이 없다
    if (response.headersSent || schemas.size === 0 || !isSuccessStatus(statusCode)) {
      return;
    }

    const schema = schemas.get(statusCode);
    const sent = isRawResponse(this.#reflector, context) ? body : toSuccessResponse(body);
    const result = schema?.safeParse(toSentJson(sent));
    if (result?.success === true) {
      return;
    }

    const request = http.getRequest<Request>();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const declaredStatuses = [...schemas.keys()];
    this.#logger.error({
      event: HttpLogEvent.RESPONSE_CONTRACT_VIOLATED,
      handler,
      method: request.method,
      path: httpRequestPath(request.url),
      statusCode,
      declaredStatuses,
      issues: result?.error.issues ?? [],
    });
    const reason =
      result == null
        ? `선언한 성공 상태 ${declaredStatuses.join(", ")}가 아닌 ${statusCode}로 응답했다`
        : z.prettifyError(result.error);
    throw new ResponseContractViolationError(`${handler} 응답이 선언한 schema와 다르다\n${reason}`);
  }

  #schemasOf(handler: object): ReadonlyMap<number, z.ZodType> {
    const cached = this.#schemasByHandler.get(handler);
    if (cached != null) {
      return cached;
    }
    const schemas = declaredSuccessSchemas(Reflect.getMetadata(DECORATORS.API_RESPONSE, handler));
    this.#schemasByHandler.set(handler, schemas);
    return schemas;
  }
}
