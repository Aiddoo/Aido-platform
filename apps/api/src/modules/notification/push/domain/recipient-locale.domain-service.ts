import { resolveSupportedLocale, type SupportedLocale } from "@aido/api/vocabulary";

// 저장된 앱 언어 → 마지막 요청 언어 → 둘 다 없으면 ko(언어를 보고하지 않던 옛 앱), 지원하지 않는 언어는 앱처럼 en이다
export function resolveRecipientLocale(params: {
  readonly storedLocale: string | null;
  readonly lastRequestLocale: string | null;
}): SupportedLocale {
  const reported = [params.storedLocale, params.lastRequestLocale].find(
    (locale) => locale != null && locale.trim().length > 0,
  );
  return resolveSupportedLocale(reported);
}
