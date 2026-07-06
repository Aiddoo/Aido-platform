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
      variables.add(match[1] as string);
    }
  }
  return variables;
}

const namespaces = Object.keys(resources.ko) as Array<keyof (typeof resources)['ko']>;

describe.each(namespaces)('%s 네임스페이스', (namespace) => {
  const koKeys = flattenKeys(resources.ko[namespace]);
  const enKeys = flattenKeys(resources.en[namespace]);

  it('ko와 en의 키 집합이 동일하다', () => {
    expect([...enKeys.keys()].sort()).toEqual([...koKeys.keys()].sort());
  });

  it('모든 키의 보간 변수 집합이 ko/en에서 동일하다', () => {
    for (const [key, koValues] of koKeys) {
      const enValues = enKeys.get(key);
      if (!enValues) {
        continue; // 키 집합 검증에서 이미 실패함
      }

      const koVariables = [...extractVariables(koValues)].sort();
      const enVariables = [...extractVariables(enValues)].sort();
      expect({ key: `${namespace}:${key}`, variables: enVariables }).toEqual({
        key: `${namespace}:${key}`,
        variables: koVariables,
      });
    }
  });

  it.each([
    ['ko', koKeys],
    ['en', enKeys],
  ] as const)('%s 카탈로그에 빈 문자열 값이 없다', (_locale, keys) => {
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
