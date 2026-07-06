import type { SupportedLocale } from "@/common/decorators";
import type { DatabaseService } from "@/database/database.service";

import { resolveTemplateLocale } from "./notification-templates";

/** 사용자들의 푸시 언어를 일괄 조회한다 (preference 없으면 ko) */
export async function fetchUserLocales(
	database: DatabaseService,
	userIds: string[],
): Promise<Map<string, SupportedLocale>> {
	if (userIds.length === 0) {
		return new Map();
	}

	const preferences = await database.userPreference.findMany({
		where: { userId: { in: userIds } },
		select: { userId: true, locale: true },
	});

	return new Map(
		preferences.map((preference) => [
			preference.userId,
			resolveTemplateLocale(preference.locale),
		]),
	);
}

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
