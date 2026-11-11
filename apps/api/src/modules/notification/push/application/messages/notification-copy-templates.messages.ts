import {
  NUDGE_REPLY_KINDS,
  SUBSCRIPTION_PLAN_TYPES,
  WEATHER_CONDITIONS,
} from "@aido/api/vocabulary";
import { z } from "zod";

import type { WeatherDayPart } from "#api/modules/weather/forecasts/weather-forecasts.public";

import type {
  NotificationCopy,
  NotificationCopyCatalog,
  NotificationCopyText,
} from "./notification-copy-catalog.messages.js";
import {
  formatBillingDate,
  formatConsentDate,
  formatWeatherNotificationTime,
} from "./notification-copy-format.messages.js";
import {
  defineNotificationCopy,
  type NotificationCopyContext,
} from "./notification-copy.messages.js";

const WEATHER_DAY_PARTS = [
  "dawn",
  "morning",
  "afternoon",
  "evening",
] as const satisfies readonly WeatherDayPart[];

const noFacts = z.object({});
const nameFact = z.string().nullable();
const instantFact = z.iso.datetime();
/** 옛 사실에는 시간대가 없을 수 있어 그때는 다시 렌더링하지 않는다 */
const timezoneFact = z.string().nullable();

type StaticVariant = { readonly title: NotificationCopyText; readonly body: NotificationCopyText };

function staticCopy(
  key: string,
  variants: (catalog: NotificationCopyCatalog) => Readonly<Record<string, StaticVariant>>,
) {
  return defineNotificationCopy({
    key,
    variants,
    facts: noFacts,
    render: (variant, _facts, context) => context.copy(variant),
  });
}

/** 저장한 시각을 그 언어·시간대로 쓴다. 푸시를 만들 때는 호출자가 준 표시 함수를 그대로 쓴다. */
function weatherTime(
  context: NotificationCopyContext,
  instant: string,
  timezone: string | null,
): string | null {
  const at = new Date(instant);
  if (context.overrides.formatTime != null) {
    return context.overrides.formatTime(at);
  }
  return timezone == null
    ? null
    : formatWeatherNotificationTime(at, { locale: context.locale, timezone });
}

function todoWeatherCopy(
  variant: StaticVariant,
  facts: {
    readonly scheduledAt: string;
    readonly timezone: string | null;
    readonly todoTitle: string;
  },
  context: NotificationCopyContext,
  args: Readonly<Record<string, string | number>> = {},
): NotificationCopy | null {
  const time = weatherTime(context, facts.scheduledAt, facts.timezone);
  return time == null
    ? null
    : context.copy(variant, { ...args, time, todoTitle: context.preview(facts.todoTitle) });
}

/** 받는 사람 달력으로 센 남은 일수(0 = 오늘) */
function remainingDays(context: NotificationCopyContext, days: number): string {
  const phrases = context.parts.remainingDays;
  return days <= 0
    ? phrases.today
    : days === 1
      ? phrases.tomorrow
      : context.text(phrases.later, { days });
}

const billingFacts = z.object({ days: z.number(), at: instantFact, timezone: z.string() });

function billingDate(
  context: NotificationCopyContext,
  facts: { readonly at: string; readonly timezone: string },
): string {
  return formatBillingDate(new Date(facts.at), {
    locale: context.locale,
    timezone: facts.timezone,
  });
}

const todoWeatherFacts = z.object({
  scheduledAt: instantFact,
  timezone: timezoneFact,
  todoTitle: z.string(),
});

