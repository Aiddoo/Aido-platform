import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { SUPPORTED_LOCALES } from "@aido/api/vocabulary";

import { I18N_CATALOG_PATH } from "./i18n-catalog-path.js";

const SOURCE_ROOT = resolve(import.meta.dirname, "../..");

function childNames(directory: string, kind: "directory" | "file"): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => (kind === "directory" ? entry.isDirectory() : entry.isFile()))
    .map((entry) => entry.name)
    .toSorted();
}

// 언어마다 폴더 하나를 두는 곳: 서버 카탈로그와 slice의 messages/locales
const LOCALE_ROOTS = [
  I18N_CATALOG_PATH,
  ...readdirSync(join(SOURCE_ROOT, "modules"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name === "locales")
    .map((entry) => join(entry.parentPath, entry.name)),
].map((directory) => relative(SOURCE_ROOT, directory));

describe("언어별 자원 폴더", () => {
  it("카탈로그와 slice의 언어별 TS 자원 폴더를 모두 찾는다", () => {
    // When
    const roots = LOCALE_ROOTS;

    // Then
    expect(roots).toContain("i18n");
    expect(roots.length).toBeGreaterThan(1);
  });

  it.each(LOCALE_ROOTS)("%s는 지원 언어마다 같은 이름의 파일을 둔다", (root) => {
    // Given
    const directory = join(SOURCE_ROOT, root);

    // When
    const locales = childNames(directory, "directory");
    const filesByLocale = SUPPORTED_LOCALES.map((locale) => ({
      locale,
      files: childNames(join(directory, locale), "file"),
    }));

    // Then
    expect(locales).toEqual(SUPPORTED_LOCALES.toSorted());
    const [base] = filesByLocale;
    for (const { locale, files } of filesByLocale) {
      expect({ locale, files }).toEqual({ locale, files: base?.files });
    }
  });
});
