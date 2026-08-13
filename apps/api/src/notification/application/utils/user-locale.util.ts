import type { SupportedLocale } from "@/shared/domain/locale";
/**
 * 로케일별로 메시지를 1회만 조립하는 캐시.
 * (한 실행에서 같은 로케일 수신자들은 동일 variant를 받는 기존 동작 보존)
 */
export function createLocaleMessageCache(
	build: (locale: SupportedLocale) => { title: string; body: string },
): (locale: SupportedLocale) => { title: string; body: string } {
	const cache = new Map<SupportedLocale, { title: string; body: string }>();
	return (locale) => {
		let message = cache.get(locale);
		if (!message) {
			message = build(locale);
			cache.set(locale, message);
		}
		return message;
	};
}
