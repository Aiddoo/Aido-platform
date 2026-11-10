import { I18nService } from "@nestjs/i18n";
import { Test } from "@nestjs/testing";

import { AppI18nModule } from "#api/platform/i18n/i18n.module";
import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  NOTIFICATION_COPY_CATALOG,
  type NotificationCopyArgs,
  type NotificationCopyText,
} from "./notification-copy-catalog.messages.js";
import { formatNotificationCopyText } from "./notification-copy-format.messages.js";

const LOCALES: readonly SupportedLocale[] = ["ko", "en"];
const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

function isObject(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function isPluralForms(value: unknown): value is { readonly other: string } {
  return (
    isObject(value) &&
    typeof value.other === "string" &&
    Object.keys(value).every((key) => PLURAL_CATEGORIES.has(key))
  );
}

/** 카탈로그의 문구 하나하나(문자열 또는 복수형)를 점 경로와 함께 꺼낸다. */
function messagesOf(node: unknown, path: readonly string[] = []): [string, NotificationCopyText][] {
  if (typeof node === "string" || isPluralForms(node)) {
    return [[path.join("."), node]];
  }
  return isObject(node)
    ? Object.entries(node).flatMap(([key, child]) => messagesOf(child, [...path, key]))
    : [];
}

function placeholdersOf(message: NotificationCopyText): string[] {
  const forms = typeof message === "string" ? [message] : Object.values(message);
  return forms.flatMap((form) =>
    typeof form === "string"
      ? Array.from(form.matchAll(/\{(\w+)\}/g), (match) => match[1] ?? "")
      : [],
  );
}

/** 대표 인자. 사용자 글처럼 자리표시자 문법이 든 값도 다시 해석하지 않는지 본다. */
function argsFor(message: NotificationCopyText, count: number): NotificationCopyArgs {
  return Object.fromEntries(
    placeholdersOf(message).map((name) => [
      name,
      name === "count" ? count : `${name} 값 {count} {{x}} $&`,
    ]),
  );
}

describe("푸시 문구 렌더러와 @nestjs/i18n", () => {
  let i18n: I18nService;

  beforeAll(async () => {
    // Given - AppI18nModule과 같은 설정으로 src/i18n 카탈로그를 읽는다
    const moduleRef = await Test.createTestingModule({ imports: [AppI18nModule] }).compile();
    i18n = moduleRef.get(I18nService);
  });

  const cases = LOCALES.flatMap((locale) =>
    messagesOf(NOTIFICATION_COPY_CATALOG[locale]).map(
      ([path, message]) => [locale, path, message] as const,
    ),
  );

  it("모든 언어의 문구를 검사한다", () => {
    // Then
    expect(cases.length).toBeGreaterThan(600);
  });

  it.each(cases)(
    "%s notification.%s를 I18nService.translate와 같게 채운다",
    (locale, path, message) => {
      for (const count of [0, 1, 2, 5]) {
        // Given
        const args = argsFor(message, count);

        // When
        const rendered = formatNotificationCopyText(message, args, locale);
        const translated = i18n.translate(`notification.${path}`, { locale, args });

        // Then
        expect(rendered).toBe(translated);
      }

      // 인자가 없으면 자리표시자를 그대로 둔다
      expect(formatNotificationCopyText(message, {}, locale)).toBe(
        i18n.translate(`notification.${path}`, { locale }),
      );
    },
  );
});
