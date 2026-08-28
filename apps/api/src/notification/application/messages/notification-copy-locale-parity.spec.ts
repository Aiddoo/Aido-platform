import { notificationContentSchema } from "@aido/validators";

import * as en from "./locales/en";
import * as ko from "./locales/ko";
import type {
	LocalizedNotificationTemplate,
	NotificationCopy,
	RetentionNotificationCopyCatalog,
	SchedulerNotificationCopyCatalog,
	SocialNotificationCopyCatalog,
	SystemNotificationCopyCatalog,
	WeatherFallbackCopyCatalog,
	WeatherNotificationCopyCatalog,
} from "./notification-copy.types";

interface LocaleCatalog {
	readonly SCHEDULER_TEMPLATES: SchedulerNotificationCopyCatalog;
	readonly WEATHER_TEMPLATES: WeatherNotificationCopyCatalog;
	readonly SOCIAL_TEMPLATES: SocialNotificationCopyCatalog;
	readonly SYSTEM_TEMPLATES: SystemNotificationCopyCatalog;
	readonly RETENTION_TEMPLATES: RetentionNotificationCopyCatalog;
	readonly WEATHER_FALLBACK: WeatherFallbackCopyCatalog;
}

const KO_CATALOG: LocaleCatalog = ko;
const EN_CATALOG: LocaleCatalog = en;
const CATALOG_GROUPS: readonly (keyof LocaleCatalog)[] = [
	"SCHEDULER_TEMPLATES",
	"WEATHER_TEMPLATES",
	"SOCIAL_TEMPLATES",
	"SYSTEM_TEMPLATES",
	"RETENTION_TEMPLATES",
	"WEATHER_FALLBACK",
];

function render<TVariables>(
	template: LocalizedNotificationTemplate<TVariables>,
	variables: Readonly<TVariables>,
): NotificationCopy[] {
	if (template.variants) {
		return template.variants.map((factory) => factory(variables));
	}
	return [template.copy(variables)];
}

