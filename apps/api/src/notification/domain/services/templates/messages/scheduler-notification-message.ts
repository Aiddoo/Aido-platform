import { DEFAULT_LOCALE, type SupportedLocale } from "@/shared/domain/locale";

import * as en from "../locales/en";
import * as ko from "../locales/ko";
import {
	createNotificationLabelPreview,
	renderLocalizedNotification,
} from "../notification-copy.renderer";
import type { NotificationMessage, NotificationVariantContext } from "../notification-copy.types";

const LOCALE_TEMPLATES = { ko, en };

interface LocalizedVariantInput {
	readonly locale?: SupportedLocale;
	readonly variantContext?: NotificationVariantContext;
}

export interface TodoReminderNotificationInput extends LocalizedVariantInput {
	readonly todoTitle: string;
	readonly stage: "60min" | "10min" | "immediate";
}

export interface MorningReminderNotificationInput extends LocalizedVariantInput {
	readonly count: number;
}

export interface EveningReminderNotificationInput extends LocalizedVariantInput {
	readonly completed: number;
	readonly total: number;
	readonly streak?: number;
	readonly isStreakAtRisk?: boolean;
}

export interface WeeklyAchievementNotificationInput extends LocalizedVariantInput {
	readonly completedCount: number;
	readonly totalCount: number;
}

export type SocialDigestNotificationInput = LocalizedVariantInput &
	(
		| { readonly kind: "single"; readonly friendName: string }
		| { readonly kind: "multiple"; readonly completedFriendCount: number }
	);

export interface StreakAtRiskNotificationInput extends LocalizedVariantInput {
	readonly streak: number;
}

export interface NudgeSuggestionNotificationInput extends LocalizedVariantInput {
	readonly friendName: string;
}

export function createTodoReminderNotificationMessage({
	todoTitle,
	stage,
	locale = DEFAULT_LOCALE,
	variantContext,
}: TodoReminderNotificationInput): NotificationMessage {
	const templates = LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES;
	const template =
		stage === "10min"
			? templates.TODO_REMINDER_10MIN
			: stage === "immediate"
				? templates.TODO_REMINDER_IMMEDIATE
				: templates.TODO_REMINDER_60MIN;

	return renderLocalizedNotification({
		template,
		variables: { todoTitle: createNotificationLabelPreview({ label: todoTitle, locale }) },
		variantContext,
	});
}

export function createMorningNoTodoNotificationMessage({
	locale = DEFAULT_LOCALE,
	variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES.MORNING_NO_TODO,
		variables: undefined,
		variantContext,
		templateKey: "morning.no_todo",
	});
}

export function createMorningReminderNotificationMessage({
	count,
	locale = DEFAULT_LOCALE,
	variantContext,
}: MorningReminderNotificationInput): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES.MORNING_REMINDER,
		variables: { count },
		variantContext,
		templateKey: "morning.has_todo",
	});
}

export function createEveningReminderNotificationMessage({
	completed,
	total,
	streak = 0,
	isStreakAtRisk = false,
	locale = DEFAULT_LOCALE,
	variantContext,
}: EveningReminderNotificationInput): NotificationMessage {
	const templates = LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES;
	if (completed === total && total > 0) {
		if (streak >= 30) {
			return renderLocalizedNotification({
				template: templates.EVENING_STREAK_30,
				variables: { streak },
				variantContext,
				templateKey: "evening.streak_30",
			});
		}
		if (streak === 14) {
			return renderLocalizedNotification({
				template: templates.EVENING_STREAK_14,
				variables: undefined,
				variantContext,
				templateKey: "evening.streak_14",
			});
		}
		if (streak === 7) {
			return renderLocalizedNotification({
				template: templates.EVENING_STREAK_7,
				variables: undefined,
				variantContext,
				templateKey: "evening.streak_7",
			});
		}
		if (streak >= 2) {
			return renderLocalizedNotification({
				template: templates.EVENING_STREAK,
				variables: { streak, next: streak + 1 },
				variantContext,
				templateKey: "evening.streak",
			});
		}
		return renderLocalizedNotification({
			template: templates.EVENING_COMPLETE,
			variables: undefined,
			variantContext,
			templateKey: "evening.complete",
		});
	}

	if (completed > 0) {
		const remaining = total - completed;
		if (isStreakAtRisk && streak >= 2) {
			return renderLocalizedNotification({
				template: templates.EVENING_STREAK_RISK_PARTIAL,
				variables: { streak, remaining },
				variantContext,
				templateKey: "evening.streak_risk_partial",
			});
		}
		return renderLocalizedNotification({
			template: templates.EVENING_PARTIAL,
			variables: { remaining },
			variantContext,
			templateKey: "evening.partial",
		});
	}

	if (isStreakAtRisk && streak >= 2) {
		return renderLocalizedNotification({
			template: templates.EVENING_STREAK_RISK_NONE,
			variables: { streak },
			variantContext,
			templateKey: "evening.streak_risk_none",
		});
	}

	return renderLocalizedNotification({
		template: templates.EVENING_NONE,
		variables: undefined,
		variantContext,
		templateKey: "evening.none",
	});
}

export function createWeeklyAchievementNotificationMessage({
	completedCount,
	totalCount,
	locale = DEFAULT_LOCALE,
	variantContext,
}: WeeklyAchievementNotificationInput): NotificationMessage {
	const templates = LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES;
	const rate = Math.round((completedCount / totalCount) * 100);
	if (rate === 100) {
		return renderLocalizedNotification({
			template: templates.WEEKLY_ACHIEVEMENT_PERFECT,
			variables: undefined,
			variantContext,
			templateKey: "weekly_achievement.perfect",
		});
	}
	if (rate >= 90) {
		return renderLocalizedNotification({
			template: templates.WEEKLY_ACHIEVEMENT_ALMOST,
			variables: { rate },
			variantContext,
			templateKey: "weekly_achievement.almost",
		});
	}
	return renderLocalizedNotification({
		template: templates.WEEKLY_ACHIEVEMENT,
		variables: { completedCount },
		variantContext,
		templateKey: "weekly_achievement.standard",
	});
}

export function createSocialDigestNotificationMessage(
	input: SocialDigestNotificationInput,
): NotificationMessage {
	const locale = input.locale ?? DEFAULT_LOCALE;
	const templates = LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES;
	if (input.kind === "single") {
		return renderLocalizedNotification({
			template: templates.SOCIAL_DIGEST_SINGLE,
			variables: { friendName: input.friendName },
			variantContext: input.variantContext,
			templateKey: "social_digest.single",
		});
	}
	return renderLocalizedNotification({
		template: templates.SOCIAL_DIGEST_MULTI,
		variables: { completedFriendCount: input.completedFriendCount },
		variantContext: input.variantContext,
		templateKey: "social_digest.multi",
	});
}

export function createLunchNudgeNotificationMessage({
	locale = DEFAULT_LOCALE,
	variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES.LUNCH_NUDGE,
		variables: undefined,
		variantContext,
	});
}

export function createStreakAtRiskNotificationMessage({
	streak,
	locale = DEFAULT_LOCALE,
	variantContext,
}: StreakAtRiskNotificationInput): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES.STREAK_AT_RISK,
		variables: { streak },
		variantContext,
	});
}

export function createNudgeSuggestionNotificationMessage({
	friendName,
	locale = DEFAULT_LOCALE,
	variantContext,
}: NudgeSuggestionNotificationInput): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.NUDGE_SUGGEST,
		variables: { friendName },
		variantContext,
	});
}
