import type { SubscriptionPlanType } from "@aido/api/vocabulary";

import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type { NotificationMilestone } from "../../domain/notification-milestone.constants.js";
import type {
  NotificationMessage,
  NotificationVariantContext,
} from "./notification-copy-catalog.messages.js";
import { SYSTEM_COPY } from "./notification-copy-templates.messages.js";
import { renderNotificationTemplate } from "./notification-copy.messages.js";

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
  return renderNotificationTemplate(SYSTEM_COPY.WEEKLY_REPORT, {
    facts: {},
    locale,
    variantContext,
  });
}

export function createMonthlyReportNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedVariantInput = {}): NotificationMessage {
  return renderNotificationTemplate(SYSTEM_COPY.MONTHLY_REPORT, {
    facts: {},
    locale,
    variantContext,
  });
}

export function createAiSuggestionNotificationMessage({
  locale = DEFAULT_LOCALE,
}: Pick<LocalizedVariantInput, "locale"> = {}): NotificationMessage {
  return renderNotificationTemplate(SYSTEM_COPY.AI_SUGGESTION, { facts: {}, locale });
}

export function createBillingIssueNotificationMessage({
  locale = DEFAULT_LOCALE,
}: Pick<LocalizedVariantInput, "locale"> = {}): NotificationMessage {
  return renderNotificationTemplate(SYSTEM_COPY.BILLING_ISSUE, { facts: {}, locale });
}

export function createPremiumGrantEndingNotificationMessage({
  locale = DEFAULT_LOCALE,
}: Pick<LocalizedVariantInput, "locale"> = {}): NotificationMessage {
  return renderNotificationTemplate(SYSTEM_COPY.PREMIUM_GRANT_ENDING, { facts: {}, locale });
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
  /** 체험 뒤 이어질 요금제. 모르는 상품이면 null이다. */
  readonly planType: SubscriptionPlanType | null;
  readonly variantContext?: NotificationVariantContext;
}

/** 남은 일수는 ms가 아니라 받는 사람 달력 날짜 차이로 센다(0 = 오늘, 1 = 내일). 날짜는 렌더링 때 그 달력으로 쓴다. */
function billingDayFacts(input: {
  readonly timezone: string;
  readonly at: Date;
  readonly now: Date;
}) {
  const today = localDateIn(instantFromDate(input.now), input.timezone);
  return {
    days: localDateIn(instantFromDate(input.at), input.timezone).since(today).days,
    at: input.at.toISOString(),
    timezone: input.timezone,
  };
}

/** 체험 종료 안내 */
export function createPremiumTrialEndingNotificationMessage(
  input: PremiumTrialEndingNotificationInput,
): NotificationMessage {
  const facts = billingDayFacts({ ...input, at: input.endsAt });
  return input.willRenew
    ? renderNotificationTemplate(SYSTEM_COPY.PREMIUM_TRIAL_ENDING_RENEWING, {
        facts: { ...facts, planType: input.planType },
        locale: input.locale,
        variantContext: input.variantContext,
        templateKey: "premium_trial_ending.renewing",
      })
    : renderNotificationTemplate(SYSTEM_COPY.PREMIUM_TRIAL_ENDING_CANCELLED, {
        facts,
        locale: input.locale,
        variantContext: input.variantContext,
        templateKey: "premium_trial_ending.cancelled",
      });
}

export interface PremiumRenewalUpcomingNotificationInput {
  readonly locale: SupportedLocale;
  /** 받는 사람 시간대. 남은 일수와 날짜를 이 달력으로 센다. */
  readonly timezone: string;
  /** 스토어가 알려 준 지금 기간의 끝(다음 결제 예정 시각) */
  readonly renewsAt: Date;
  readonly now: Date;
  readonly variantContext?: NotificationVariantContext;
}

/** 연간 구독 자동 갱신 안내. 금액은 국가별 스토어 가격이라 서버가 모르므로 싣지 않는다. */
export function createPremiumRenewalUpcomingNotificationMessage(
  input: PremiumRenewalUpcomingNotificationInput,
): NotificationMessage {
  return renderNotificationTemplate(SYSTEM_COPY.PREMIUM_RENEWAL_UPCOMING, {
    facts: billingDayFacts({ ...input, at: input.renewsAt }),
    locale: input.locale,
    variantContext: input.variantContext,
  });
}