export const SCHEDULER_COPY = {
  TODO_REMINDER_60MIN: defineNotificationCopy({
    key: "scheduler.TODO_REMINDER_60MIN",
    variants: (catalog) => catalog.scheduler.TODO_REMINDER_60MIN,
    facts: z.object({ todoTitle: z.string() }),
    render: (variant, facts, context) =>
      context.copy(variant, { todoTitle: context.preview(facts.todoTitle) }),
  }),
  TODO_REMINDER_10MIN: defineNotificationCopy({
    key: "scheduler.TODO_REMINDER_10MIN",
    variants: (catalog) => catalog.scheduler.TODO_REMINDER_10MIN,
    facts: z.object({ todoTitle: z.string() }),
    render: (variant, facts, context) =>
      context.copy(variant, { todoTitle: context.preview(facts.todoTitle) }),
  }),
  TODO_SERIES_PAUSED: staticCopy(
    "scheduler.TODO_SERIES_PAUSED",
    (catalog) => catalog.scheduler.TODO_SERIES_PAUSED,
  ),
  MORNING_REMINDER: defineNotificationCopy({
    key: "scheduler.MORNING_REMINDER",
    variants: (catalog) => catalog.scheduler.MORNING_REMINDER,
    facts: z.object({ count: z.number() }),
    render: (variant, facts, context) => context.copy(variant, { count: facts.count }),
  }),
  EVENING_COMPLETE: staticCopy(
    "scheduler.EVENING_COMPLETE",
    (catalog) => catalog.scheduler.EVENING_COMPLETE,
  ),
  EVENING_PARTIAL: defineNotificationCopy({
    key: "scheduler.EVENING_PARTIAL",
    variants: (catalog) => catalog.scheduler.EVENING_PARTIAL,
    facts: z.object({ remaining: z.number() }),
    render: (variant, facts, context) => context.copy(variant, { count: facts.remaining }),
  }),
  EVENING_NONE: staticCopy("scheduler.EVENING_NONE", (catalog) => catalog.scheduler.EVENING_NONE),
  MORNING_NO_TODO: staticCopy(
    "scheduler.MORNING_NO_TODO",
    (catalog) => catalog.scheduler.MORNING_NO_TODO,
  ),
  EVENING_STREAK: defineNotificationCopy({
    key: "scheduler.EVENING_STREAK",
    variants: (catalog) => catalog.scheduler.EVENING_STREAK,
    facts: z.object({ streak: z.number() }),
    render: (variant, facts, context) =>
      context.copy(variant, { streak: facts.streak, next: facts.streak + 1 }),
  }),
  EVENING_STREAK_7: staticCopy(
    "scheduler.EVENING_STREAK_7",
    (catalog) => catalog.scheduler.EVENING_STREAK_7,
  ),
  EVENING_STREAK_14: staticCopy(
    "scheduler.EVENING_STREAK_14",
    (catalog) => catalog.scheduler.EVENING_STREAK_14,
  ),
  EVENING_STREAK_30: defineNotificationCopy({
    key: "scheduler.EVENING_STREAK_30",
    variants: (catalog) => catalog.scheduler.EVENING_STREAK_30,
    facts: z.object({ streak: z.number() }),
    render: (variant, facts, context) => context.copy(variant, { streak: facts.streak }),
  }),
  EVENING_STREAK_RISK_PARTIAL: defineNotificationCopy({
    key: "scheduler.EVENING_STREAK_RISK_PARTIAL",
    variants: (catalog) => catalog.scheduler.EVENING_STREAK_RISK_PARTIAL,
    facts: z.object({ streak: z.number(), remaining: z.number() }),
    render: (variant, facts, context) =>
      context.copy(variant, { streak: facts.streak, remaining: facts.remaining }),
  }),
  EVENING_STREAK_RISK_NONE: defineNotificationCopy({
    key: "scheduler.EVENING_STREAK_RISK_NONE",
    variants: (catalog) => catalog.scheduler.EVENING_STREAK_RISK_NONE,
    facts: z.object({ streak: z.number() }),
    render: (variant, facts, context) => context.copy(variant, { streak: facts.streak }),
  }),
  LUNCH_NUDGE: staticCopy("scheduler.LUNCH_NUDGE", (catalog) => catalog.scheduler.LUNCH_NUDGE),
  STREAK_AT_RISK: defineNotificationCopy({
    key: "scheduler.STREAK_AT_RISK",
    variants: (catalog) => catalog.scheduler.STREAK_AT_RISK,
    facts: z.object({ streak: z.number() }),
    render: (variant, facts, context) => context.copy(variant, { streak: facts.streak }),
  }),
};

