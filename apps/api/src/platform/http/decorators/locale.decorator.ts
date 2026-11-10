import { createParamDecorator } from "@nestjs/common";

import type { SupportedLocale } from "#api/shared/domain/locale";

import { readRequestClient } from "../request-client/index.js";

export type { SupportedLocale } from "#api/shared/domain/locale";

/**
 * Accept-Language의 지원 로케일. 보내지 않은 요청(1.3.x 구버전)은 undefined라 저장된 locale을
 * 덮어쓰지 않고, 지원하지 않는 언어는 "ko"다.
 */
export const Locale = createParamDecorator<undefined, SupportedLocale | undefined>(
  () => readRequestClient().locale ?? undefined,
);
