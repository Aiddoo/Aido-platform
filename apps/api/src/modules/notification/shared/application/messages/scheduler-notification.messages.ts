import { completionRate, weeklyAchievementBadge } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import type {
  NotificationMessage,
  NotificationVariantContext,
} from "./notification-copy-catalog.messages.js";
import {
  SCHEDULER_COPY,
  SOCIAL_COPY,
  SYSTEM_COPY,
} from "./notification-copy-templates.messages.js";
import { renderNotificationTemplate, toNameFact } from "./notification-copy.messages.js";

interface LocalizedVariantInput {
  readonly locale?: SupportedLocale;
  readonly variantContext?: NotificationVariantContext;
}

export interface TodoReminderNotificationInput extends LocalizedVariantInput {
  readonly todoTitle: string;
  readonly stage: "60min" | "10min";
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
  return renderNotificationTemplate(
    stage === "10min" ? SCHEDULER_COPY.TODO_REMINDER_10MIN : SCHEDULER_COPY.TODO_REMINDER_60MIN,
    { facts: { todoTitle }, locale, variantContext },
  );
}

export interface TodoReminderSnoozedNotificationInput extends LocalizedVariantInput {
  readonly todoTitle: string;
  /** 할 일 시각 전에 울리면 before-start(곧 시작), 지났거나 시각이 없으면 started(이제 시작) */
  readonly timing: "before-start" | "started";
}

export function createTodoReminderSnoozedNotificationMessage({
  todoTitle,
  timing,
  locale = DEFAULT_LOCALE,
  variantContext,
}: TodoReminderSnoozedNotificationInput): NotificationMessage {
  return renderNotificationTemplate(
    timing === "before-start"
      ? SCHEDULER_COPY.TODO_REMINDER_SNOOZED_BEFORE_START
      : SCHEDULER_COPY.TODO_REMINDER_SNOOZED,
    { facts: { todoTitle }, locale, variantContext },
  );
}

export function createTodoSeriesPausedNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
  return renderNotificationTemplate(SCHEDULER_COPY.TODO_SERIES_PAUSED, {
    facts: {},
    locale,
    variantContext,
    templateKey: "todo_series.paused",
  });
}

export function createMorningNoTodoNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
  return renderNotificationTemplate(SCHEDULER_COPY.MORNING_NO_TODO, {
    facts: {},
    locale,
    variantContext,
    templateKey: "morning.no_todo",
  });
}

export function createMorningReminderNotificationMessage({
  count,
  locale = DEFAULT_LOCALE,
  variantContext,
}: MorningReminderNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SCHEDULER_COPY.MORNING_REMINDER, {
    facts: { count },
    locale,
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
  const options = { locale, variantContext };
  if (completed === total && total > 0) {
    if (streak >= 30) {
      return renderNotificationTemplate(SCHEDULER_COPY.EVENING_STREAK_30, {
        ...options,
        facts: { streak },
        templateKey: "evening.streak_30",
      });
    }
    if (streak === 14) {
      return renderNotificationTemplate(SCHEDULER_COPY.EVENING_STREAK_14, {
        ...options,
        facts: {},
        templateKey: "evening.streak_14",
      });
    }
    if (streak === 7) {
      return renderNotificationTemplate(SCHEDULER_COPY.EVENING_STREAK_7, {
        ...options,
        facts: {},
        templateKey: "evening.streak_7",
      });
    }
    if (streak >= 2) {
      return renderNotificationTemplate(SCHEDULER_COPY.EVENING_STREAK, {
        ...options,
        facts: { streak },
        templateKey: "evening.streak",
      });
    }
    return renderNotificationTemplate(SCHEDULER_COPY.EVENING_COMPLETE, {
      ...options,
      facts: {},
      templateKey: "evening.complete",
    });
  }

  if (completed > 0) {
    const remaining = total - completed;
    if (isStreakAtRisk && streak >= 2) {
      return renderNotificationTemplate(SCHEDULER_COPY.EVENING_STREAK_RISK_PARTIAL, {
        ...options,
        facts: { streak, remaining },
        templateKey: "evening.streak_risk_partial",
      });
    }
    return renderNotificationTemplate(SCHEDULER_COPY.EVENING_PARTIAL, {
      ...options,
      facts: { remaining },
      templateKey: "evening.partial",
    });
  }

  if (isStreakAtRisk && streak >= 2) {
    return renderNotificationTemplate(SCHEDULER_COPY.EVENING_STREAK_RISK_NONE, {
      ...options,
      facts: { streak },
      templateKey: "evening.streak_risk_none",
    });
  }

  return renderNotificationTemplate(SCHEDULER_COPY.EVENING_NONE, {
    ...options,
    facts: {},
    templateKey: "evening.none",
  });
}

export function createWeeklyAchievementNotificationMessage({
  completedCount,
  totalCount,
  locale = DEFAULT_LOCALE,
  variantContext,
}: WeeklyAchievementNotificationInput): NotificationMessage {
  return match(weeklyAchievementBadge(completedCount, totalCount))
    .with("perfect", () =>
      renderNotificationTemplate(SYSTEM_COPY.WEEKLY_ACHIEVEMENT_PERFECT, {
        facts: {},
        locale,
        variantContext,
        templateKey: "weekly_achievement.perfect",
      }),
    )
    .with("almost", () =>
      renderNotificationTemplate(SYSTEM_COPY.WEEKLY_ACHIEVEMENT_ALMOST, {
        facts: { rate: completionRate(completedCount, totalCount) },
        locale,
        variantContext,
        templateKey: "weekly_achievement.almost",
      }),
    )
    .with("completed", () =>
      renderNotificationTemplate(SYSTEM_COPY.WEEKLY_ACHIEVEMENT, {
        facts: { completedCount },
        locale,
        variantContext,
        templateKey: "weekly_achievement.standard",
      }),
    )
    .exhaustive();
}

export function createSocialDigestNotificationMessage(
  input: SocialDigestNotificationInput,
): NotificationMessage {
  const locale = input.locale ?? DEFAULT_LOCALE;
  if (input.kind === "single") {
    return renderNotificationTemplate(SOCIAL_COPY.SOCIAL_DIGEST_SINGLE, {
      facts: { friendName: toNameFact(input.friendName, locale) },
      locale,
      variantContext: input.variantContext,
      templateKey: "social_digest.single",
    });
  }
  return renderNotificationTemplate(SOCIAL_COPY.SOCIAL_DIGEST_MULTI, {
    facts: { completedFriendCount: input.completedFriendCount },
    locale,
    variantContext: input.variantContext,
    templateKey: "social_digest.multi",
  });
}

export function createLunchNudgeNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
  return renderNotificationTemplate(SCHEDULER_COPY.LUNCH_NUDGE, {
    facts: {},
    locale,
    variantContext,
  });
}

export function createStreakAtRiskNotificationMessage({
  streak,
  locale = DEFAULT_LOCALE,
  variantContext,
}: StreakAtRiskNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SCHEDULER_COPY.STREAK_AT_RISK, {
    facts: { streak },
    locale,
    variantContext,
  });
}

export function createNudgeSuggestionNotificationMessage({
  friendName,
  locale = DEFAULT_LOCALE,
  variantContext,
}: NudgeSuggestionNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.NUDGE_SUGGEST, {
    facts: { friendName: toNameFact(friendName, locale) },
    locale,
    variantContext,
  });
}
