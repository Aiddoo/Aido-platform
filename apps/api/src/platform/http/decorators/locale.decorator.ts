import type { SupportedLocale } from "@aido/api/vocabulary";
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { HttpRequest } from "../http-request.js";
import { resolveResponseLocale } from "../request-client/request-client.js";
import { readRequestClient } from "../request-client/request-client.store.js";

/**
 * 요청이 고른 앱 언어(RequestClient.locale). 보내지 않은 요청은 null이라 저장된 locale을 덮어쓰지 않는다.
 * 지원하지 않는 언어는 X-App-Version 없음·1.4.0 미만만 "ko", 그 밖은 "en"이다.
 */
export const Locale = createParamDecorator<undefined, SupportedLocale | null>(
  () => readRequestClient().locale,
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
