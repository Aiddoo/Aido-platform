import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { forbidden } = require('../../.dependency-cruiser.cjs');
const { findLocalOnlyFiles, findStaleLocalOnlyAllowances } = require('../feature-graph.cjs');

function toPatterns(value) {
  return [value ?? []].flat().map((pattern) => new RegExp(pattern));
}

function matches({ path, pathNot }, file) {
  return (
    toPatterns(path).some((pattern) => pattern.test(file)) &&
    !toPatterns(pathNot).some((pattern) => pattern.test(file))
  );
}

function violates(ruleName, from, to) {
  const rule = forbidden.find(({ name }) => name === ruleName);
  assert.ok(rule, `${ruleName} 규칙이 없다`);
  return matches(rule.from, from) && matches(rule.to, to);
}

const TESTING_FILE = 'src/testing/ports/analytics.stub.ts';

test('운영 코드가 src/testing을 import하면 막는다', () => {
  // Given
  const production = [
    'src/features/notes/memo/hooks/use-memo.ts',
    'src/shared/ui/button.tsx',
    'app/index.tsx',
  ];

  // When
  const results = production.map((from) => violates('testing-from-production', from, TESTING_FILE));

  // Then
  assert.deepEqual(results, [true, true, true]);
});

test('테스트와 src/testing 안에서는 src/testing을 import할 수 있다', () => {
  // Given
  const tests = [
    'src/features/notes/memo/hooks/use-memo.test.tsx',
    'src/features/notes/memo/__tests__/memo.fixtures.ts',
    'src/testing/di.ts',
  ];

  // When
  const results = tests.map((from) => violates('testing-from-production', from, TESTING_FILE));

  // Then
  assert.deepEqual(results, [false, false, false]);
});

// 포트 파일 이름이 바뀌면(logger → app-logger) 규칙이 조용히 끊긴다. 지금 포트 이름으로 막는지 본다
test('mapper와 cache helper가 지금 로거·보고 포트를 import하면 막는다', () => {
  // Given
  const cases = [
    [
      'mapper-purity',
      'src/features/notes/memo/apis/memo.mapper.ts',
      'src/core/ports/app-logger.ts',
    ],
    [
      'mapper-purity',
      'src/features/notes/memo/apis/memo.mapper.ts',
      'src/core/ports/error-reporter.ts',
    ],
    [
      'cache-helper-purity',
      'src/features/notes/memo/queries/memo-cache.ts',
      'src/core/ports/app-logger.ts',
    ],
  ];

  // When
  const results = cases.map(([ruleName, from, to]) => violates(ruleName, from, to));

  // Then
  assert.deepEqual(results, [true, true, true]);
});

test('feature는 di-context 밖의 bootstrap을 import하지 못한다', () => {
  // Given
  const from = 'src/features/voice/queries/voice.mutations.ts';
  const targets = [
    'src/bootstrap/query/mutation-error-feedback.tsx',
    'src/bootstrap/providers/di-context.tsx',
  ];

  // When
  const results = targets.map((to) => violates('feature-to-bootstrap', from, to));

  // Then
  assert.deepEqual(results, [true, false]);
});

test('계약은 기능의 apis·schemas만 import하고 그 밖의 기능 폴더는 막는다', () => {
  // Given
  const contract = '../../packages/api/src/contracts/auth/index.ts';
  const importers = [
    'src/features/identity/auth/services/sign-in.service.ts',
    'src/features/device/widget/stores/widget.store.ts',
    'src/features/identity/auth/apis/auth.mapper.ts',
    'src/features/identity/auth/schemas/auth-request.schema.ts',
  ];

  // When
  const results = importers.map((from) => violates('client-model-contract', from, contract));

  // Then
  assert.deepEqual(results, [true, true, false, false]);
});

test('Zod는 기능의 schemas와 도메인 모델 밖에서 import하지 못한다', () => {
  // Given
  const zod = '../../node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js';
  const importers = [
    'src/features/device/widget/repositories/widget.repository.ts',
    'src/features/identity/auth/schemas/auth-request.schema.ts',
    'src/features/identity/auth/domains/auth.model.ts',
  ];

  // When
  const results = importers.map((from) => violates('zod-outside-schemas', from, zod));

  // Then
  assert.deepEqual(results, [true, false, false]);
});

