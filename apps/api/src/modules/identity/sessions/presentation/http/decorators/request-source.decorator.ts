import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { HttpRequest } from "#api/platform/http/http-request";
import type { RequestClient } from "#api/platform/http/request-client/request-client";
import { readRequestClient } from "#api/platform/http/request-client/request-client.store";

/**
 * 감사·관리자 알림에 남길 요청 출처. `ip`는 어댑터가 trust proxy로 계산해 IP 요청 한도와 같은 기준이라
 * 인증 코드 메일 상한을 나눠 세는 데도 쓴다. 나머지는 클라이언트가 보낸 값이라 표시에만 쓴다.
 */
export interface RequestSource {
  readonly ip: string | undefined;
  readonly userAgent: string | undefined;
  readonly acceptLanguage: string | undefined;
  readonly client: RequestClient;
}

/** `@CurrentRequestSource() source: RequestSource` — 요청 IP·User-Agent·Accept-Language와 앱 헤더 */
export const CurrentRequestSource = createParamDecorator<undefined, RequestSource>(
  (_data, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    return {
      ip: request.ip || undefined,
      userAgent: request.headers["user-agent"],
      acceptLanguage: request.headers["accept-language"],
      client: readRequestClient(),
    };
  },
);
