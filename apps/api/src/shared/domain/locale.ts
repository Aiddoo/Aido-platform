export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ko";

/** 영속 데이터와 비동기 payload의 locale을 하위 호환 기본값으로 정규화한다. */
export function toSupportedLocale(value: unknown): SupportedLocale {
	const supportedLocale = SUPPORTED_LOCALES.find((locale) => locale === value);
	return supportedLocale ?? DEFAULT_LOCALE;
}
