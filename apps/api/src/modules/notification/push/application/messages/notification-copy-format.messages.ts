import type { SupportedLocale } from "#api/shared/domain/locale";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { localDateIn, resolveTimezone } from "#api/shared/domain/time/time-zone-name";

import type {
  NotificationCopyArgs,
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
 * (자리표시자 한 번 치환·인자 없는 자리표시자는 그대로·복수형은 `args.count`).
 * 인자 값은 다시 해석하지 않아 사용자가 쓴 `{}`도 그대로 남는다.
 */
export function formatNotificationCopyText(
  message: NotificationCopyText,
  args: NotificationCopyArgs,
  locale: SupportedLocale,
): string {
  const text =
    typeof message === "string" ? message : selectPluralForm(message, args.count, locale);
  return text.replace(PLACEHOLDER, (match: string, name: string | undefined) => {
    if (name == null) {
      return match.charAt(0);
    }
    return Object.hasOwn(args, name) ? String(args[name]) : match;
  });
}

/**
 * 알림 시간대·언어의 짧은 시각 표시. 정시가 아니면 분까지 쓴다(ko "오후 3시"·"오후 3시 30분", en "3 PM"·"3:30 PM").
 * 할 일 시각과 시간별 예보는 절대 시각이므로 기기 시간대로 보여 줘야 앱 화면과 같다.
 */
export function formatWeatherNotificationTime(
  instant: Date,
  { locale, timezone }: { readonly locale: SupportedLocale; readonly timezone: string },
): string {
  const timeZone = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "numeric",
    timeZone,
  }).formatToParts(instant);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  if (locale === "ko") {
    // Intl ko는 분이 있으면 "오후 3:30"이라 정시 표기("오후 3시")와 섞이므로 시·분을 직접 붙인다
    const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value;
    const hour = parts.find((part) => part.type === "hour")?.value;
    const time = minute === 0 ? `${hour}시` : `${hour}시 ${minute}분`;
    return dayPeriod == null ? time : `${dayPeriod} ${time}`;
  }
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    ...(minute !== 0 && { minute: "2-digit" }),
    timeZone,
  }).format(instant);
}

const BILLING_DATE_FORMAT = {
  ko: { month: "long", day: "numeric" },
  en: { month: "short", day: "numeric" },
} as const satisfies Record<SupportedLocale, Intl.DateTimeFormatOptions>;

/** 결제·체험 종료 날짜를 받는 사람 시간대 달력으로 쓴다(ko "12월 9일", en "Dec 9"). */
export function formatBillingDate(
  instant: Date,
  { locale, timezone }: { readonly locale: SupportedLocale; readonly timezone: string },
): string {
  return new Intl.DateTimeFormat(locale, {
    ...BILLING_DATE_FORMAT[locale],
    timeZone: resolveTimezone(timezone),
  }).format(instant);
}

/** 동의한 날을 받는 사람 시간대로 쓴다(ko "2024.11.09", en "Nov 9, 2024"). */
export function formatConsentDate(
  instant: Date,
  { locale, timezone }: { readonly locale: SupportedLocale; readonly timezone: string },
): string {
  const timeZone = resolveTimezone(timezone);
  return locale === "ko"
    ? localDateIn(instantFromDate(instant), timeZone).toString().replaceAll("-", ".")
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone,
      }).format(instant);
}
