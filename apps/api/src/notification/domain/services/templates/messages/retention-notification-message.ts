import { notificationContentSchema } from "@aido/validators";

import { DEFAULT_LOCALE, type SupportedLocale } from "@/shared/domain/locale";
import { deterministicIndex } from "@/shared/domain/services/deterministic-variant";

import * as en from "../locales/en";
import * as ko from "../locales/ko";
import type {
	NotificationMessage,
	RetentionNotificationCopySelection,
	RetentionTemplateKey,
} from "../notification-copy.types";

const LOCALE_TEMPLATES = { ko, en };

export type RetentionNotificationInput = RetentionNotificationCopySelection & {
	readonly locale?: SupportedLocale;
	readonly selectionContext: {
		readonly recipientId: string;
		readonly occurrenceKey: string;
	};
};

export function createRetentionNotificationMessage(
	input: RetentionNotificationInput,
): NotificationMessage {
	const locale = input.locale ?? DEFAULT_LOCALE;
	const templateKey = retentionTemplateKey(input);
	const template = LOCALE_TEMPLATES[locale].RETENTION_TEMPLATES[templateKey];
	const variants = template.variants;

	const index = deterministicIndex(
		`${templateKey}\u0000${input.selectionContext.recipientId}\u0000${input.selectionContext.occurrenceKey}`,
		variants.length,
	);
	const selectedCopy = notificationContentSchema.parse((variants[index] ?? variants[0])(undefined));

	return {
		...selectedCopy,
		variantId: `${input.copyKey}.v${index + 1}`,
	};
}

function retentionTemplateKey(selection: RetentionNotificationCopySelection): RetentionTemplateKey {
	switch (selection.stage) {
		case "D0":
			return "D0:d0_no_todo";
		case "D1":
			return selection.copyKey === "d1_no_todo" ? "D1:d1_no_todo" : "D1:d1_has_todo_no_completion";
		case "D3":
			return "D3:d3_restart";
		case "D7":
			return selection.copyKey === "d7_has_progress" ? "D7:d7_has_progress" : "D7:d7_restart";
	}
}
