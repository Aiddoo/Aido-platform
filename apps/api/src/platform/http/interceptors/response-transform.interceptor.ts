import type { SuccessResponse } from "@aido/api";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { isRawResponse } from "../decorators/index.js";

export function toSuccessResponse<T>(data: T): SuccessResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

/**
 * 응답 변환 인터셉터
 * 모든 성공 응답을 일관된 형식으로 래핑
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, T | SuccessResponse<T>> {
  readonly #reflector: Reflector;

  constructor(reflector: Reflector) {
    this.#reflector = reflector;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<T | SuccessResponse<T>> {
    if (isRawResponse(this.#reflector, context)) {
      return next.handle();
    }

    return next.handle().pipe(map((data: T) => toSuccessResponse(data)));
  }
}
