import { notificationContentSchema } from "@aido/validators";

import type { SupportedLocale } from "@/shared/domain/locale";
import { deterministicIndex } from "@/shared/domain/services/deterministic-variant";

import type {
	LocalizedNotificationTemplate,
	NotificationMessage,
	NotificationVariantContext,
} from "./notification-copy.types";

const KOREAN_NOTIFICATION_LABEL_MAX_GRAPHEMES = 24;
const ENGLISH_NOTIFICATION_LABEL_MAX_GRAPHEMES = 16;
const ELLIPSIS = "…";

interface NotificationLabelPreviewInput {
	readonly label: string;
	readonly locale: SupportedLocale;
}

/**
 * 잠금 화면에서 읽을 수 있는 동적 라벨 미리보기를 만든다.
 * 결합 문자와 emoji sequence를 쪼개지 않으며 말줄임표까지
 * 한국어 24 grapheme, 영어 16 grapheme으로 제한한다.
 */
export function createNotificationLabelPreview({
	label,
	locale,
}: NotificationLabelPreviewInput): string {
	const normalizedLabel = label.trim();
	const maxGraphemes =
		locale === "en"
			? ENGLISH_NOTIFICATION_LABEL_MAX_GRAPHEMES
			: KOREAN_NOTIFICATION_LABEL_MAX_GRAPHEMES;
	const graphemes = Array.from(
		new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(normalizedLabel),
		({ segment }) => segment,
	);

	if (graphemes.length <= maxGraphemes) {
		return normalizedLabel;
	}

	return `${graphemes.slice(0, maxGraphemes - 1).join("")}${ELLIPSIS}`;
}

interface RenderLocalizedNotificationInput<TVariables> {
	readonly template: LocalizedNotificationTemplate<TVariables>;
	readonly variables: Readonly<TVariables>;
	readonly variantContext?: NotificationVariantContext;
	readonly templateKey?: string;
}

/** 동일한 seed에서 동일한 카피와 분석용 variant ID를 반환한다. */
export function renderLocalizedNotification<TVariables>({
	template,
	variables,
	variantContext,
	templateKey,
}: RenderLocalizedNotificationInput<TVariables>): NotificationMessage {
	const variantNamespace = variantContext
		? templateKey
			? `${variantContext.campaignKey}.${templateKey}`
			: variantContext.campaignKey
		: undefined;

	if (template.variants) {
		const index = variantContext
			? deterministicIndex(
					`${variantNamespace}\u0000${variantContext.recipientId}\u0000${variantContext.occurrenceKey}`,
					template.variants.length,
				)
			: 0;
		const selectedCopy = notificationContentSchema.parse(
			(template.variants[index] ?? template.variants[0])(variables),
		);
		return {
			...selectedCopy,
			variantId: variantNamespace ? `${variantNamespace}.v${index + 1}` : `v${index + 1}`,
		};
	}

	return {
		...notificationContentSchema.parse(template.copy(variables)),
		variantId: variantNamespace ? `${variantNamespace}.default` : "default",
	};
}
