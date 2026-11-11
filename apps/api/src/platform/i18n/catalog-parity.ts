import { uniq } from "es-toolkit";

type CatalogValue = string | { readonly [key: string]: CatalogValue };

export interface CatalogNode {
  readonly [key: string]: CatalogValue;
}

const PLACEHOLDER = /\{(\w+)\}/g;
const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

function placeholdersOf(messages: readonly string[]): string {
  const names = messages.flatMap((message) =>
    Array.from(message.matchAll(PLACEHOLDER), (match) => match[1] ?? ""),
  );
  return uniq(names).sort().join(",");
}

function isPluralForms(value: CatalogValue): value is { readonly [key: string]: string } {
  return (
    typeof value !== "string" &&
    "other" in value &&
    Object.entries(value).every(
      ([key, form]) => PLURAL_CATEGORIES.has(key) && typeof form === "string",
    )
  );
}

/**
 * 기준 언어 카탈로그와 다른 언어 카탈로그의 짝이 맞지 않는 곳을 돌려준다.
 * 키 집합, 메시지별 자리표시자, 그 언어의 CLDR 복수 범주를 본다.
 */
export function findCatalogMismatches(
  base: CatalogNode,
  target: CatalogNode,
  targetLocale: string,
  path: readonly string[] = [],
): string[] {
  const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
  return [...keys].flatMap((key): string[] => {
    const at = [...path, key].join(".");
    const baseValue = base[key];
    const targetValue = target[key];
    if (baseValue == null) {
      return [`${at}: 기준 언어에 없는 키`];
    }
    if (targetValue == null) {
      return [`${at}: ${targetLocale}에 없는 키`];
    }
    if (typeof baseValue === "string") {
      return typeof targetValue === "string" &&
        placeholdersOf([baseValue]) === placeholdersOf([targetValue])
        ? []
        : [`${at}: 자리표시자나 모양이 다르다`];
    }
    if (typeof targetValue === "string") {
      return [`${at}: 모양이 다르다`];
    }
    if (isPluralForms(baseValue)) {
      const required = new Intl.PluralRules(targetLocale).resolvedOptions().pluralCategories;
      const missing = required.filter((category) => typeof targetValue[category] !== "string");
      const samePlaceholders =
        placeholdersOf(Object.values(baseValue)) ===
        placeholdersOf(Object.values(targetValue).filter((form) => typeof form === "string"));
      return [
        ...missing.map((category) => `${at}: ${targetLocale} 복수 범주 ${category}가 없다`),
        ...(samePlaceholders ? [] : [`${at}: 자리표시자가 다르다`]),
      ];
    }
    return findCatalogMismatches(baseValue, targetValue, targetLocale, [...path, key]);
  });
}