function renderCatalog(catalog: LocaleCatalog): NotificationCopy[] {
	const scheduler = catalog.SCHEDULER_TEMPLATES;
	const weather = catalog.WEATHER_TEMPLATES;
	const social = catalog.SOCIAL_TEMPLATES;
	const system = catalog.SYSTEM_TEMPLATES;
	const retention = catalog.RETENTION_TEMPLATES;
	const fallback = catalog.WEATHER_FALLBACK;
	const longName = "가".repeat(20);
	const todoTitle = "할".repeat(24);
	const userMessage = "메".repeat(200);

	return [
		...render(scheduler.TODO_REMINDER_60MIN, { todoTitle }),
		...render(scheduler.TODO_REMINDER_10MIN, { todoTitle }),
		...render(scheduler.TODO_REMINDER_IMMEDIATE, { todoTitle }),
		...render(scheduler.MORNING_REMINDER, { count: 999 }),
		...render(scheduler.EVENING_COMPLETE, undefined),
		...render(scheduler.EVENING_PARTIAL, { remaining: 999 }),
		...render(scheduler.EVENING_NONE, undefined),
		...render(scheduler.MORNING_NO_TODO, undefined),
		...render(scheduler.EVENING_STREAK, { streak: 999, next: 1000 }),
		...render(scheduler.EVENING_STREAK_7, undefined),
		...render(scheduler.EVENING_STREAK_14, undefined),
		...render(scheduler.EVENING_STREAK_30, { streak: 999 }),
		...render(scheduler.EVENING_STREAK_RISK_PARTIAL, { streak: 999, remaining: 999 }),
		...render(scheduler.EVENING_STREAK_RISK_NONE, { streak: 999 }),
		...render(scheduler.LUNCH_NUDGE, undefined),
		...render(scheduler.STREAK_AT_RISK, { streak: 999 }),
		...render(weather.MORNING_CLEAR, { skyLabel: "Partly cloudy", tempMin: -99, tempMax: 99 }),
		...render(weather.MORNING_RAIN, { precipProb: 100, tempMin: -99, tempMax: 99 }),
		...render(weather.MORNING_SNOW, { precipProb: 100, tempMin: -99, tempMax: 99 }),
		...render(weather.EVENING_CLEAR, { skyLabel: "Partly cloudy", tempMin: -99, tempMax: 99 }),
		...render(weather.EVENING_RAIN, { precipProb: 100, tempMin: -99, tempMax: 99 }),
		...render(weather.EVENING_SNOW, { precipProb: 100, tempMin: -99, tempMax: 99 }),
		...render(social.FOLLOW_NEW, { senderName: longName }),
		...render(social.FOLLOW_ACCEPTED, { senderName: longName }),
		...render(social.NUDGE_RECEIVED, { senderName: longName, todoTitle }),
		...render(social.NUDGE_RECEIVED_WITH_MESSAGE, {
			senderName: longName,
			todoTitle,
			message: userMessage,
		}),
		...render(social.REMIND_NUDGE_RECEIVED, { senderName: longName }),
		...render(social.REMIND_NUDGE_RECEIVED_WITH_MESSAGE, {
			senderName: longName,
			message: userMessage,
		}),
		...render(social.CHEER_RECEIVED, { senderName: longName, message: userMessage }),
		...render(social.CHEER_RECEIVED_NO_MESSAGE, { senderName: longName }),
		...render(social.FRIEND_COMPLETED, { friendName: longName }),
		...render(social.SOCIAL_DIGEST_MULTI, { completedFriendCount: 999 }),
		...render(social.SOCIAL_DIGEST_SINGLE, { friendName: longName }),
		...render(social.NUDGE_SUGGEST, { friendName: longName }),
		...render(social.TODO_COMMENT, { senderName: longName }),
		...render(social.TODO_COMMENT_CHAIN, { senderName: longName, count: 999 }),
		...render(social.TODO_COMMENT_REPLY, { senderName: longName }),
		...render(social.TODO_COMMENT_REPLY_CHAIN, { senderName: longName, count: 999 }),
		...render(social.TODO_COMMENT_LIKE, { senderName: longName }),
		...render(system.WINBACK_DAY3, undefined),
		...render(system.WINBACK_DAY7, undefined),
		...render(system.WINBACK_DAY14, undefined),
		...render(system.WINBACK_DAY21, undefined),
		...render(system.WINBACK_DAY30, undefined),
		...render(system.WEEKLY_ACHIEVEMENT, { completedCount: 99999 }),
		...render(system.WEEKLY_ACHIEVEMENT_PERFECT, undefined),
		...render(system.WEEKLY_ACHIEVEMENT_ALMOST, { rate: 99 }),
		...render(system.WEEKLY_REPORT, undefined),
		...render(system.MONTHLY_REPORT, undefined),
		...render(system.AI_SUGGESTION, undefined),
		...render(system.BILLING_ISSUE, undefined),
		...render(system.ONBOARDING_DAY0, undefined),
		...render(system.ONBOARDING_DAY1, undefined),
		...render(system.ONBOARDING_DAY2, undefined),
		...render(system.ONBOARDING_DAY3, undefined),
		...render(system.ONBOARDING_DAY5, { completedCount: 99999 }),
		...render(system.ONBOARDING_DAY7, { completedCount: 99999 }),
		...render(system.MILESTONE_FIRST_COMPLETE, undefined),
		...render(system.MILESTONE_10, undefined),
		...render(system.MILESTONE_50, undefined),
		...render(system.MILESTONE_100, undefined),
		...render(system.MILESTONE_STREAK_3, undefined),
		...render(system.MILESTONE_FIRST_FRIEND, undefined),
		...render(retention["D0:d0_no_todo"], undefined),
		...render(retention["D1:d1_no_todo"], undefined),
		...render(retention["D1:d1_has_todo_no_completion"], undefined),
		...render(retention["D3:d3_restart"], undefined),
		...render(retention["D7:d7_has_progress"], undefined),
		...render(retention["D7:d7_restart"], undefined),
		...render(fallback.MORNING, undefined),
		...render(fallback.EVENING, undefined),
	];
}

function hasVariants(value: unknown): value is { readonly variants: readonly unknown[] } {
	return (
		typeof value === "object" &&
		value !== null &&
		"variants" in value &&
		Array.isArray(value.variants)
	);
}

function variantCounts(group: object): [key: string, variantCount: number][] {
	return Object.entries(group).map(([key, template]) => [
		key,
		hasVariants(template) ? template.variants.length : 0,
	]);
}

function renderNoVariableCatalog(catalog: LocaleCatalog): NotificationCopy[] {
	const scheduler = catalog.SCHEDULER_TEMPLATES;
	const system = catalog.SYSTEM_TEMPLATES;
	const retention = catalog.RETENTION_TEMPLATES;
	return [
		...render(scheduler.EVENING_COMPLETE, undefined),
		...render(scheduler.EVENING_NONE, undefined),
		...render(scheduler.MORNING_NO_TODO, undefined),
		...render(scheduler.EVENING_STREAK_7, undefined),
		...render(scheduler.EVENING_STREAK_14, undefined),
		...render(scheduler.LUNCH_NUDGE, undefined),
		...render(system.WINBACK_DAY3, undefined),
		...render(system.WINBACK_DAY7, undefined),
		...render(system.WINBACK_DAY14, undefined),
		...render(system.WINBACK_DAY21, undefined),
		...render(system.WINBACK_DAY30, undefined),
		...render(system.WEEKLY_ACHIEVEMENT_PERFECT, undefined),
		...render(system.WEEKLY_REPORT, undefined),
		...render(system.MONTHLY_REPORT, undefined),
		...render(system.AI_SUGGESTION, undefined),
		...render(system.BILLING_ISSUE, undefined),
		...render(system.ONBOARDING_DAY0, undefined),
		...render(system.ONBOARDING_DAY1, undefined),
		...render(system.ONBOARDING_DAY2, undefined),
		...render(system.ONBOARDING_DAY3, undefined),
		...render(system.MILESTONE_FIRST_COMPLETE, undefined),
		...render(system.MILESTONE_10, undefined),
		...render(system.MILESTONE_50, undefined),
		...render(system.MILESTONE_100, undefined),
		...render(system.MILESTONE_STREAK_3, undefined),
		...render(system.MILESTONE_FIRST_FRIEND, undefined),
		...render(retention["D0:d0_no_todo"], undefined),
		...render(retention["D1:d1_no_todo"], undefined),
		...render(retention["D1:d1_has_todo_no_completion"], undefined),
		...render(retention["D3:d3_restart"], undefined),
		...render(retention["D7:d7_has_progress"], undefined),
		...render(retention["D7:d7_restart"], undefined),
		...render(catalog.WEATHER_FALLBACK.MORNING, undefined),
		...render(catalog.WEATHER_FALLBACK.EVENING, undefined),
	];
}

