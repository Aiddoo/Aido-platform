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

test('regular PRs retain their own base', () => {
  const current = pull(3, 'feature/todos', 'develop', { stack: false });
  assert.equal(planPullRequestCI(current, [], repository).run, true);
});
test('a connected tip checks the cumulative develop diff', () => {
  assert.deepEqual(planPullRequestCI(top, [bottom, top], repository), {
    run: true,
    base: 'develop',
    ancestors: ['sha-1'],
    reason: 'cumulative-stack-tip',
  });
});
test('intermediate and draft PRs defer heavy checks', () => {
  assert.equal(planPullRequestCI(bottom, [bottom, top], repository).run, false);
  assert.equal(planPullRequestCI({ ...top, draft: true }, [bottom, top], repository).run, false);
});
test('new stack branches wait for metadata', () => {
  const current = pull(3, 'upgrade/1.10-new', 'develop', { stack: false });
  assert.equal(planPullRequestCI(current, [], repository).reason, 'awaiting-stack-metadata');
});
test('multiple tips, missing parents, cycles and unrelated members fail closed', () => {
  assert.throws(
    () => planPullRequestCI(top, [{ ...bottom, labels: top.labels }, top], repository),
    /exactly one/,
  );
  assert.throws(() => planPullRequestCI(top, [top], repository), /missing/);
  assert.throws(
    () => planPullRequestCI(top, [{ ...bottom, base: top.head }, top], repository),
    /Circular/,
  );
  assert.throws(
    () =>
      planPullRequestCI(
        top,
        [bottom, top, pull(3, 'upgrade/1.10-unrelated', 'develop')],
        repository,
      ),
    /Disconnected/,
  );
});
test('forked stack branches cannot authorize cumulative checks', () => {
  const fork = { ...bottom, head: { ...bottom.head, repo: { full_name: 'other/repo' } } };
  assert.throws(() => planPullRequestCI(top, [fork, top], repository), /this repository/);
});

test('1.10.1 branches defer checks before labels are assigned', () => {
  const current = pull(4, 'fix/1.10.1-weather', 'develop', { stack: false });
  assert.equal(planPullRequestCI(current, [], repository).run, false);
});

test('release stacks are isolated from other open stacks', () => {
  const labels = [{ name: 'stack:1.10.1' }];
  const first = { ...pull(4, 'chore/1.10.1-ci', 'develop'), labels };
  const last = {
    ...pull(5, 'chore/1.10.1-release', first.head.ref),
    labels: [...labels, { name: 'ci:stack-tip' }],
  };
  assert.deepEqual(planPullRequestCI(last, [bottom, top, first, last], repository).ancestors, [
    'sha-4',
  ]);
});

test('a PR cannot authorize two release stacks', () => {
  const current = { ...top, labels: [...top.labels, { name: 'stack:1.10.1' }] };
  assert.throws(() => planPullRequestCI(current, [bottom, current], repository), /only one/);
});
