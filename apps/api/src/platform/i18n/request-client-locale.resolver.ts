import { LocaleResolver, type LocaleResolverInput } from "@nestjs/i18n";

import { resolveResponseLocale } from "#api/platform/http/request-client/request-client";

/**
 * 요청 언어를 RequestClient와 같은 헤더 정규화(resolveResponseLocale)로 정한다.
 * i18n middleware가 CLS middleware보다 먼저 돌 수 있어 CLS 값 대신 같은 규칙으로 헤더를 읽는다.
 */
export class RequestClientLocaleResolver extends LocaleResolver {
  override readonly varyHeaders = ["accept-language"];

  resolve({ headers }: LocaleResolverInput): string {
    return resolveResponseLocale(headers["accept-language"]);
  }
}
