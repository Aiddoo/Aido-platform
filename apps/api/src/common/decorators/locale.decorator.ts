import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const SUPPORTED_LOCALES = ["ko", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ko";

/**
 * Accept-Language 헤더에서 지원 로케일을 추출한다.
 * - 미전송(1.3.x 구버전 클라이언트) → undefined: 저장된 locale을 덮어쓰지 않는다
 *   (1.4.0에서 en으로 쓰는 유저가 구버전 기기로 토큰을 재등록해도 en이 유지됨)
 * - 화이트리스트(ko/en) 외 언어 → "ko" 폴백
 * - "en-US,en;q=0.9" 같은 표준 형식은 첫 항목의 language 서브태그만 사용
 */
export function parseAcceptLanguage(
	header: unknown,
): SupportedLocale | undefined {
	if (typeof header !== "string" || header.length === 0) {
		return undefined;
	}

	const primary = header.split(",")[0]?.trim().toLowerCase();
	if (!primary) {
		return undefined;
	}

	const language = primary.split(";")[0]?.split("-")[0];
	const matched = SUPPORTED_LOCALES.find((locale) => locale === language);
	return matched ?? DEFAULT_LOCALE;
}

export const Locale = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): SupportedLocale | undefined => {
		const request = ctx.switchToHttp().getRequest();
		return parseAcceptLanguage(request.headers["accept-language"]);
	},
);
