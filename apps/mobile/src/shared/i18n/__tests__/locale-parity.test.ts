import { SUPPORTED_LOCALES } from '@aido/api/vocabulary';

import { resources } from '../resources';

type CatalogValue = string | { [key: string]: CatalogValue };

/**
 * 카탈로그를 평탄화한 키 목록을 반환한다.
 * en의 복수형 키(_one/_other 등)는 base 키로 정규화해 ko와 비교 가능하게 한다.
 */
function flattenKeys(catalog: Record<string, CatalogValue>, prefix = ''): Map<string, string[]> {
  const entries = new Map<string, string[]>();

  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      const baseKey = path.replace(/_(zero|one|two|few|many|other)$/, '');
      const existing = entries.get(baseKey) ?? [];
      existing.push(value);
      entries.set(baseKey, existing);
    } else {
      for (const [nestedKey, values] of flattenKeys(value, path)) {
        entries.set(nestedKey, values);
      }
    }
  }

  return entries;
}

function extractVariables(values: string[]): Set<string> {
  const variables = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(/\{\{(\w+)\}\}/g)) {
      const variable = match[1];
      if (variable != null) {
        variables.add(variable);
      }
    }
  }
  return variables;
}

type LocaleNamespace = keyof (typeof resources)['ko'];

const isLocaleNamespace = (key: string): key is LocaleNamespace => Object.hasOwn(resources.ko, key);

const namespaces = Object.keys(resources.ko).filter(isLocaleNamespace);

// ko 카탈로그가 원문이다. 다른 언어는 모두 ko와 키·보간 변수를 맞춘다
const TRANSLATED_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== 'ko');

describe.each(namespaces)('%s 네임스페이스', (namespace) => {
  const koKeys = flattenKeys(resources.ko[namespace]);

  describe.each(TRANSLATED_LOCALES)('%s 카탈로그', (locale) => {
    const keys = flattenKeys(resources[locale][namespace]);

    it('키 집합이 ko와 같다', () => {
      // When
      const keyList = [...keys.keys()].sort();
      const koKeyList = [...koKeys.keys()].sort();

      // Then
      expect(keyList).toEqual(koKeyList);
    });

    it('모든 키의 보간 변수 집합이 ko와 같다', () => {
      for (const [key, koValues] of koKeys) {
        const values = keys.get(key);
        if (!values) {
          continue; // 키 집합 검증에서 이미 실패함
        }

        // When
        const koVariables = [...extractVariables(koValues)].sort();
        const variables = [...extractVariables(values)].sort();

        // Then
        expect({ key: `${namespace}:${key}`, variables }).toEqual({
          key: `${namespace}:${key}`,
          variables: koVariables,
        });
      }
    });
  });

  it.each(SUPPORTED_LOCALES)('%s 카탈로그에 빈 문자열 값이 없다', (locale) => {
    // When
    const keys = flattenKeys(resources[locale][namespace]);

    // Then
    for (const [key, values] of keys) {
      for (const value of values) {
        expect({ key: `${namespace}:${key}`, value }).not.toEqual({
          key: `${namespace}:${key}`,
          value: '',
        });
      }
    }
  });
});