function graphemeCount(value: string): number {
	return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value))
		.length;
}

describe("푸시 카탈로그 locale 계약", () => {
	it("ko/en의 그룹 key와 variant 수가 동일하다", () => {
		for (const group of CATALOG_GROUPS) {
			expect(Object.keys(EN_CATALOG[group]).sort()).toEqual(Object.keys(KO_CATALOG[group]).sort());
			expect(variantCounts(EN_CATALOG[group])).toEqual(variantCounts(KO_CATALOG[group]));
		}

		expect(renderCatalog(EN_CATALOG)).toHaveLength(renderCatalog(KO_CATALOG).length);
	});

	const localeCatalogCases: readonly [locale: string, catalog: LocaleCatalog][] = [
		["ko", KO_CATALOG],
		["en", EN_CATALOG],
	];

	it.each(localeCatalogCases)(
		"%s의 모든 factory가 최대 대표 입력으로 유효한 copy를 렌더링한다",
		(_locale, catalog) => {
			for (const notification of renderCatalog(catalog)) {
				expect(() => notificationContentSchema.parse(notification)).not.toThrow();
				expect(`${notification.title}${notification.body}`).not.toMatch(/[{}]/);
			}
		},
	);
});

describe("푸시 카피 품질 계약", () => {
	const forbiddenKoreanPhrases = [
		"아직도 안 했어",
		"너만 남았어",
		"이대로 잘 거야",
		"어디 갔어",
		"잊혀질 뻔",
		"기다리다 지쳤",
		"미루는 거야",
		"각오해",
		"미쳤다",
	];
	const forbiddenEnglishPhrases = [
		"Brace yourself",
		"Still haven't",
		"only one left",
		"going to bed like this",
		"where'd you go",
		"almost got forgotten",
	];
	const forbiddenPhraseCases: readonly [
		locale: string,
		notifications: readonly NotificationCopy[],
		phrases: readonly string[],
	][] = [
		["ko", renderCatalog(KO_CATALOG), forbiddenKoreanPhrases],
		["en", renderCatalog(EN_CATALOG), forbiddenEnglishPhrases],
	];
	const renderedCatalogCases: readonly [
		locale: string,
		notifications: readonly NotificationCopy[],
	][] = [
		["ko", renderCatalog(KO_CATALOG)],
		["en", renderCatalog(EN_CATALOG)],
	];
	const fixedCatalogCases: readonly [locale: string, notifications: readonly NotificationCopy[]][] =
		[
			["ko", renderNoVariableCatalog(KO_CATALOG)],
			["en", renderNoVariableCatalog(EN_CATALOG)],
		];

	it.each(forbiddenPhraseCases)(
		"%s 카피에는 죄책감·조롱 문구가 없다",
		(_locale, notifications, phrases) => {
			for (const notification of notifications) {
				const text = `${notification.title} ${notification.body}`.toLowerCase();
				for (const phrase of phrases) {
					expect(text).not.toContain(phrase.toLowerCase());
				}
			}
		},
	);

	it.each(renderedCatalogCases)(
		"%s 고정 알림 하나에는 emoji를 최대 하나만 쓴다",
		(_locale, notifications) => {
			for (const notification of notifications) {
				const emojiCount = `${notification.title}${notification.body}`.match(
					/\p{Extended_Pictographic}/gu,
				)?.length;
				expect(emojiCount ?? 0).toBeLessThanOrEqual(1);
			}
		},
	);

	it.each(fixedCatalogCases)(
		"%s 고정 카피는 잠금 화면 길이 예산을 지킨다",
		(_locale, notifications) => {
			for (const notification of notifications) {
				expect(graphemeCount(notification.title)).toBeLessThanOrEqual(30);
				expect(graphemeCount(notification.body)).toBeLessThanOrEqual(40);
			}
		},
	);
});