export const WEATHER_COPY = {
  MORNING_TODO_RAIN: defineNotificationCopy({
    key: "weather.MORNING_TODO_RAIN",
    variants: (catalog) => catalog.weather.MORNING_TODO_RAIN,
    facts: todoWeatherFacts.extend({ precipChance: z.number(), otherCount: z.number() }),
    render: (variant, facts, context) =>
      todoWeatherCopy(
        {
          title: variant.title,
          body: facts.otherCount > 0 ? variant.bodyWithOthers : variant.body,
        },
        facts,
        context,
        { precipChance: facts.precipChance, count: facts.otherCount },
      ),
  }),
  MORNING_TODO_STORM: defineNotificationCopy({
    key: "weather.MORNING_TODO_STORM",
    variants: (catalog) => catalog.weather.MORNING_TODO_STORM,
    facts: todoWeatherFacts,
    render: (variant, facts, context) => todoWeatherCopy(variant, facts, context),
  }),
  MORNING_TODO_SNOW: defineNotificationCopy({
    key: "weather.MORNING_TODO_SNOW",
    variants: (catalog) => catalog.weather.MORNING_TODO_SNOW,
    facts: todoWeatherFacts,
    render: (variant, facts, context) => todoWeatherCopy(variant, facts, context),
  }),
  MORNING_TODO_HEAT: defineNotificationCopy({
    key: "weather.MORNING_TODO_HEAT",
    variants: (catalog) => catalog.weather.MORNING_TODO_HEAT,
    facts: todoWeatherFacts.extend({ apparentTemp: z.number() }),
    render: (variant, facts, context) =>
      todoWeatherCopy(variant, facts, context, { apparentTemp: facts.apparentTemp }),
  }),
  MORNING_RAIN_LATER: defineNotificationCopy({
    key: "weather.MORNING_RAIN_LATER",
    variants: (catalog) => catalog.weather.MORNING_RAIN_LATER,
    facts: z.object({ startsAt: instantFact, timezone: timezoneFact }),
    render: (variant, facts, context) => {
      const time = weatherTime(context, facts.startsAt, facts.timezone);
      return time == null ? null : context.copy(variant, { time });
    },
  }),
  MORNING_SNOW_LATER: defineNotificationCopy({
    key: "weather.MORNING_SNOW_LATER",
    variants: (catalog) => catalog.weather.MORNING_SNOW_LATER,
    facts: z.object({ startsAt: instantFact, timezone: timezoneFact }),
    render: (variant, facts, context) => {
      const time = weatherTime(context, facts.startsAt, facts.timezone);
      return time == null ? null : context.copy(variant, { time });
    },
  }),
  MORNING_SUMMARY: defineNotificationCopy({
    key: "weather.MORNING_SUMMARY",
    variants: (catalog) => catalog.weather.MORNING_SUMMARY,
    facts: z.object({
      condition: z.enum(WEATHER_CONDITIONS),
      tempMin: z.number(),
      tempMax: z.number(),
      precipChance: z.number(),
    }),
    render: (variant, facts, context) =>
      context.copy(variant, {
        condition: context.parts.weatherCondition[facts.condition],
        tempMin: facts.tempMin,
        tempMax: facts.tempMax,
        precipChance: facts.precipChance,
      }),
  }),
  EVENING_RAIN: defineNotificationCopy({
    key: "weather.EVENING_RAIN",
    variants: (catalog) => catalog.weather.EVENING_RAIN,
    facts: z.object({
      dayPart: z.enum(WEATHER_DAY_PARTS).nullable(),
      chillyTemp: z.number().nullable(),
    }),
    render: (variant, { dayPart, chillyTemp }, context) => ({
      title:
        dayPart == null
          ? context.text(variant.title)
          : context.text(variant.titleWithDayPart, {
              dayPart: context.parts.weatherDayPart[dayPart],
            }),
      body:
        chillyTemp == null
          ? context.text(variant.body)
          : context.text(variant.bodyChilly, { chillyTemp }),
    }),
  }),
  EVENING_SNOW: defineNotificationCopy({
    key: "weather.EVENING_SNOW",
    variants: (catalog) => catalog.weather.EVENING_SNOW,
    facts: z.object({
      dayPart: z.enum(WEATHER_DAY_PARTS).nullable(),
      chillyTemp: z.number().nullable(),
    }),
    render: (variant, { dayPart, chillyTemp }, context) => ({
      title:
        dayPart == null
          ? context.text(variant.title)
          : context.text(variant.titleWithDayPart, {
              dayPart: context.parts.weatherDayPart[dayPart],
            }),
      body:
        chillyTemp == null
          ? context.text(variant.body)
          : context.text(variant.bodyChilly, { chillyTemp }),
    }),
  }),
  EVENING_SUMMARY: defineNotificationCopy({
    key: "weather.EVENING_SUMMARY",
    variants: (catalog) => catalog.weather.EVENING_SUMMARY,
    facts: z.object({
      condition: z.enum(WEATHER_CONDITIONS),
      tempMin: z.number(),
      tempMax: z.number(),
      isChilly: z.boolean(),
    }),
    render: (variant, facts, context) => {
      const args = {
        condition: context.parts.weatherCondition[facts.condition],
        tempMin: facts.tempMin,
        tempMax: facts.tempMax,
      };
      return facts.isChilly
        ? context.copy({ title: variant.titleChilly, body: variant.bodyChilly }, args)
        : context.copy(variant, args);
    },
  }),
};