test('역할 폴더 밖 shared 모델도 도메인 모델 규칙을 받는다', () => {
  // Given
  const models = [
    'src/shared/draft/draft.model.ts',
    'src/features/planning/todo/domains/todo.model.ts',
    'src/features/planning/todo/domains/todo.model.test.ts',
  ];

  // When
  const results = models.map((from) =>
    violates('domain-model-ports', from, 'src/core/ports/app-logger.ts'),
  );

  // Then
  assert.deepEqual(results, [true, true, false]);
});

test('모델은 시계·앱 시간대 어댑터를 import하지 못하고 순수 시간대 계산은 가져온다', () => {
  // Given
  const model = 'src/features/planning/todo/domains/todo.model.ts';
  const clockFiles = [
    'src/shared/date/clock.ts',
    'src/shared/hooks/use-today-key.ts',
    'src/shared/infra/localization/app-timezone.ts',
  ];
  const pureFiles = ['src/shared/date/zoned.ts', 'src/shared/date/timezone.ts'];

  // When
  const missing = [...clockFiles, ...pureFiles].filter(
    (file) => !existsSync(new URL(`../../${file}`, import.meta.url)),
  );
  const results = [...clockFiles, ...pureFiles].map((to) =>
    violates('domain-model-clock', model, to),
  );

  // Then
  assert.deepEqual(missing, []);
  assert.deepEqual(results, [true, true, true, false, false]);
});

test('모델은 schemas/를, constants/는 domains/를 import하지 못한다', () => {
  // Given
  const cases = [
    [
      'domain-model-schemas',
      'src/features/planning/todo/domains/todo.model.ts',
      'src/features/planning/todo/schemas/todo-form.schema.ts',
    ],
    [
      'constants-to-domains',
      'src/features/planning/todo/constants/todo.constants.ts',
      'src/features/planning/todo/domains/todo.model.ts',
    ],
    [
      'domain-model-schemas',
      'src/features/planning/todo/schemas/todo-form.schema.ts',
      'src/features/planning/todo/domains/todo.model.ts',
    ],
  ];

  // When
  const results = cases.map(([ruleName, from, to]) => violates(ruleName, from, to));

  // Then
  assert.deepEqual(results, [true, true, false]);
});

test('mapper는 view-model을, queries는 훅·view-model·서비스를 import하지 못한다', () => {
  // Given
  const cases = [
    [
      'mapper-to-view-model',
      'src/features/planning/category/apis/todo-category.mapper.ts',
      'src/features/planning/category/utils/category-color.view-model.ts',
    ],
    [
      'queries-to-ui',
      'src/features/planning/category/queries/todo-category.queries.ts',
      'src/features/planning/category/hooks/use-category-sheet.ts',
    ],
    [
      'queries-to-ui',
      'src/features/planning/category/queries/todo-category.queries.ts',
      'src/features/planning/category/services/category.service.ts',
    ],
    [
      'queries-to-ui',
      'src/features/planning/category/queries/todo-category.mutations.ts',
      'src/features/planning/category/utils/todo-category-analytics.ts',
    ],
  ];

  // When
  const results = cases.map(([ruleName, from, to]) => violates(ruleName, from, to));

  // Then
  assert.deepEqual(results, [true, true, true, false]);
});

test('다른 feature의 utils/는 분석 helper만 import할 수 있다', () => {
  // Given
  const from = 'src/features/planning/category/components/category-list.tsx';
  const targets = [
    'src/features/planning/todo/utils/todo-period.view-model.ts',
    'src/features/billing/subscription/utils/subscription-analytics.ts',
  ];

  // When
  const results = targets.map((to) => violates('feature-utils-import', from, to));

  // Then
  assert.deepEqual(results, [true, false]);
});

