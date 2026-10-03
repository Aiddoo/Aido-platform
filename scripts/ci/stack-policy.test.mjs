import assert from 'node:assert/strict';
import test from 'node:test';

import { planPullRequestCI } from './stack-policy.mjs';

const repository = 'aiddoo/Aido-platform';
function pull(number, branch, base, { stack = true, tip = false, draft = false } = {}) {
  return {
    number,
    draft,
    head: { ref: branch, sha: `sha-${number}`, repo: { full_name: repository } },
    base: { ref: base },
    labels: [
      ...(stack ? [{ name: 'stack:1.10.0' }] : []),
      ...(tip ? [{ name: 'ci:stack-tip' }] : []),
    ],
  };
}
const bottom = pull(1, 'upgrade/1.10-toolchain', 'develop');
const top = pull(2, 'upgrade/1.10-release', bottom.head.ref, { tip: true });

test('일반 PR은 자신의 기준 브랜치로 검증한다', () => {
  // Given
  const current = pull(3, 'feature/todos', 'develop', { stack: false });
  // When
  const result = planPullRequestCI(current, [], repository);
  // Then
  assert.equal(result.run, true);
  assert.equal(result.base, 'develop');
});

test('연결된 마지막 PR은 develop 대비 누적 변경을 검증한다', () => {
  // Given
  const members = [bottom, top];
  // When
  const result = planPullRequestCI(top, members, repository);
  // Then
  assert.deepEqual(result, {
    run: true,
    base: 'develop',
    ancestors: ['sha-1'],
    reason: 'cumulative-stack-tip',
  });
});

test('중간 PR과 초안 PR은 무거운 검증을 실행하지 않는다', () => {
  // Given
  const draft = { ...top, draft: true };
  // When
  const results = [bottom, draft].map((current) =>
    planPullRequestCI(current, [bottom, top], repository),
  );
  // Then
  assert.deepEqual(
    results.map((result) => result.run),
    [false, false],
  );
});

test('스택 라벨이 없는 신규 브랜치는 메타데이터를 기다린다', () => {
  // Given
  const current = pull(3, 'upgrade/1.10-new', 'develop', { stack: false });
  // When
  const result = planPullRequestCI(current, [], repository);
  // Then
  assert.equal(result.reason, 'awaiting-stack-metadata');
});

test('마지막 PR 중복·부모 누락·순환·분리된 스택은 검증을 허용하지 않는다', () => {
  // Given
  const cases = [
    [[{ ...bottom, labels: top.labels }, top], /exactly one/],
    [[top], /missing/],
    [[{ ...bottom, base: top.head }, top], /Circular/],
    [[bottom, top, pull(3, 'upgrade/1.10-unrelated', 'develop')], /Disconnected/],
  ];
  // When
  const plans = cases.map(([members, pattern]) => [
    () => planPullRequestCI(top, members, repository),
    pattern,
  ]);
  // Then
  for (const [plan, pattern] of plans) assert.throws(plan, pattern);
});

test('다른 저장소의 브랜치는 누적 검증을 승인할 수 없다', () => {
  // Given
  const fork = { ...bottom, head: { ...bottom.head, repo: { full_name: 'other/repo' } } };
  // When
  const plan = () => planPullRequestCI(top, [fork, top], repository);
  // Then
  assert.throws(plan, /this repository/);
});

test('1.10.1 브랜치는 라벨 부여 전 검증을 보류한다', () => {
  // Given
  const current = pull(4, 'fix/1.10.1-weather', 'develop', { stack: false });
  // When
  const result = planPullRequestCI(current, [], repository);
  // Then
  assert.equal(result.run, false);
});

for (const branch of ['feat/1.11.0-nudges', 'fix/1.12.2-widgets', 'chore/2.0.0-release']) {
  test(`${branch}는 라벨 등록 전 무거운 검증을 보류한다`, () => {
    // Given: 릴리스 스택 브랜치가 먼저 생성되고 라벨은 아직 등록되지 않았다
    const current = pull(4, branch, 'develop', { stack: false });
    // When: PR의 CI 범위를 판단한다
    const result = planPullRequestCI(current, [], repository);
    // Then: 버전을 하드코딩하지 않고 스택 메타데이터를 기다린다
    assert.equal(result.run, false);
    assert.equal(result.reason, 'awaiting-stack-metadata');
  });
}

test('동시에 열린 다른 릴리스 스택은 검증 대상에 포함하지 않는다', () => {
  // Given
  const labels = [{ name: 'stack:1.10.1' }];
  const first = { ...pull(4, 'chore/1.10.1-ci', 'develop'), labels };
  const last = {
    ...pull(5, 'chore/1.10.1-release', first.head.ref),
    labels: [...labels, { name: 'ci:stack-tip' }],
  };
  // When
  const result = planPullRequestCI(last, [bottom, top, first, last], repository);
  // Then
  assert.deepEqual(result.ancestors, ['sha-4']);
});

test('하나의 PR이 두 릴리스 스택에 속할 수 없다', () => {
  // Given
  const current = { ...top, labels: [...top.labels, { name: 'stack:1.10.1' }] };
  // When
  const plan = () => planPullRequestCI(current, [bottom, current], repository);
  // Then
  assert.throws(plan, /only one/);
});
