import type { SupportedLocale } from "@aido/api/vocabulary";

import enEmail from "../../../../../i18n/en/email.json" with { type: "json" };
import koEmail from "../../../../../i18n/ko/email.json" with { type: "json" };

type EmailCopy = typeof koEmail;

// @nestjs/i18n이 읽는 카탈로그와 같은 JSON이다. 미리보기(email:preview)가 Nest 밖에서 돌아 I18nService 대신 직접 읽는다
export const EMAIL_COPY = {
  ko: koEmail,
  en: enEmail,
} satisfies Readonly<Record<SupportedLocale, EmailCopy>>;

const PLACEHOLDER = /\{(\w+)\}/g;

// 자리표시자는 @nestjs/i18n 기본 문법({name})과 같다
export function formatEmailText(text: string, values: Readonly<Record<string, string>>): string {
  return text.replaceAll(PLACEHOLDER, (placeholder, name: string) => values[name] ?? placeholder);
}

// 복수형("1 minute"·"10 minutes")은 카탈로그 대신 Intl 단위 서식이 언어별로 고른다
export function formatMinutes(minutes: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "minute",
    unitDisplay: "long",
  }).format(minutes);
}
