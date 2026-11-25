import type { Localized, SupportedLocale, TimeFormat } from "@aido/api/vocabulary";

import { instantFromDate } from "#api/shared/domain/time/instant";
import { localDateIn, resolveDateBoundaryTimezone } from "#api/shared/domain/time/timezone-name";

import type {
  NotificationCopyValues,
  NotificationCopyText,
} from "./notification-copy-catalog.messages.js";

// @nestjs/i18n 기본 PlaceholderMessageFormatter와 같은 문법: `{name}`(영숫자·_), `{{`·`}}`는 중괄호 글자
const PLACEHOLDER = /\{\{|\}\}|\{(\w+)\}/g;

const pluralRulesByLocale = new Map<SupportedLocale, Intl.PluralRules>();

function pluralCategory(locale: SupportedLocale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRulesByLocale.get(locale);
  if (rules == null) {
    rules = new Intl.PluralRules(locale);
    pluralRulesByLocale.set(locale, rules);
  }
  return rules.select(count);
}

function selectPluralForm(
  forms: { readonly other: string },
  count: string | number | undefined,
  locale: SupportedLocale,
): string {
  // count가 숫자가 아니면 @nestjs/i18n처럼 other를 쓴다
  const category = typeof count === "number" ? pluralCategory(locale, count) : "other";
  const selected = Object.entries(forms).find(([form]) => form === category)?.[1];
  return typeof selected === "string" ? selected : forms.other;
}

/**
 * 카탈로그 문구를 채운다. `I18nService.translate(key, { locale, args })`와 같은 결과를 낸다
 * (자리표시자 한 번 치환·인자 없는 자리표시자는 그대로·복수형은 `values.count`).
 * 인자 값은 다시 해석하지 않아 사용자가 쓴 `{}`도 그대로 남는다.
 */
export function formatNotificationCopyText(
  message: NotificationCopyText,
  values: NotificationCopyValues,
  locale: SupportedLocale,
): string {
  const text =
    typeof message === "string" ? message : selectPluralForm(message, values.count, locale);
  return text.replaceAll(PLACEHOLDER, (match: string, name: string | undefined) => {
    if (name == null) {
      return match.charAt(0);
    }
    return Object.hasOwn(values, name) ? String(values[name]) : match;
  });
}

interface LocalizedInstantFormat {
  readonly instant: Date;
  readonly locale: SupportedLocale;
  readonly timezone: string;
}

interface LocalizedTimeFormat extends LocalizedInstantFormat {
  readonly timeFormat: TimeFormat;
}

// 앱 시각 표시(date-format.ts getHourCycleOptions)와 같은 시간 주기다
function hourCycleOptionsOf(timeFormat: TimeFormat): Intl.DateTimeFormatOptions {
  return timeFormat === "TWELVE_HOUR" ? { hour12: true } : { hourCycle: "h23" };
}

const NOTIFICATION_TIME_FORMAT: Localized<(input: LocalizedTimeFormat) => string> = {
  ko: ({ instant, locale, timezone, timeFormat }) => {
    // Intl ko는 분이 있으면 "오후 3:30"이라 정시 표기("오후 3시")와 섞이므로 시·분을 직접 붙인다
    const parts = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "numeric",
      ...hourCycleOptionsOf(timeFormat),
      timeZone: timezone,
    }).formatToParts(instant);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value;
    // 24시간 표기는 Intl이 "09"처럼 두 자리로 주므로 숫자로 읽어 "9시"로 쓴다
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const time = minute === 0 ? `${hour}시` : `${hour}시 ${minute}분`;
    return dayPeriod == null ? time : `${dayPeriod} ${time}`;
  },
  en: ({ instant, locale, timezone, timeFormat }) => {
    if (timeFormat === "TWENTY_FOUR_HOUR") {
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: timezone,
      }).format(instant);
    }
    const minute = Number(
      new Intl.DateTimeFormat(locale, { minute: "numeric", timeZone: timezone }).format(instant),
    );
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      ...(minute !== 0 && { minute: "2-digit" }),
      hour12: true,
      timeZone: timezone,
    }).format(instant);
  },
};

/**
 * 알림 시간대·언어·시각 표기의 짧은 시각 표시. 12시간은 정시가 아니면 분까지 쓰고(ko "오후 3시"·"오후 3시 30분",
 * en "3 PM"·"3:30 PM"), 24시간은 ko "15시"·"15시 30분", en "15:00"·"15:30"이다.
 * 할 일 시각과 시간별 예보는 절대 시각이므로 기기 시간대로 보여 줘야 앱 화면과 같다.
 */
export function formatWeatherNotificationTime(
  instant: Date,
  {
    locale,
    timezone,
    timeFormat,
  }: {
    readonly locale: SupportedLocale;
    readonly timezone: string;
    readonly timeFormat: TimeFormat;
  },
): string {
  return NOTIFICATION_TIME_FORMAT[locale]({
    instant,
    locale,
    timezone: resolveDateBoundaryTimezone(timezone),
    timeFormat,
  });
}

const BILLING_DATE_FORMAT = {
  ko: { month: "long", day: "numeric" },
  en: { month: "short", day: "numeric" },
} as const satisfies Localized<Intl.DateTimeFormatOptions>;

/** 결제·체험 종료 날짜를 받는 사람 시간대 달력으로 쓴다(ko "12월 9일", en "Dec 9"). */
export function formatBillingDate(
  instant: Date,
  { locale, timezone }: { readonly locale: SupportedLocale; readonly timezone: string },
): string {
  return new Intl.DateTimeFormat(locale, {
    ...BILLING_DATE_FORMAT[locale],
    timeZone: resolveDateBoundaryTimezone(timezone),
  }).format(instant);
}

const CONSENT_DATE_FORMAT: Localized<(input: LocalizedInstantFormat) => string> = {
  // 한국어 동의 안내의 출시 표기는 점으로 나눈 숫자 날짜다
  ko: ({ instant, timezone }) =>
    localDateIn(instantFromDate(instant), timezone).toString().replaceAll("-", "."),
  en: ({ instant, locale, timezone }) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(instant),
};

/** 동의한 날을 받는 사람 시간대로 쓴다(ko "2024.11.09", en "Nov 9, 2024"). */
export function formatConsentDate(
  instant: Date,
  { locale, timezone }: { readonly locale: SupportedLocale; readonly timezone: string },
): string {
  return CONSENT_DATE_FORMAT[locale]({
    instant,
    locale,
    timezone: resolveDateBoundaryTimezone(timezone),
  });
}
