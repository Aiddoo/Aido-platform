import { josa } from "es-hangul";
import { deterministicIndex } from "@/shared/domain/services/deterministic-variant";
import {
	DEFAULT_LOCALE,
	SUPPORTED_LOCALES,
	type SupportedLocale,
} from "@/shared/presentation/decorators";
import type { WeatherForecast } from "@/weather";

import * as en from "./locales/en";
import * as ko from "./locales/ko";
import type {
	NotificationMessage,
	NotificationTemplate,
	NotificationVariantContext,
} from "./template.types";

export type {
	NotificationMessage,
	NotificationTemplate,
	NotificationVariantContext,
} from "./template.types";

// =============================================================================
// Locale bundles
// =============================================================================

const LOCALE_TEMPLATES = { ko, en } as const;

/**
 * 저장된 locale 값(신뢰 불가 문자열)을 지원 로케일로 내로잉한다.
 * 미지원/누락 값은 ko — 기존 유저(전원 ko) 동작 보존.
 */
export function resolveTemplateLocale(
	value: string | null | undefined,
): SupportedLocale {
	const matched = SUPPORTED_LOCALES.find((locale) => locale === value);
	return matched ?? DEFAULT_LOCALE;
}

// 기존 import 경로 호환용 ko(원문) 별칭 — 신규 코드는 빌더의 locale 파라미터를 사용할 것
export const SCHEDULER_TEMPLATES = ko.SCHEDULER_TEMPLATES;
export const WEATHER_TEMPLATES = ko.WEATHER_TEMPLATES;
export const SOCIAL_TEMPLATES = ko.SOCIAL_TEMPLATES;
export const SYSTEM_TEMPLATES = ko.SYSTEM_TEMPLATES;

// =============================================================================
// Utilities
// =============================================================================

/**
 * variants 풀에서 사용자·캠페인·발생 키 기반으로 하나를 결정적으로 선택합니다.
 * 같은 입력은 프로세스/재시도와 무관하게 항상 같은 variant를 반환합니다.
 * 선택 컨텍스트가 없는 기존 호출은 첫 variant를 사용합니다.
 */
export function pickVariant(
	template: Pick<NotificationTemplate, "title" | "body" | "variants">,
	context?: NotificationVariantContext,
): NotificationMessage {
	const pool = template.variants;
	if (!pool?.length) {
		return {
			title: template.title,
			body: template.body,
			variantId: context ? `${context.campaignKey}.default` : "default",
		};
	}
	const index = context
		? deterministicIndex(
				`${context.campaignKey}\u0000${context.recipientId}\u0000${context.occurrenceKey}`,
				pool.length,
			)
		: 0;
	const picked = pool[index];
	if (!picked) {
		return {
			title: template.title,
			body: template.body,
			variantId: context ? `${context.campaignKey}.default` : "default",
		};
	}
	return {
		title: picked.title,
		body: picked.body,
		variantId: context
			? `${context.campaignKey}.v${index + 1}`
			: `v${index + 1}`,
	};
}

/**
 * 템플릿 문자열에서 플레이스홀더를 치환합니다.
 *
 * - `{key}`       → 단순 치환
 * - `{key:이/가}` → 치환 후 받침에 맞는 조사 자동 부착 (en 템플릿은 패턴 미사용 → 무동작)
 *
 * @example
 * fillTemplate("{name}님 안녕하세요!", { name: "홍길동" })
 * // => "홍길동님 안녕하세요!"
 *
 * fillTemplate("{name:이/가} 콕 찔렀어!", { name: "홍길동" })
 * // => "홍길동이 콕 찔렀어!"
 */
type JosaParticle = Parameters<typeof josa>[1];

/** es-hangul `josa`가 허용하는 조사 옵션 (라이브러리 `JosaOption` union과 일치) */
const JOSA_PARTICLES = new Set<string>([
	"이/가",
	"을/를",
	"은/는",
	"으로/로",
	"와/과",
	"이나/나",
	"이란/란",
	"아/야",
	"이랑/랑",
	"이에요/예요",
	"으로서/로서",
	"으로써/로써",
	"으로부터/로부터",
	"이라/라",
]);

/** 임의 문자열을 es-hangul 조사 옵션으로 내로잉 (캐스트 없이 타입 가드) */
function isJosaParticle(particle: string): particle is JosaParticle {
	return JOSA_PARTICLES.has(particle);
}

