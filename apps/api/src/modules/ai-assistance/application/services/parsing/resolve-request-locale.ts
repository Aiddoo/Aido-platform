import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  UserLocalePreference,
  UserLocalePreferenceReaderPort,
} from "../../ports/parsing/user-locale-preference.reader.port.js";

export interface RequestedLocale {
  readonly timezone: string | undefined;
  readonly locale: SupportedLocale | undefined;
}

/**
 * 헤더 값을 우선하고, 빠진 값만 저장된 사용자 설정으로 채운다.
 * 구 클라이언트가 X-Timezone을 빠뜨려도 KST 사용자의 "내일"이 UTC로 계산되지 않게 한다.
 */
export async function resolveRequestLocale(
  reader: Pick<UserLocalePreferenceReaderPort, "read">,
  userId: string,
  requested: RequestedLocale,
): Promise<UserLocalePreference> {
  const { timezone, locale } = requested;
  if (timezone != null && locale != null) return { timezone, locale };
  const stored = await reader.read(userId);
  return { timezone: timezone ?? stored.timezone, locale: locale ?? stored.locale };
}
