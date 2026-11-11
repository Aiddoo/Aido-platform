import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ErrorCode, Errors } from "@aido/api/errors";
import { SUPPORTED_LOCALES } from "@aido/api/vocabulary";

import { type CatalogNode, findCatalogMismatches } from "./catalog-parity.js";
import { I18N_CATALOG_PATH } from "./i18n-catalog-path.js";

function readCatalog(locale: string): CatalogNode {
  const directory = join(I18N_CATALOG_PATH, locale);
  return Object.fromEntries(
    readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .map((file) => [
        file.replace(/\.json$/, ""),
        JSON.parse(readFileSync(join(directory, file), "utf8")),
      ]),
  );
}

describe("findCatalogMismatches — 언어 짝 검사", () => {
  it("키와 자리표시자가 같으면 문제가 없다", () => {
    // Given
    const ko = { memo: { saved: "{title} 저장했어요" } };
    const en = { memo: { saved: "Saved {title}" } };

    // When
    const mismatches = findCatalogMismatches(ko, en, "en");

    // Then
    expect(mismatches).toEqual([]);
  });

  it("빠진 키·남는 키·다른 자리표시자를 모두 알려 준다", () => {
    // Given
    const ko = { a: "하나", b: "{name}님" };
    const en = { b: "Hi {user}", c: "extra" };

    // When
    const mismatches = findCatalogMismatches(ko, en, "en");

    // Then
    expect(mismatches).toEqual([
      "a: en에 없는 키",
      "b: 자리표시자나 모양이 다르다",
      "c: 기준 언어에 없는 키",
    ]);
  });

  it("복수형은 그 언어가 쓰는 CLDR 범주를 모두 요구한다", () => {
    // Given
    const ko = { todos: { other: "할 일 {count}개" } };
    const en = { todos: { other: "{count} todos" } };

    // When
    const mismatches = findCatalogMismatches(ko, en, "en");

    // Then
    expect(mismatches).toEqual(["todos: en 복수 범주 one가 없다"]);
  });
});

// 출시 문구를 그대로 옮긴 차이. 문구를 바꾸려면 Before/After 검토를 따로 거친다
const KNOWN_MISMATCHES: Readonly<Partial<Record<string, readonly string[]>>> = {
  en: [
    // en은 할 일 수를 제목에, ko는 본문에 쓴다(알림 하나로는 같은 자리표시자)
    "notification.scheduler.MORNING_REMINDER.v5.title: 자리표시자가 다르다",
    "notification.scheduler.MORNING_REMINDER.v5.body: 자리표시자나 모양이 다르다",
  ],
};

describe("서버 i18n 카탈로그", () => {
  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "ko"))(
    "%s 카탈로그는 기준 ko와 짝이 맞다",
    (locale) => {
      // When
      const mismatches = findCatalogMismatches(readCatalog("ko"), readCatalog(locale), locale);

      // Then
      expect(mismatches).toEqual(KNOWN_MISMATCHES[locale] ?? []);
    },
  );

  it("ko errors는 공유 Errors 문구와 바이트 단위로 같다", () => {
    // Given
    const expected = Object.fromEntries(
      Object.values(ErrorCode).map((code) => [code, Errors[code].message]),
    );

    // When
    const { errors } = readCatalog("ko");

    // Then
    expect(errors).toStrictEqual(expected);
  });
});