export const WEATHER_FALLBACK_COPY = {
  MORNING: staticCopy("weatherFallback.MORNING", (catalog) => catalog.weatherFallback.MORNING),
  EVENING: staticCopy("weatherFallback.EVENING", (catalog) => catalog.weatherFallback.EVENING),
  MORNING_UNAVAILABLE: staticCopy(
    "weatherFallback.MORNING_UNAVAILABLE",
    (catalog) => catalog.weatherFallback.MORNING_UNAVAILABLE,
  ),
  EVENING_UNAVAILABLE: staticCopy(
    "weatherFallback.EVENING_UNAVAILABLE",
    (catalog) => catalog.weatherFallback.EVENING_UNAVAILABLE,
  ),
};

const senderFacts = z.object({ senderName: nameFact });
const friendFacts = z.object({ friendName: nameFact });

function senderCopy(
  key: string,
  variants: (catalog: NotificationCopyCatalog) => Readonly<Record<string, StaticVariant>>,
) {
  return defineNotificationCopy({
    key,
    variants,
    facts: senderFacts,
    render: (variant, facts, context) =>
      context.copy(variant, context.names("sender", facts.senderName)),
  });
}

function friendCopy(
  key: string,
  variants: (catalog: NotificationCopyCatalog) => Readonly<Record<string, StaticVariant>>,
) {
  return defineNotificationCopy({
    key,
    variants,
    facts: friendFacts,
    render: (variant, facts, context) =>
      context.copy(variant, context.names("friend", facts.friendName)),
  });
}

function previewedName(context: NotificationCopyContext, name: string | null): string | null {
  return name == null ? null : context.preview(name);
}

