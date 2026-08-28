/** 로케일 카탈로그가 렌더링하는 제목과 본문. */
export interface NotificationCopy {
	readonly title: string;
	readonly body: string;
}

/** 입력 변수를 정확히 받는 순수 카피 함수. */
export type NotificationCopyFactory<TVariables> = (
	variables: Readonly<TVariables>,
) => NotificationCopy;

/** 단일 기본 카피 또는 결정적으로 선택할 non-empty variant 풀. */
export type LocalizedNotificationTemplate<TVariables> =
	| {
			readonly copy: NotificationCopyFactory<TVariables>;
			readonly variants?: never;
	  }
	| {
			readonly copy?: never;
			readonly variants: readonly [
				NotificationCopyFactory<TVariables>,
				...NotificationCopyFactory<TVariables>[],
			];
	  };

type ExactCatalog<TVariablesByKey> = {
	readonly [TKey in keyof TVariablesByKey]: LocalizedNotificationTemplate<TVariablesByKey[TKey]>;
};

export interface SchedulerCopyVariablesByKey {
	readonly TODO_REMINDER_60MIN: { readonly todoTitle: string };
	readonly TODO_REMINDER_10MIN: { readonly todoTitle: string };
	readonly TODO_REMINDER_IMMEDIATE: { readonly todoTitle: string };
	readonly MORNING_REMINDER: { readonly count: number };
	readonly EVENING_COMPLETE: undefined;
	readonly EVENING_PARTIAL: { readonly remaining: number };
	readonly EVENING_NONE: undefined;
	readonly MORNING_NO_TODO: undefined;
	readonly EVENING_STREAK: { readonly streak: number; readonly next: number };
	readonly EVENING_STREAK_7: undefined;
	readonly EVENING_STREAK_14: undefined;
	readonly EVENING_STREAK_30: { readonly streak: number };
	readonly EVENING_STREAK_RISK_PARTIAL: {
		readonly streak: number;
		readonly remaining: number;
	};
	readonly EVENING_STREAK_RISK_NONE: { readonly streak: number };
	readonly LUNCH_NUDGE: undefined;
	readonly STREAK_AT_RISK: { readonly streak: number };
}

export type SchedulerNotificationCopyCatalog = ExactCatalog<SchedulerCopyVariablesByKey>;

export interface ClearWeatherCopyVariables {
	readonly skyLabel: string;
	readonly tempMin: number;
	readonly tempMax: number;
}

export interface PrecipitationWeatherCopyVariables {
	readonly tempMin: number;
	readonly tempMax: number;
	readonly precipProb: number;
}

export interface WeatherCopyVariablesByKey {
	readonly MORNING_CLEAR: ClearWeatherCopyVariables;
	readonly MORNING_RAIN: PrecipitationWeatherCopyVariables;
	readonly MORNING_SNOW: PrecipitationWeatherCopyVariables;
	readonly EVENING_CLEAR: ClearWeatherCopyVariables;
	readonly EVENING_RAIN: PrecipitationWeatherCopyVariables;
	readonly EVENING_SNOW: PrecipitationWeatherCopyVariables;
}

export type WeatherNotificationCopyCatalog = ExactCatalog<WeatherCopyVariablesByKey>;

export interface SocialCopyVariablesByKey {
	readonly FOLLOW_NEW: { readonly senderName: string };
	readonly FOLLOW_ACCEPTED: { readonly senderName: string };
	readonly NUDGE_RECEIVED: {
		readonly senderName: string;
		readonly todoTitle: string | null;
	};
	readonly NUDGE_RECEIVED_WITH_MESSAGE: {
		readonly senderName: string;
		readonly todoTitle: string | null;
		readonly message: string;
	};
	readonly REMIND_NUDGE_RECEIVED: { readonly senderName: string };
	readonly REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
		readonly senderName: string;
		readonly message: string;
	};
	readonly CHEER_RECEIVED: { readonly senderName: string; readonly message: string };
	readonly CHEER_RECEIVED_NO_MESSAGE: { readonly senderName: string };
	readonly FRIEND_COMPLETED: { readonly friendName: string };
	readonly SOCIAL_DIGEST_MULTI: { readonly completedFriendCount: number };
	readonly SOCIAL_DIGEST_SINGLE: { readonly friendName: string };
	readonly NUDGE_SUGGEST: { readonly friendName: string };
	readonly TODO_COMMENT: { readonly senderName: string };
	readonly TODO_COMMENT_CHAIN: { readonly senderName: string; readonly count: number };
	readonly TODO_COMMENT_REPLY: { readonly senderName: string };
	readonly TODO_COMMENT_REPLY_CHAIN: { readonly senderName: string; readonly count: number };
	readonly TODO_COMMENT_LIKE: { readonly senderName: string };
}

