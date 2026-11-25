import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { partialMatchKey } from '@tanstack/react-query';
import { z } from 'zod';

const keyFactorySchema = z.object({ all: z.array(z.unknown()).min(1) });

type KeyKind = 'query' | 'mutation';

function listKeyFiles(dir: string, kind: KeyKind): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listKeyFiles(path, kind);
    }
    return path.endsWith(`-${kind}-keys.ts`) && path.includes('/queries/') ? [path] : [];
  });
}

/** 키 파일이 내보낸 `*_{QUERY|MUTATION}_KEYS` 묶음마다 `all`을 읽는다. `all`이 없으면 null로 남겨 빠뜨린 묶음이 드러난다 */
function loadKeyRoots(kind: KeyKind) {
  const suffix = kind === 'query' ? '_QUERY_KEYS' : '_MUTATION_KEYS';
  return listKeyFiles(join(__dirname, '../../features'), kind).flatMap((path) =>
    Object.entries(jest.requireActual<Record<string, unknown>>(path))
      .filter(([name]) => name.endsWith(suffix))
      .map(([name, value]) => ({
        name,
        root: keyFactorySchema.safeParse(value).data?.all ?? null,
      })),
  );
}

function findOverlaps(roots: { name: string; root: unknown[] }[]) {
  return roots.flatMap((outer) =>
    roots
      .filter((inner) => inner.name !== outer.name && partialMatchKey(inner.root, outer.root))
      .map((inner) => `${outer.name} ⊃ ${inner.name}`),
  );
}

describe('*_QUERY_KEYS.all', () => {
  it('모든 키 묶음이 루트를 갖고, 한 기능의 루트가 다른 기능 루트의 접두사가 아니라 한 기능의 무효화가 다른 기능에 닿지 않는다', () => {
    // Given
    const roots = loadKeyRoots('query');

    // When
    const withoutRoot = roots.filter(({ root }) => root == null).map(({ name }) => name);
    const overlaps = findOverlaps(
      roots.flatMap(({ name, root }) => (root == null ? [] : [{ name, root }])),
    );

    // Then
    expect(roots.length).toBeGreaterThan(20);
    expect(withoutRoot).toEqual([]);
    expect(overlaps).toEqual([]);
  });
});

describe('*_MUTATION_KEYS.all', () => {
  it('모든 mutation 키 묶음의 루트가 [기능, "mutation"]이고 서로 겹치지 않아 마지막 변경 판정이 다른 기능을 세지 않는다', () => {
    // Given
    const roots = loadKeyRoots('mutation');

    // When
    const malformed = roots
      .filter(({ root }) => root == null || root.length !== 2 || root[1] !== 'mutation')
      .map(({ name }) => name);
    const overlaps = findOverlaps(
      roots.flatMap(({ name, root }) => (root == null ? [] : [{ name, root }])),
    );

    // Then
    expect(roots.length).toBeGreaterThan(15);
    expect(malformed).toEqual([]);
    expect(overlaps).toEqual([]);
  });
});
