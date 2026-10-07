import assert from 'node:assert/strict';
import test from 'node:test';

import { dependencyScope } from './dependency-scope.mjs';

const none = { api: false, mobile: false, shared: false };
const all = { api: true, mobile: true, shared: true };
test('documentation never provisions the API test/build runners', () => {
  assert.deepEqual(dependencyScope(['README.md', 'apps/api/DEPLOYMENT.md', 'docs/api.png']), none);
});
test('mobile and API have independent scopes', () => {
  assert.deepEqual(dependencyScope(['apps/mobile/src/app.tsx']), { ...none, mobile: true });
  assert.deepEqual(dependencyScope(['apps/api/src/main.ts']), { ...none, api: true });
});
test('shared code, lock/root inputs, unknown paths and unavailable diff fail open', () => {
  for (const paths of [
    ['packages/api/src/todo.ts'],
    ['packages/api/src/contracts/todo/todo.response.ts'],
    ['pnpm-lock.yaml'],
    ['tooling/vitest/base.ts'],
    ['new-workspace/file.ts'],
    null,
  ])
    assert.deepEqual(dependencyScope(paths), all);
});
test('cumulative stack diff includes the API ancestor even for a mobile tip', () => {
  assert.deepEqual(dependencyScope(['apps/api/src/todo.ts', 'apps/mobile/src/todo.tsx']), {
    ...none,
    api: true,
    mobile: true,
  });
});
