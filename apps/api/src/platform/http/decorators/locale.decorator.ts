import type { SupportedLocale } from "@aido/api/vocabulary";
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { HttpRequest } from "../http-request.js";
import { resolveResponseLocale } from "../request-client/request-client.js";
import { readRequestClient } from "../request-client/request-client.store.js";

/**
 * Accept-Language의 지원 로케일. 보내지 않은 요청은 undefined라 저장된 locale을
 * 덮어쓰지 않고, 지원하지 않는 언어는 "ko"다.
 */
export const Locale = createParamDecorator<undefined, SupportedLocale | undefined>(
  () => readRequestClient().locale ?? undefined,
);

/**
 * 응답 문구와 같은 언어(resolveResponseLocale). 보내지 않으면 "ko", 지원하지 않는 언어는 "en"이다.
 * 요청에 답해 보내는 메일(인증 코드)도 이 언어로 쓴다.
 */
export const ResponseLocale = createParamDecorator<undefined, SupportedLocale>(
  (_data, context: ExecutionContext) =>
    resolveResponseLocale(
      context.switchToHttp().getRequest<HttpRequest>().headers["accept-language"],
    ),
);
