import { calendarDaysBetween, resolveTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import type { NotificationMilestone } from "../../../domain/types/delivery/notification-milestone.js";
import * as en from "./locales/en.js";
import * as ko from "./locales/ko.js";
import { renderLocalizedNotification } from "./notification-copy.renderer.js";
import type { NotificationMessage, NotificationVariantContext } from "./notification-copy.types.js";

const LOCALE_TEMPLATES = { ko, en } satisfies Record<
  SupportedLocale,
  Pick<typeof ko, "SYSTEM_TEMPLATES">
>;

interface LocalizedVariantInput {
  readonly locale?: SupportedLocale;
  readonly variantContext?: NotificationVariantContext;
}

export interface WinbackNotificationInput extends LocalizedVariantInput {
  readonly inactiveDays: number;
}

type OnboardingNotificationInput =
  | (LocalizedVariantInput & {
      readonly day: 0 | 1 | 2 | 3;
      readonly completedCount?: never;
    })
  | (LocalizedVariantInput & {
      readonly day: 5 | 7;
      readonly completedCount: number;
    });

export interface MilestoneNotificationInput {
  readonly milestone: NotificationMilestone;
  readonly locale?: SupportedLocale;
}

export function createWeeklyReportNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES.WEEKLY_REPORT,
    variables: undefined,
    variantContext,
  });
}

export function createMonthlyReportNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES.MONTHLY_REPORT,
    variables: undefined,
    variantContext,
  });
}

export function createAiSuggestionNotificationMessage({
  locale = DEFAULT_LOCALE,
}: Pick<LocalizedVariantInput, "locale"> = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES.AI_SUGGESTION,
    variables: undefined,
  });
}

export function createBillingIssueNotificationMessage({
  locale = DEFAULT_LOCALE,
}: Pick<LocalizedVariantInput, "locale"> = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES.BILLING_ISSUE,
    variables: undefined,
  });
}

export function createPremiumGrantEndingNotificationMessage({
  locale = DEFAULT_LOCALE,
}: Pick<LocalizedVariantInput, "locale"> = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES.PREMIUM_GRANT_ENDING,
    variables: undefined,
  });
}

export interface PremiumTrialEndingNotificationInput {
  readonly locale: SupportedLocale;
  /** 받는 사람 시간대. 남은 일수와 날짜를 이 달력으로 센다. */
  readonly timezone: string;
  /** 스토어가 알려 준 체험 끝(expiration_at_ms) */
  readonly endsAt: Date;
  readonly now: Date;
  /** 해지하지 않아 체험이 끝나면 결제가 이어지는지 */
  readonly willRenew: boolean;
  readonly variantContext?: NotificationVariantContext;
}

const TRIAL_END_DATE_FORMAT = {
  ko: { month: "long", day: "numeric" },
  en: { month: "short", day: "numeric" },
} as const satisfies Record<SupportedLocale, Intl.DateTimeFormatOptions>;

/** 체험 종료 안내. 남은 일수는 ms가 아니라 받는 사람 달력 날짜 차이로 센다(0 = 오늘, 1 = 내일). */
export function createPremiumTrialEndingNotificationMessage(
  input: PremiumTrialEndingNotificationInput,
): NotificationMessage {
  const templates = LOCALE_TEMPLATES[input.locale].SYSTEM_TEMPLATES;
  const timeZone = resolveTimezone(input.timezone);
  const variables = {
    days: calendarDaysBetween(input.now, input.endsAt, timeZone),
    date: new Intl.DateTimeFormat(input.locale, {
      ...TRIAL_END_DATE_FORMAT[input.locale],
      timeZone,
    }).format(input.endsAt),
  };
  return input.willRenew
    ? renderLocalizedNotification({
        template: templates.PREMIUM_TRIAL_ENDING_RENEWING,
        variables,
        variantContext: input.variantContext,
        templateKey: "premium_trial_ending.renewing",
      })
    : renderLocalizedNotification({
        template: templates.PREMIUM_TRIAL_ENDING_CANCELLED,
        variables,
        variantContext: input.variantContext,
        templateKey: "premium_trial_ending.cancelled",
      });
}

export function createWinbackNotificationMessage({
  inactiveDays,
  locale = DEFAULT_LOCALE,
  variantContext,
}: WinbackNotificationInput): NotificationMessage {
  const templates = LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES;
  const selection =
    inactiveDays >= 30
      ? { template: templates.WINBACK_DAY30, templateKey: "winback.day_30" }
      : inactiveDays >= 21
        ? { template: templates.WINBACK_DAY21, templateKey: "winback.day_21" }
        : inactiveDays >= 14
          ? { template: templates.WINBACK_DAY14, templateKey: "winback.day_14" }
          : inactiveDays >= 7
            ? { template: templates.WINBACK_DAY7, templateKey: "winback.day_7" }
            : { template: templates.WINBACK_DAY3, templateKey: "winback.day_3" };

  return renderLocalizedNotification({
    ...selection,
    variables: undefined,
    variantContext,
  });
}

export function createOnboardingNotificationMessage(
  input: OnboardingNotificationInput,
): NotificationMessage {
  const { day, locale = DEFAULT_LOCALE, variantContext } = input;
  const templates = LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES;
  switch (day) {
    case 0:
      return renderLocalizedNotification({
        template: templates.ONBOARDING_DAY0,
        variables: undefined,
        variantContext,
        templateKey: "onboarding.day_0",
      });
    case 1:
      return renderLocalizedNotification({
        template: templates.ONBOARDING_DAY1,
        variables: undefined,
        variantContext,
        templateKey: "onboarding.day_1",
      });
    case 2:
      return renderLocalizedNotification({
        template: templates.ONBOARDING_DAY2,
        variables: undefined,
        variantContext,
        templateKey: "onboarding.day_2",
      });
    case 3:
      return renderLocalizedNotification({
        template: templates.ONBOARDING_DAY3,
        variables: undefined,
        variantContext,
        templateKey: "onboarding.day_3",
      });
    case 5:
      return renderLocalizedNotification({
        template: templates.ONBOARDING_DAY5,
        variables: { completedCount: input.completedCount },
        variantContext,
        templateKey: "onboarding.day_5",
      });
    case 7:
      return renderLocalizedNotification({
        template: templates.ONBOARDING_DAY7,
        variables: { completedCount: input.completedCount },
        variantContext,
        templateKey: "onboarding.day_7",
      });
  }
}

export function createMilestoneNotificationMessage({
  milestone,
  locale = DEFAULT_LOCALE,
}: MilestoneNotificationInput): NotificationMessage {
  const templates = LOCALE_TEMPLATES[locale].SYSTEM_TEMPLATES;
  const template = {
    FIRST_COMPLETE: templates.MILESTONE_FIRST_COMPLETE,
    COUNT_10: templates.MILESTONE_10,
    COUNT_50: templates.MILESTONE_50,
    COUNT_100: templates.MILESTONE_100,
    STREAK_3: templates.MILESTONE_STREAK_3,
    FIRST_FRIEND: templates.MILESTONE_FIRST_FRIEND,
  }[milestone];

  return renderLocalizedNotification({ template, variables: undefined });
}