export const SOCIAL_COPY = {
  NUDGE_REPLIED: defineNotificationCopy({
    key: "social.NUDGE_REPLIED",
    variants: (catalog) => catalog.social.NUDGE_REPLIED,
    facts: z.object({
      senderName: nameFact,
      todoTitle: z.string(),
      replyKind: z.enum(NUDGE_REPLY_KINDS),
    }),
    render: (variant, facts, context) =>
      context.copy(variant, {
        ...context.names("sender", previewedName(context, facts.senderName)),
        todoTitle: context.preview(facts.todoTitle),
        reply: context.parts.nudgeReply[facts.replyKind],
      }),
  }),
  NUDGE_THANKED: defineNotificationCopy({
    key: "social.NUDGE_THANKED",
    variants: (catalog) => catalog.social.NUDGE_THANKED,
    facts: z.object({ senderName: nameFact, todoTitle: z.string() }),
    render: (variant, facts, context) =>
      context.copy(variant, {
        ...context.names("sender", previewedName(context, facts.senderName)),
        todoTitle: context.preview(facts.todoTitle),
      }),
  }),
  FOLLOW_NEW: senderCopy("social.FOLLOW_NEW", (catalog) => catalog.social.FOLLOW_NEW),
  FOLLOW_ACCEPTED: senderCopy(
    "social.FOLLOW_ACCEPTED",
    (catalog) => catalog.social.FOLLOW_ACCEPTED,
  ),
  INVITE_PROGRESS: defineNotificationCopy({
    key: "social.INVITE_PROGRESS",
    variants: (catalog) => catalog.social.INVITE_PROGRESS,
    facts: z.object({ inviteeName: nameFact }),
    render: (variant, facts, context) =>
      context.copy(variant, context.names("invitee", previewedName(context, facts.inviteeName))),
  }),
  INVITE_QUALIFY_REMINDER: defineNotificationCopy({
    key: "social.INVITE_QUALIFY_REMINDER",
    variants: (catalog) => catalog.social.INVITE_QUALIFY_REMINDER,
    facts: z.object({ inviterName: nameFact }),
    render: (variant, facts, context) =>
      context.copy(variant, context.names("inviter", previewedName(context, facts.inviterName))),
  }),
  INVITE_JOINED: defineNotificationCopy({
    key: "social.INVITE_JOINED",
    variants: (catalog) => catalog.social.INVITE_JOINED,
    facts: z.object({ inviteeName: nameFact }),
    render: (variant, facts, context) =>
      context.copy(variant, context.names("invitee", previewedName(context, facts.inviteeName))),
  }),
  INVITE_REWARDED: defineNotificationCopy({
    key: "social.INVITE_REWARDED",
    variants: (catalog) => catalog.social.INVITE_REWARDED,
    facts: z.object({ premiumDays: z.number(), friendSlots: z.number() }),
    render: (variant, { premiumDays, friendSlots }, context) => {
      const args = {
        premium: context.text(variant.premium, { count: premiumDays }),
        friends: context.text(variant.friends, { count: friendSlots }),
      };
      const body =
        premiumDays > 0 && friendSlots > 0
          ? variant.bodyBoth
          : premiumDays > 0
            ? variant.bodyPremium
            : variant.bodyFriends;
      return context.copy({ title: variant.title, body }, args);
    },
  }),
  NUDGE_RECEIVED: defineNotificationCopy({
    key: "social.NUDGE_RECEIVED",
    variants: (catalog) => catalog.social.NUDGE_RECEIVED,
    facts: z.object({ senderName: nameFact, todoTitle: z.string().nullable() }),
    render: (variant, facts, context) => {
      const todoTitle = facts.todoTitle ? context.preview(facts.todoTitle) : null;
      return context.copy(
        { title: variant.title, body: todoTitle ? variant.bodyWithTodo : variant.body },
        { ...context.names("sender", facts.senderName), todoTitle: todoTitle ?? "" },
      );
    },
  }),
  NUDGE_RECEIVED_WITH_MESSAGE: defineNotificationCopy({
    key: "social.NUDGE_RECEIVED_WITH_MESSAGE",
    variants: (catalog) => catalog.social.NUDGE_RECEIVED_WITH_MESSAGE,
    facts: z.object({
      senderName: nameFact,
      todoTitle: z.string().nullable(),
      message: z.string(),
    }),
    render: (variant, facts, context) => {
      const todoTitle = facts.todoTitle ? context.preview(facts.todoTitle) : null;
      return context.copy(
        { title: variant.title, body: todoTitle ? variant.bodyWithTodo : variant.body },
        {
          ...context.names("sender", facts.senderName),
          todoTitle: todoTitle ?? "",
          message: facts.message,
        },
      );
    },
  }),
  REMIND_NUDGE_RECEIVED: senderCopy(
    "social.REMIND_NUDGE_RECEIVED",
    (catalog) => catalog.social.REMIND_NUDGE_RECEIVED,
  ),
  REMIND_NUDGE_RECEIVED_WITH_MESSAGE: defineNotificationCopy({
    key: "social.REMIND_NUDGE_RECEIVED_WITH_MESSAGE",
    variants: (catalog) => catalog.social.REMIND_NUDGE_RECEIVED_WITH_MESSAGE,
    facts: z.object({ senderName: nameFact, message: z.string() }),
    render: (variant, facts, context) =>
      context.copy(variant, {
        ...context.names("sender", facts.senderName),
        message: facts.message,
      }),
  }),
  CHEER_RECEIVED: defineNotificationCopy({
    key: "social.CHEER_RECEIVED",
    variants: (catalog) => catalog.social.CHEER_RECEIVED,
    facts: z.object({ senderName: nameFact, message: z.string() }),
    render: (variant, facts, context) =>
      context.copy(variant, {
        ...context.names("sender", facts.senderName),
        message: facts.message,
      }),
  }),
  CHEER_RECEIVED_NO_MESSAGE: senderCopy(
    "social.CHEER_RECEIVED_NO_MESSAGE",
    (catalog) => catalog.social.CHEER_RECEIVED_NO_MESSAGE,
  ),
  FRIEND_COMPLETED: friendCopy(
    "social.FRIEND_COMPLETED",
    (catalog) => catalog.social.FRIEND_COMPLETED,
  ),
  SOCIAL_DIGEST_MULTI: defineNotificationCopy({
    key: "social.SOCIAL_DIGEST_MULTI",
    variants: (catalog) => catalog.social.SOCIAL_DIGEST_MULTI,
    facts: z.object({ completedFriendCount: z.number() }),
    render: (variant, facts, context) =>
      context.copy(variant, { count: facts.completedFriendCount }),
  }),
  SOCIAL_DIGEST_SINGLE: friendCopy(
    "social.SOCIAL_DIGEST_SINGLE",
    (catalog) => catalog.social.SOCIAL_DIGEST_SINGLE,
  ),
  NUDGE_SUGGEST: friendCopy("social.NUDGE_SUGGEST", (catalog) => catalog.social.NUDGE_SUGGEST),
  TODO_COMMENT: senderCopy("social.TODO_COMMENT", (catalog) => catalog.social.TODO_COMMENT),
  TODO_COMMENT_CHAIN: defineNotificationCopy({
    key: "social.TODO_COMMENT_CHAIN",
    variants: (catalog) => catalog.social.TODO_COMMENT_CHAIN,
    facts: z.object({ senderName: nameFact, count: z.number() }),
    render: (variant, facts, context) =>
      context.copy(variant, { ...context.names("sender", facts.senderName), count: facts.count }),
  }),
  TODO_COMMENT_REPLY: senderCopy(
    "social.TODO_COMMENT_REPLY",
    (catalog) => catalog.social.TODO_COMMENT_REPLY,
  ),
  TODO_COMMENT_REPLY_TO_REPLY: senderCopy(
    "social.TODO_COMMENT_REPLY_TO_REPLY",
    (catalog) => catalog.social.TODO_COMMENT_REPLY_TO_REPLY,
  ),
  TODO_COMMENT_REPLY_CHAIN: defineNotificationCopy({
    key: "social.TODO_COMMENT_REPLY_CHAIN",
    variants: (catalog) => catalog.social.TODO_COMMENT_REPLY_CHAIN,
    facts: z.object({ senderName: nameFact, count: z.number() }),
    render: (variant, facts, context) =>
      context.copy(variant, { ...context.names("sender", facts.senderName), count: facts.count }),
  }),
  TODO_COMMENT_LIKE: senderCopy(
    "social.TODO_COMMENT_LIKE",
    (catalog) => catalog.social.TODO_COMMENT_LIKE,
  ),
};