/** 2년 재확인 안내. 날짜는 받는 사람 시간대로 ko "2024.11.09", en "Nov 9, 2024"다. */
export function createMarketingConsentReconfirmNotificationMessage(input: {
  readonly locale: SupportedLocale;
  readonly timezone: string;
  readonly agreedAt: Date;
}): NotificationMessage {
  return renderNotificationTemplate(SYSTEM_COPY.MARKETING_CONSENT_RECONFIRM, {
    facts: { agreedAt: input.agreedAt.toISOString(), timezone: input.timezone },
    locale: input.locale,
  });
}

export function createWinbackNotificationMessage({
  inactiveDays,
  locale = DEFAULT_LOCALE,
  variantContext,
}: WinbackNotificationInput): NotificationMessage {
  const selection =
    inactiveDays >= 30
      ? { template: SYSTEM_COPY.WINBACK_DAY30, templateKey: "winback.day_30" }
      : inactiveDays >= 21
        ? { template: SYSTEM_COPY.WINBACK_DAY21, templateKey: "winback.day_21" }
        : inactiveDays >= 14
          ? { template: SYSTEM_COPY.WINBACK_DAY14, templateKey: "winback.day_14" }
          : inactiveDays >= 7
            ? { template: SYSTEM_COPY.WINBACK_DAY7, templateKey: "winback.day_7" }
            : { template: SYSTEM_COPY.WINBACK_DAY3, templateKey: "winback.day_3" };

  return renderNotificationTemplate(selection.template, {
    facts: {},
    locale,
    variantContext,
    templateKey: selection.templateKey,
  });
}

export function createOnboardingNotificationMessage(
  input: OnboardingNotificationInput,
): NotificationMessage {
  const { day, locale = DEFAULT_LOCALE, variantContext } = input;
  const options = { locale, variantContext };
  switch (day) {
    case 0:
      return renderNotificationTemplate(SYSTEM_COPY.ONBOARDING_DAY0, {
        ...options,
        facts: {},
        templateKey: "onboarding.day_0",
      });
    case 1:
      return renderNotificationTemplate(SYSTEM_COPY.ONBOARDING_DAY1, {
        ...options,
        facts: {},
        templateKey: "onboarding.day_1",
      });
    case 2:
      return renderNotificationTemplate(SYSTEM_COPY.ONBOARDING_DAY2, {
        ...options,
        facts: {},
        templateKey: "onboarding.day_2",
      });
    case 3:
      return renderNotificationTemplate(SYSTEM_COPY.ONBOARDING_DAY3, {
        ...options,
        facts: {},
        templateKey: "onboarding.day_3",
      });
    case 5:
      return renderNotificationTemplate(SYSTEM_COPY.ONBOARDING_DAY5, {
        ...options,
        facts: { completedCount: input.completedCount },
        templateKey: "onboarding.day_5",
      });
    case 7:
      return renderNotificationTemplate(SYSTEM_COPY.ONBOARDING_DAY7, {
        ...options,
        facts: { completedCount: input.completedCount },
        templateKey: "onboarding.day_7",
      });
  }
}

const MILESTONE_COPY = {
  FIRST_COMPLETE: SYSTEM_COPY.MILESTONE_FIRST_COMPLETE,
  COUNT_10: SYSTEM_COPY.MILESTONE_10,
  COUNT_50: SYSTEM_COPY.MILESTONE_50,
  COUNT_100: SYSTEM_COPY.MILESTONE_100,
  STREAK_3: SYSTEM_COPY.MILESTONE_STREAK_3,
  FIRST_FRIEND: SYSTEM_COPY.MILESTONE_FIRST_FRIEND,
} satisfies Record<NotificationMilestone, unknown>;

export function createMilestoneNotificationMessage({
  milestone,
  locale = DEFAULT_LOCALE,
}: MilestoneNotificationInput): NotificationMessage {
  return renderNotificationTemplate(MILESTONE_COPY[milestone], { facts: {}, locale });
}
