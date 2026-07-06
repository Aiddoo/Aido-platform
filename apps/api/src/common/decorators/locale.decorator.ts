import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ko";

/**
 * Accept-Language 헤더에서 지원 로케일을 추출한다.
 * - 화이트리스트(ko/en) 외 값·미전송(구버전 클라이언트)은 전부 "ko" — 기존 동작 보존
 * - "en-US,en;q=0.9" 같은 표준 형식은 첫 항목의 language 서브태그만 사용
 */
export function parseAcceptLanguage(header: unknown): SupportedLocale {
	if (typeof header !== "string" || header.length === 0) {
		return DEFAULT_LOCALE;
	}

	const primary = header.split(",")[0]?.trim().toLowerCase();
	if (!primary) {
		return DEFAULT_LOCALE;
	}

	const language = primary.split(";")[0]?.split("-")[0];
	const matched = SUPPORTED_LOCALES.find((locale) => locale === language);
	return matched ?? DEFAULT_LOCALE;
}

export const Locale = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): SupportedLocale => {
		const request = ctx.switchToHttp().getRequest();
		return parseAcceptLanguage(request.headers["accept-language"]);
	},
);