export type SocialNotificationCopyCatalog = ExactCatalog<SocialCopyVariablesByKey>;

export interface SystemCopyVariablesByKey {
	readonly WINBACK_DAY3: undefined;
	readonly WINBACK_DAY7: undefined;
	readonly WINBACK_DAY14: undefined;
	readonly WINBACK_DAY21: undefined;
	readonly WINBACK_DAY30: undefined;
	readonly WEEKLY_ACHIEVEMENT: { readonly completedCount: number };
	readonly WEEKLY_ACHIEVEMENT_PERFECT: undefined;
	readonly WEEKLY_ACHIEVEMENT_ALMOST: { readonly rate: number };
	readonly WEEKLY_REPORT: undefined;
	readonly MONTHLY_REPORT: undefined;
	readonly AI_SUGGESTION: undefined;
	readonly BILLING_ISSUE: undefined;
	readonly ONBOARDING_DAY0: undefined;
	readonly ONBOARDING_DAY1: undefined;
	readonly ONBOARDING_DAY2: undefined;
	readonly ONBOARDING_DAY3: undefined;
	readonly ONBOARDING_DAY5: { readonly completedCount: number };
	readonly ONBOARDING_DAY7: { readonly completedCount: number };
	readonly MILESTONE_FIRST_COMPLETE: undefined;
	readonly MILESTONE_10: undefined;
	readonly MILESTONE_50: undefined;
	readonly MILESTONE_100: undefined;
	readonly MILESTONE_STREAK_3: undefined;
	readonly MILESTONE_FIRST_FRIEND: undefined;
}

export type SystemNotificationCopyCatalog = ExactCatalog<SystemCopyVariablesByKey>;

export type RetentionTemplateKey =
	| "D0:d0_no_todo"
	| "D1:d1_no_todo"
	| "D1:d1_has_todo_no_completion"
	| "D3:d3_restart"
	| "D7:d7_has_progress"
	| "D7:d7_restart";

export type RetentionNotificationCopyCatalog = {
	readonly [TKey in RetentionTemplateKey]: LocalizedNotificationTemplate<undefined>;
};

export type RetentionNotificationCopySelection =
	| { readonly stage: "D0"; readonly copyKey: "d0_no_todo" }
	| {
			readonly stage: "D1";
			readonly copyKey: "d1_no_todo" | "d1_has_todo_no_completion";
	  }
	| { readonly stage: "D3"; readonly copyKey: "d3_restart" }
	| { readonly stage: "D7"; readonly copyKey: "d7_has_progress" | "d7_restart" };

export interface WeatherFallbackCopyCatalog {
	readonly MORNING: LocalizedNotificationTemplate<undefined>;
	readonly EVENING: LocalizedNotificationTemplate<undefined>;
}

/** 재시도에도 같은 카피를 선택하기 위한 결정적 variant seed. */
export interface NotificationVariantContext {
	readonly campaignKey: string;
	readonly recipientId: string;
	/** 사용자 로컬 날짜(YYYY-MM-DD) 또는 불변 이벤트 ID */
	readonly occurrenceKey: string;
}

/** 분석 가능한 variant 식별자를 포함한 최종 푸시 문구. */
export interface NotificationMessage extends NotificationCopy {
	readonly variantId: string;
}