export const SYSTEM_COPY = {
  WINBACK_DAY3: staticCopy("system.WINBACK_DAY3", (catalog) => catalog.system.WINBACK_DAY3),
  WINBACK_DAY7: staticCopy("system.WINBACK_DAY7", (catalog) => catalog.system.WINBACK_DAY7),
  WINBACK_DAY14: staticCopy("system.WINBACK_DAY14", (catalog) => catalog.system.WINBACK_DAY14),
  WINBACK_DAY21: staticCopy("system.WINBACK_DAY21", (catalog) => catalog.system.WINBACK_DAY21),
  WINBACK_DAY30: staticCopy("system.WINBACK_DAY30", (catalog) => catalog.system.WINBACK_DAY30),
  WEEKLY_ACHIEVEMENT: defineNotificationCopy({
    key: "system.WEEKLY_ACHIEVEMENT",
    variants: (catalog) => catalog.system.WEEKLY_ACHIEVEMENT,
    facts: z.object({ completedCount: z.number() }),
    render: (variant, facts, context) => context.copy(variant, { count: facts.completedCount }),
  }),
  WEEKLY_ACHIEVEMENT_PERFECT: staticCopy(
    "system.WEEKLY_ACHIEVEMENT_PERFECT",
    (catalog) => catalog.system.WEEKLY_ACHIEVEMENT_PERFECT,
  ),
  WEEKLY_ACHIEVEMENT_ALMOST: defineNotificationCopy({
    key: "system.WEEKLY_ACHIEVEMENT_ALMOST",
    variants: (catalog) => catalog.system.WEEKLY_ACHIEVEMENT_ALMOST,
    facts: z.object({ rate: z.number() }),
    render: (variant, facts, context) => context.copy(variant, { rate: facts.rate }),
  }),
  WEEKLY_REPORT: staticCopy("system.WEEKLY_REPORT", (catalog) => catalog.system.WEEKLY_REPORT),
  MONTHLY_REPORT: staticCopy("system.MONTHLY_REPORT", (catalog) => catalog.system.MONTHLY_REPORT),
  AI_SUGGESTION: staticCopy("system.AI_SUGGESTION", (catalog) => catalog.system.AI_SUGGESTION),
  BILLING_ISSUE: staticCopy("system.BILLING_ISSUE", (catalog) => catalog.system.BILLING_ISSUE),
  PREMIUM_GRANT_ENDING: staticCopy(
    "system.PREMIUM_GRANT_ENDING",
    (catalog) => catalog.system.PREMIUM_GRANT_ENDING,
  ),
  PREMIUM_TRIAL_ENDING_RENEWING: defineNotificationCopy({
    key: "system.PREMIUM_TRIAL_ENDING_RENEWING",
    variants: (catalog) => catalog.system.PREMIUM_TRIAL_ENDING_RENEWING,
    facts: billingFacts.extend({ planType: z.enum(SUBSCRIPTION_PLAN_TYPES).nullable() }),
    render: (variant, facts, context) =>
      context.copy(variant, {
        day: remainingDays(context, facts.days),
        plan: context.parts.plan[facts.planType ?? "UNKNOWN"],
        date: billingDate(context, facts),
      }),
  }),
  PREMIUM_TRIAL_ENDING_CANCELLED: defineNotificationCopy({
    key: "system.PREMIUM_TRIAL_ENDING_CANCELLED",
    variants: (catalog) => catalog.system.PREMIUM_TRIAL_ENDING_CANCELLED,
    facts: billingFacts,
    render: (variant, facts, context) => {
      const title =
        facts.days <= 0
          ? variant.titleToday
          : facts.days === 1
            ? variant.titleTomorrow
            : variant.title;
      return context.copy(
        { title, body: variant.body },
        { days: facts.days, date: billingDate(context, facts) },
      );
    },
  }),
  PREMIUM_RENEWAL_UPCOMING: defineNotificationCopy({
    key: "system.PREMIUM_RENEWAL_UPCOMING",
    variants: (catalog) => catalog.system.PREMIUM_RENEWAL_UPCOMING,
    facts: billingFacts,
    render: (variant, facts, context) =>
      context.copy(variant, {
        day: remainingDays(context, facts.days),
        date: billingDate(context, facts),
      }),
  }),
  MARKETING_CONSENT_RECONFIRM: defineNotificationCopy({
    key: "system.MARKETING_CONSENT_RECONFIRM",
    variants: (catalog) => catalog.system.MARKETING_CONSENT_RECONFIRM,
    facts: z.object({ agreedAt: instantFact, timezone: z.string() }),
    render: (variant, facts, context) =>
      context.copy(variant, {
        agreedOn: formatConsentDate(new Date(facts.agreedAt), {
          locale: context.locale,
          timezone: facts.timezone,
        }),
      }),
  }),
  ONBOARDING_DAY0: staticCopy(
    "system.ONBOARDING_DAY0",
    (catalog) => catalog.system.ONBOARDING_DAY0,
  ),
  ONBOARDING_DAY1: staticCopy(
    "system.ONBOARDING_DAY1",
    (catalog) => catalog.system.ONBOARDING_DAY1,
  ),
  ONBOARDING_DAY2: staticCopy(
    "system.ONBOARDING_DAY2",
    (catalog) => catalog.system.ONBOARDING_DAY2,
  ),
  ONBOARDING_DAY3: staticCopy(
    "system.ONBOARDING_DAY3",
    (catalog) => catalog.system.ONBOARDING_DAY3,
  ),
  ONBOARDING_DAY5: defineNotificationCopy({
    key: "system.ONBOARDING_DAY5",
    variants: (catalog) => catalog.system.ONBOARDING_DAY5,
    facts: z.object({ completedCount: z.number() }),
    render: (variant, { completedCount }, context) =>
      completedCount === 0
        ? context.copy({ title: variant.titleNone, body: variant.bodyNone })
        : context.copy(variant, { count: completedCount }),
  }),
  ONBOARDING_DAY7: defineNotificationCopy({
    key: "system.ONBOARDING_DAY7",
    variants: (catalog) => catalog.system.ONBOARDING_DAY7,
    facts: z.object({ completedCount: z.number() }),
    render: (variant, { completedCount }, context) =>
      context.copy(
        { title: variant.title, body: completedCount === 0 ? variant.bodyNone : variant.body },
        { count: completedCount },
      ),
  }),
  MILESTONE_FIRST_COMPLETE: staticCopy(
    "system.MILESTONE_FIRST_COMPLETE",
    (catalog) => catalog.system.MILESTONE_FIRST_COMPLETE,
  ),
  MILESTONE_10: staticCopy("system.MILESTONE_10", (catalog) => catalog.system.MILESTONE_10),
  MILESTONE_50: staticCopy("system.MILESTONE_50", (catalog) => catalog.system.MILESTONE_50),
  MILESTONE_100: staticCopy("system.MILESTONE_100", (catalog) => catalog.system.MILESTONE_100),
  MILESTONE_STREAK_3: staticCopy(
    "system.MILESTONE_STREAK_3",
    (catalog) => catalog.system.MILESTONE_STREAK_3,
  ),
  MILESTONE_FIRST_FRIEND: staticCopy(
    "system.MILESTONE_FIRST_FRIEND",
    (catalog) => catalog.system.MILESTONE_FIRST_FRIEND,
  ),
};

