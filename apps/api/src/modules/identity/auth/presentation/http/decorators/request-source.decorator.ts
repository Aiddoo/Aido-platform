import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { RequestClient } from "#api/platform/http/request-client/request-client";
import { readRequestClient } from "#api/platform/http/request-client/request-client.store";

/** 감사·관리자 알림에 남길 요청 출처. 모두 클라이언트가 보낸 값이라 표시에만 쓴다. */
export interface RequestSource {
  readonly ip: string | undefined;
  readonly userAgent: string | undefined;
  readonly acceptLanguage: string | undefined;
  readonly client: RequestClient;
}

/** `@CurrentRequestSource() source: RequestSource` — 요청 IP·User-Agent·Accept-Language와 앱 헤더 */
export const CurrentRequestSource = createParamDecorator<undefined, RequestSource>(
  (_data, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    return {
      ip: request.ip || undefined,
      userAgent: request.headers["user-agent"],
      acceptLanguage: request.headers["accept-language"],
      client: readRequestClient(),
    };
  },
);
