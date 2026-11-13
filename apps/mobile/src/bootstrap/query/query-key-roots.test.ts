import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { partialMatchKey } from '@tanstack/react-query';
import { z } from 'zod';

const keyFactorySchema = z.object({ all: z.array(z.unknown()).min(1) });

function listQueryKeyFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listQueryKeyFiles(path);
    }
    return path.endsWith('-query-keys.ts') && path.includes('/queries/') ? [path] : [];
  });
}

function loadQueryKeyRoots() {
  return listQueryKeyFiles(join(__dirname, '../../features')).flatMap((path) =>
    Object.entries(jest.requireActual<Record<string, unknown>>(path)).flatMap(([name, value]) => {
      const factory = keyFactorySchema.safeParse(value);
      return name.endsWith('_QUERY_KEYS') && factory.success
        ? [{ name, root: factory.data.all }]
        : [];
    }),
  );
}

describe('*_QUERY_KEYS.all', () => {
  it('한 기능의 루트가 다른 기능 루트의 접두사가 아니라 한 기능의 무효화가 다른 기능에 닿지 않는다', () => {
    // Given
    const roots = loadQueryKeyRoots();

    // When
    const overlaps = roots.flatMap((outer) =>
      roots
        .filter((inner) => inner.name !== outer.name && partialMatchKey(inner.root, outer.root))
        .map((inner) => `${outer.name} ⊃ ${inner.name}`),
    );

    // Then
    expect(roots.length).toBeGreaterThan(20);
    expect(overlaps).toEqual([]);
  });
});
