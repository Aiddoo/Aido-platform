import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

import { readRouteTemplate } from "#api/platform/http/request-route";
import { readRequestUserId } from "#api/platform/http/request-user-id";

import { tagRequestRoute } from "./sentry-scope.js";

/** guard가 사용자를 정한 뒤 경로 템플릿·메서드·사용자 ID를 요청 scope에 싣는다. 응답은 건드리지 않는다. */
@Injectable()
export class RequestScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === "http") {
      const request = context.switchToHttp().getRequest<Request>();
      tagRequestRoute({
        method: request.method,
        route: readRouteTemplate(request),
        userId: readRequestUserId(request) ?? null,
      });
    }
    return next.handle();
  }
}