export function fillTemplate(
	template: string,
	variables: Record<string, string | number | undefined>,
): string {
	return template.replace(/\{(\w+)(?::([^}]+))?\}/g, (match, key, particle) => {
		const value = variables[key];
		if (value === undefined) {
			return match;
		}

		const str = String(value);

		if (particle && isJosaParticle(particle)) {
			try {
				return josa(str, particle);
			} catch {
				return str;
			}
		}
		return str;
	});
}

/** 플레이스홀더를 치환하면서 선택된 변형 식별자를 보존합니다. */
function fillMessage(
	message: NotificationMessage,
	variables: Record<string, string | number | undefined>,
): NotificationMessage {
	return {
		title: fillTemplate(message.title, variables),
		body: fillTemplate(message.body, variables),
		variantId: message.variantId,
	};
}

// =============================================================================
// NotificationMessageBuilder
// =============================================================================

/**
 * 알림 메시지 빌더
 *
 * 모든 메서드는 마지막 파라미터로 locale("ko" | "en", 기본 "ko")을 받는다.
 * locale 미전달 호출은 기존과 완전히 동일하게 동작한다 (하위 호환).
 */
export class NotificationMessageBuilder {
	/**
	 * 팔로우 요청 알림 메시지 생성
	 */
	static followNew(
		senderName: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
	): { title: string; body: string } {
		const templates = LOCALE_TEMPLATES[locale];
		const { title, body } = pickVariant(templates.SOCIAL_TEMPLATES.FOLLOW_NEW);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * 맞팔로우 성립 알림 메시지 생성
	 */
	static followAccepted(
		senderName: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
	): { title: string; body: string } {
		const templates = LOCALE_TEMPLATES[locale];
		const { title, body } = pickVariant(
			templates.SOCIAL_TEMPLATES.FOLLOW_ACCEPTED,
		);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * Nudge 수신 알림 메시지 생성
	 */
	static nudgeReceived(
		senderName: string,
		todoTitle?: string,
		message?: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
	): { title: string; body: string } {
		const templates = LOCALE_TEMPLATES[locale];
		if (message) {
			return {
				title: fillTemplate(
					templates.SOCIAL_TEMPLATES.NUDGE_RECEIVED_WITH_MESSAGE.title,
					{ senderName, todoTitle },
				),
				body: fillTemplate(
					templates.SOCIAL_TEMPLATES.NUDGE_RECEIVED_WITH_MESSAGE.body,
					{ message },
				),
			};
		}
		const { title, body } = pickVariant(
			templates.SOCIAL_TEMPLATES.NUDGE_RECEIVED,
		);
		return {
			title: fillTemplate(title, { senderName, todoTitle }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * 리마인드 Nudge 수신 알림 메시지 생성 (할일 만들기 독촉)
	 */
	static remindNudgeReceived(
		senderName: string,
		message?: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
	): { title: string; body: string } {
		const templates = LOCALE_TEMPLATES[locale];
		if (message) {
			return {
				title: fillTemplate(
					templates.SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED_WITH_MESSAGE.title,
					{ senderName },
				),
				body: fillTemplate(
					templates.SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED_WITH_MESSAGE.body,
					{ message },
				),
			};
		}
		const { title, body } = pickVariant(
			templates.SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED,
		);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * Cheer 수신 알림 메시지 생성
	 */
	static cheerReceived(
		senderName: string,
		message?: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
	): { title: string; body: string } {
		const templates = LOCALE_TEMPLATES[locale];
		if (message) {
			return {
				title: fillTemplate(templates.SOCIAL_TEMPLATES.CHEER_RECEIVED.title, {
					senderName,
				}),
				body: fillTemplate(templates.SOCIAL_TEMPLATES.CHEER_RECEIVED.body, {
					message,
				}),
			};
		}
		const { title, body } = pickVariant(
			templates.SOCIAL_TEMPLATES.CHEER_RECEIVED_NO_MESSAGE,
		);
		return {
			title: fillTemplate(title, { senderName }),
			body: fillTemplate(body, { senderName }),
		};
	}

	/**
	 * 친구 할일 완료 알림 메시지 생성
	 */
	static friendCompleted(
		friendName: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
	): { title: string; body: string } {
		const templates = LOCALE_TEMPLATES[locale];
		const { title, body } = pickVariant(
			templates.SOCIAL_TEMPLATES.FRIEND_COMPLETED,
		);
		return {
			title: fillTemplate(title, { friendName }),
			body: fillTemplate(body, { friendName }),
		};
	}

	/**
	 * 할일 리마인더 알림 메시지 생성 (단계별)
	 *
	 * @param todoTitle 투두 제목
	 * @param stageLabel 리마인더 단계 ('60min' | '10min' | 'immediate')
	 */
	static todoReminder(
		todoTitle: string,
		stageLabel?: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		let template: Pick<NotificationTemplate, "title" | "body" | "variants">;
		switch (stageLabel) {
			case "10min":
				template = templates.SCHEDULER_TEMPLATES.TODO_REMINDER_10MIN;
				break;
			case "immediate":
				template = templates.SCHEDULER_TEMPLATES.TODO_REMINDER_IMMEDIATE;
				break;
			default:
				template = templates.SCHEDULER_TEMPLATES.TODO_REMINDER_60MIN;
				break;
		}

		return fillMessage(pickVariant(template, context), { todoTitle });
	}

	/**
	 * 아침 할일 없음 알림 메시지 생성
	 */
	static morningNoTodo(
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		return pickVariant(
			LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES.MORNING_NO_TODO,
			context,
		);
	}

	/**
	 * 아침 리마인더 알림 메시지 생성
	 */
	static morningReminder(
		count: number,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		const message = pickVariant(
			templates.SCHEDULER_TEMPLATES.MORNING_REMINDER,
			context,
		);
		return fillMessage(message, { count });
	}

	/**
	 * 저녁 리마인더 알림 메시지 생성 (스트릭 통합)
	 *
	 * @param completed 완료된 투두 수
	 * @param total 전체 투두 수
	 * @param streak 현재 스트릭 (0이면 스트릭 없음)
	 * @param isStreakAtRisk 스트릭 위기 여부 (어제까지 연속 완료 + 오늘 미완료)
	 */
	static eveningReminder(
		completed: number,
		total: number,
		streak = 0,
		isStreakAtRisk = false,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		// A. 전체 완료
		if (completed === total && total > 0) {
			if (streak >= 30) {
				return fillMessage(
					pickVariant(templates.SCHEDULER_TEMPLATES.EVENING_STREAK_30, context),
					{ streak },
				);
			}
			if (streak === 14) {
				return pickVariant(
					templates.SCHEDULER_TEMPLATES.EVENING_STREAK_14,
					context,
				);
			}
			if (streak === 7) {
				return pickVariant(
					templates.SCHEDULER_TEMPLATES.EVENING_STREAK_7,
					context,
				);
			}
			if (streak >= 2) {
				const message = pickVariant(
					templates.SCHEDULER_TEMPLATES.EVENING_STREAK,
					context,
				);
				return fillMessage(message, { streak, next: streak + 1 });
			}
			return pickVariant(
				templates.SCHEDULER_TEMPLATES.EVENING_COMPLETE,
				context,
			);
		}

		// B. 일부 완료
		if (completed > 0) {
			const remaining = total - completed;
			if (isStreakAtRisk && streak >= 2) {
				const message = pickVariant(
					templates.SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_PARTIAL,
					context,
				);
				return fillMessage(message, { streak, remaining });
			}
			const message = pickVariant(
				templates.SCHEDULER_TEMPLATES.EVENING_PARTIAL,
				context,
			);
			return fillMessage(message, { remaining });
		}

		// C. 하나도 안 함
		if (isStreakAtRisk && streak >= 2) {
			const message = pickVariant(
				templates.SCHEDULER_TEMPLATES.EVENING_STREAK_RISK_NONE,
				context,
			);
			return fillMessage(message, { streak });
		}
		return pickVariant(templates.SCHEDULER_TEMPLATES.EVENING_NONE, context);
	}

	/**
	 * 주간 리포트 알림 메시지 생성
	 */
	static weeklyReport(
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		return pickVariant(templates.SYSTEM_TEMPLATES.WEEKLY_REPORT, context);
	}

	/**
	 * 월간 리포트 알림 메시지 생성
	 */
	static monthlyReport(
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		return pickVariant(templates.SYSTEM_TEMPLATES.MONTHLY_REPORT, context);
	}

	/**
	 * AI 반복 제안 알림 메시지 생성
	 */
	static aiSuggestion(locale: SupportedLocale = DEFAULT_LOCALE): {
		title: string;
		body: string;
	} {
		const templates = LOCALE_TEMPLATES[locale];
		return {
			title: templates.SYSTEM_TEMPLATES.AI_SUGGESTION.title,
			body: templates.SYSTEM_TEMPLATES.AI_SUGGESTION.body,
		};
	}

	/**
	 * 결제 문제 알림 메시지 생성
	 */
	static billingIssue(locale: SupportedLocale = DEFAULT_LOCALE): {
		title: string;
		body: string;
	} {
		const templates = LOCALE_TEMPLATES[locale];
		return {
			title: templates.SYSTEM_TEMPLATES.BILLING_ISSUE.title,
			body: templates.SYSTEM_TEMPLATES.BILLING_ISSUE.body,
		};
	}

	/**
	 * Win-back 알림 메시지 생성 (비활성 일수에 따라 단계별)
	 */
	static winback(
		inactiveDays: number,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		if (inactiveDays >= 30) {
			return pickVariant(templates.SYSTEM_TEMPLATES.WINBACK_DAY30, context);
		}
		if (inactiveDays >= 21) {
			return pickVariant(templates.SYSTEM_TEMPLATES.WINBACK_DAY21, context);
		}
		if (inactiveDays >= 14) {
			return pickVariant(templates.SYSTEM_TEMPLATES.WINBACK_DAY14, context);
		}
		if (inactiveDays >= 7) {
			return pickVariant(templates.SYSTEM_TEMPLATES.WINBACK_DAY7, context);
		}
		return pickVariant(templates.SYSTEM_TEMPLATES.WINBACK_DAY3, context);
	}

	/**
	 * 주간 달성 배지 알림 메시지 생성 (완료율에 따라 분기)
	 */
	static weeklyAchievement(
		completedCount: number,
		totalCount: number,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		const rate = Math.round((completedCount / totalCount) * 100);

		if (rate === 100) {
			return pickVariant(
				templates.SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_PERFECT,
				context,
			);
		}
		if (rate >= 90) {
			const message = pickVariant(
				templates.SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_ALMOST,
				context,
			);
			return fillMessage(message, { rate });
		}
		const message = pickVariant(
			templates.SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT,
			context,
		);
		return fillMessage(message, { completedCount });
	}

	/**
	 * 친구 활동 요약 알림 메시지 생성
	 */
	static socialDigest(
		completedFriendCount: number,
		friendName?: string,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		if (completedFriendCount === 1 && friendName) {
			const message = pickVariant(
				templates.SOCIAL_TEMPLATES.SOCIAL_DIGEST_SINGLE,
				context,
			);
			return fillMessage(message, { friendName });
		}
		const message = pickVariant(
			templates.SOCIAL_TEMPLATES.SOCIAL_DIGEST_MULTI,
			context,
		);
		return fillMessage(message, { completedFriendCount });
	}

	/**
	 * 점심 넛지 알림 메시지 생성
	 */
	static lunchNudge(
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		return pickVariant(
			LOCALE_TEMPLATES[locale].SCHEDULER_TEMPLATES.LUNCH_NUDGE,
			context,
		);
	}

	/**
	 * 스트릭 위기 알림 메시지 생성
	 */
	static streakAtRisk(
		streak: number,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		const message = pickVariant(
			templates.SCHEDULER_TEMPLATES.STREAK_AT_RISK,
			context,
		);
		return fillMessage(message, { streak });
	}

	/**
	 * 콕 찌르기 유도 알림 메시지 생성
	 */
	static nudgeSuggest(
		friendName: string,
		days: number,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		const message = pickVariant(
			templates.SOCIAL_TEMPLATES.NUDGE_SUGGEST,
			context,
		);
		return fillMessage(message, { friendName, days });
	}

	/**
	 * 온보딩 알림 메시지 생성
	 */
	static onboarding(
		day: number,
		completedCount?: number,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage | null {
		const templates = LOCALE_TEMPLATES[locale];
		const templateMap: Record<number, NotificationTemplate> = {
			0: templates.SYSTEM_TEMPLATES.ONBOARDING_DAY0,
			1: templates.SYSTEM_TEMPLATES.ONBOARDING_DAY1,
			2: templates.SYSTEM_TEMPLATES.ONBOARDING_DAY2,
			3: templates.SYSTEM_TEMPLATES.ONBOARDING_DAY3,
			5: templates.SYSTEM_TEMPLATES.ONBOARDING_DAY5,
			7: templates.SYSTEM_TEMPLATES.ONBOARDING_DAY7,
		};

		const template = templateMap[day];
		if (!template) return null;

		return fillMessage(pickVariant(template, context), { completedCount });
	}

	/**
	 * 마일스톤 축하 알림 메시지 생성
	 */
	static milestone(
		type:
			| "FIRST_COMPLETE"
			| "COUNT_10"
			| "COUNT_50"
			| "COUNT_100"
			| "STREAK_3"
			| "FIRST_FRIEND",
		locale: SupportedLocale = DEFAULT_LOCALE,
	): { title: string; body: string } {
		const templates = LOCALE_TEMPLATES[locale];
		const templateMap = {
			FIRST_COMPLETE: templates.SYSTEM_TEMPLATES.MILESTONE_FIRST_COMPLETE,
			COUNT_10: templates.SYSTEM_TEMPLATES.MILESTONE_10,
			COUNT_50: templates.SYSTEM_TEMPLATES.MILESTONE_50,
			COUNT_100: templates.SYSTEM_TEMPLATES.MILESTONE_100,
			STREAK_3: templates.SYSTEM_TEMPLATES.MILESTONE_STREAK_3,
			FIRST_FRIEND: templates.SYSTEM_TEMPLATES.MILESTONE_FIRST_FRIEND,
		} as const;

		const template = templateMap[type];
		return { title: template.title, body: template.body };
	}

	// =============================================
	// Weather
	// =============================================

	static weatherMorning(
		forecast: WeatherForecast,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		const skyMap = templates.SKY_LABEL_MAP;
		const skyLabel = skyMap[forecast.skyCondition] ?? skyMap.CLEAR ?? "";
		const vars = {
			skyLabel,
			tempMin: Math.round(forecast.temperatureMin),
			tempMax: Math.round(forecast.temperatureMax),
			precipProb: forecast.precipitationProbability,
		};

		const template = selectWeatherTemplate(
			forecast,
			templates.WEATHER_TEMPLATES.MORNING_SNOW,
			templates.WEATHER_TEMPLATES.MORNING_RAIN,
			templates.WEATHER_TEMPLATES.MORNING_CLEAR,
		);

		return fillMessage(pickVariant(template, context), vars);
	}

	static weatherEvening(
		tomorrowForecast: WeatherForecast,
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		const templates = LOCALE_TEMPLATES[locale];
		const skyMap = templates.SKY_LABEL_MAP;
		const skyLabel =
			skyMap[tomorrowForecast.skyCondition] ?? skyMap.CLEAR ?? "";
		const vars = {
			skyLabel,
			tempMin: Math.round(tomorrowForecast.temperatureMin),
			tempMax: Math.round(tomorrowForecast.temperatureMax),
			precipProb: tomorrowForecast.precipitationProbability,
		};

		const template = selectWeatherTemplate(
			tomorrowForecast,
			templates.WEATHER_TEMPLATES.EVENING_SNOW,
			templates.WEATHER_TEMPLATES.EVENING_RAIN,
			templates.WEATHER_TEMPLATES.EVENING_CLEAR,
		);

		return fillMessage(pickVariant(template, context), vars);
	}

	/**
	 * 위치 미설정 유저용 아침 날씨 폴백 메시지
	 */
	static weatherMorningFallback(
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		return pickVariant(
			LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.MORNING,
			context,
		);
	}

	/**
	 * 위치 미설정 유저용 저녁 날씨 폴백 메시지
	 */
	static weatherEveningFallback(
		locale: SupportedLocale = DEFAULT_LOCALE,
		context?: NotificationVariantContext,
	): NotificationMessage {
		return pickVariant(
			LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.EVENING,
			context,
		);
	}
}

/**
 * 강수형태 우선으로 날씨 템플릿을 선택합니다.
 *
 * - 눈/진눈깨비 예보 → 눈 템플릿
 * - 비/소나기 예보 or 강수확률 40% 이상 → 비 템플릿
 * - 그 외 → 맑음 템플릿
 *
 * (강수확률만 보면 확률 40% 미만의 비 예보에 "맑음" 문구가 나가는 문제가 있어
 * 강수형태를 먼저 판정한다)
 */
function selectWeatherTemplate(
	forecast: WeatherForecast,
	snow: NotificationTemplate,
	rain: NotificationTemplate,
	clear: NotificationTemplate,
): NotificationTemplate {
	const type = forecast.precipitationType;
	if (type === "SNOW" || type === "RAIN_SNOW") {
		return snow;
	}
	if (
		type === "RAIN" ||
		type === "SHOWER" ||
		forecast.precipitationProbability >= 40
	) {
		return rain;
	}
	return clear;
}
