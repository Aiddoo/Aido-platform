import type { SupportedLocale } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserLocalePreferenceReaderPort } from "./ports/user-locale-preference.reader.port.js";
import type { UserLocalePreferenceReadModel } from "./read-models/user-locale-preference.read-model.js";

export interface RequestedLocale {
  readonly timezone: string | undefined;
  /** 요청이 고른 언어(Accept-Language). null이면 보내지 않은 요청이라 저장된 언어를 쓴다 */
  readonly requestedLocale: SupportedLocale | null;
}

/**
 * 헤더 값을 우선하고, 빠진 값만 저장된 사용자 설정으로 채운다.
 * 구 클라이언트가 X-Timezone을 빠뜨려도 KST 사용자의 "내일"이 UTC로 계산되지 않게 한다.
 */
export async function resolveRequestLocale(
  reader: Pick<UserLocalePreferenceReaderPort, "read">,
  userId: UserId,
  requested: RequestedLocale,
): Promise<UserLocalePreferenceReadModel> {
  const { timezone, requestedLocale } = requested;
  if (timezone != null && requestedLocale != null) {
    return { timezone, locale: requestedLocale };
  }
  const stored = await reader.read(userId);
  return { timezone: timezone ?? stored.timezone, locale: requestedLocale ?? stored.locale };
}