export const RETENTION_COPY = {
  "D0:d0_no_todo": staticCopy(
    "retention.D0:d0_no_todo",
    (catalog) => catalog.retention["D0:d0_no_todo"],
  ),
  "D1:d1_no_todo": staticCopy(
    "retention.D1:d1_no_todo",
    (catalog) => catalog.retention["D1:d1_no_todo"],
  ),
  "D1:d1_has_todo_no_completion": staticCopy(
    "retention.D1:d1_has_todo_no_completion",
    (catalog) => catalog.retention["D1:d1_has_todo_no_completion"],
  ),
  "D3:d3_restart": staticCopy(
    "retention.D3:d3_restart",
    (catalog) => catalog.retention["D3:d3_restart"],
  ),
  "D7:d7_has_progress": staticCopy(
    "retention.D7:d7_has_progress",
    (catalog) => catalog.retention["D7:d7_has_progress"],
  ),
  "D7:d7_restart": staticCopy(
    "retention.D7:d7_restart",
    (catalog) => catalog.retention["D7:d7_restart"],
  ),
} satisfies Record<keyof NotificationCopyCatalog["retention"], unknown>;

/** 카탈로그 그룹별 템플릿. 키는 `notification.json`의 경로와 같다. */
export const NOTIFICATION_COPY_TEMPLATES = {
  scheduler: SCHEDULER_COPY,
  weather: WEATHER_COPY,
  weatherFallback: WEATHER_FALLBACK_COPY,
  social: SOCIAL_COPY,
  system: SYSTEM_COPY,
  retention: RETENTION_COPY,
};