test('feature와 route는 shared/infra를 직접 import하지 못하고 경계 파일·위젯 헤드리스 진입점·루트 레이아웃만 된다', () => {
  // Given
  const deviceInfo = 'src/shared/infra/device/device-info.ts';
  const cases = [
    ['src/features/planning/todo-import/components/missing-calendar-help.tsx', deviceInfo],
    [
      'src/features/notes/memo/hooks/use-memo-editor.ts',
      'src/shared/infra/logger/global-logger.ts',
    ],
    ['app/(app)/(tabs)/(me,memos,todos)/todo-import/index.tsx', deviceInfo],
    // 기능이 쓰지 않는 경계 훅(bootstrap만 쓴다)은 열어 두지 않는다
    [
      'src/features/social/invite/hooks/use-invite-link.ts',
      'src/shared/infra/linking/use-linking-url.ts',
    ],
    [
      'src/features/insights/achievement/components/achievement-summary.tsx',
      'src/shared/infra/view-capture/capturable-view.tsx',
    ],
    [
      'src/features/voice/hooks/use-voice-note-player.ts',
      'src/shared/infra/audio/use-audio-part-playlist.ts',
    ],
    ['app/(app)/voice-notes/record.tsx', 'src/shared/infra/keep-awake/use-keep-screen-awake.ts'],
    [
      'src/features/device/widget/bridge/android-widgets.bridge.ts',
      'src/shared/infra/storage/widget-storage.ts',
    ],
    ['app/_layout.tsx', 'src/shared/infra/logger/global-logger.ts'],
    ['src/features/planning/todo-import/components/missing-calendar-help.test.tsx', deviceInfo],
  ];

  // When
  const missing = cases
    .flatMap(([from, to]) => (from.startsWith('app/') ? [from, to] : [to]))
    .filter((file) => !existsSync(new URL(`../../${file}`, import.meta.url)));
  const results = cases.map(([from, to]) => violates('feature-to-infra', from, to));

  // Then
  assert.deepEqual(missing, []);
  assert.deepEqual(results, [true, true, true, true, false, false, false, false, false, false]);
});

test('기기 상수를 직접 읽는 route 두 곳만 래칫으로 남는다', () => {
  // Given
  const deviceInfo = 'src/shared/infra/device/device-info.ts';
  const routes = [
    'app/(app)/(tabs)/(me)/_layout.tsx',
    'app/(app)/(tabs)/(me,memos,todos)/friends/search.tsx',
    'app/(app)/(tabs)/(me,memos,todos)/friends/index.tsx',
  ];

  // When
  const missing = routes.filter((file) => !existsSync(new URL(`../../${file}`, import.meta.url)));
  const results = routes.map((from) => violates('feature-to-infra', from, deviceInfo));

  // Then
  assert.deepEqual(missing, []);
  assert.deepEqual(results, [false, false, true]);
});

test('컴포넌트·훅 하나만 쓰고 자체 테스트가 없는 기능 파일을 경고한다', () => {
  // Given
  const importer = 'src/features/social/friend/components/friend-list.tsx';
  const modules = [
    {
      source: 'src/features/social/friend/components/friend-badge.tsx',
      dependents: [importer],
    },
    {
      source: 'src/features/social/friend/components/friend-chart.tsx',
      dependents: [importer, 'src/features/social/friend/components/friend-chart.test.tsx'],
    },
    {
      source: 'src/features/social/friend/components/friend-screen.tsx',
      dependents: ['app/(app)/friends/index.tsx'],
    },
    {
      source: 'src/features/social/friend/hooks/use-friend-filter.ts',
      dependents: [importer, 'src/features/social/friend/components/friend-search.tsx'],
    },
  ];

  // When
  const warnings = findLocalOnlyFiles(modules);

  // Then
  assert.deepEqual(
    warnings.map((warning) => warning.split(':')[0]),
    ['src/features/social/friend/components/friend-badge.tsx'],
  );
});

test('이유를 적어 둔 파일은 한 곳만 써도 경고하지 않고, 더는 해당하지 않으면 지우라고 알린다', () => {
  // Given
  const importer = 'src/features/social/friend/components/friend-list.tsx';
  const kept = 'src/features/social/friend/components/friend-burst.tsx';
  const shared = 'src/features/social/friend/components/friend-chart.tsx';
  const removed = 'src/features/social/friend/components/friend-gone.tsx';
  const modules = [
    { source: kept, dependents: [importer] },
    {
      source: shared,
      dependents: [importer, 'src/features/social/friend/components/friend-search.tsx'],
    },
  ];
  const allowed = {
    [kept]: '스스로 완결된 그리기 부품',
    [shared]: '낡은 이유',
    [removed]: '낡은 이유',
  };

  // When
  const warnings = findLocalOnlyFiles(modules, allowed);
  const stale = findStaleLocalOnlyAllowances(modules, allowed);

  // Then
  assert.deepEqual(warnings, []);
  assert.deepEqual(
    stale.map((error) => error.split(':')[0]),
    [shared, removed],
  );
});
