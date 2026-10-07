import assert from 'node:assert/strict';
import test from 'node:test';

import { planPullRequestCI, validateTreeProof, validationProofName } from './stack-policy.mjs';

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

test('서버 구조 스택도 같은 누적 tip 정책으로 검증한다', () => {
  // Given
  const labels = [{ name: 'stack:server-architecture' }];
  const first = { ...pull(6, 'refactor/server-prisma8-foundation', 'develop'), labels };
  const last = {
    ...pull(7, 'refactor/server-ci-conventions', first.head.ref),
    labels: [...labels, { name: 'ci:stack-tip' }],
  };
  // When
  const result = planPullRequestCI(last, [bottom, top, first, last], repository);
  // Then
  assert.equal(result.run, true);
  assert.deepEqual(result.ancestors, ['sha-6']);
});

test('서버 스택 브랜치도 라벨 등록 전 무거운 검증을 보류한다', () => {
  // Given
  const current = pull(6, 'refactor/server-prisma8-foundation', 'develop', { stack: false });
  // When
  const result = planPullRequestCI(current, [], repository);
  // Then
  assert.equal(result.reason, 'awaiting-stack-metadata');
  assert.equal(result.run, false);
});

function proofFixture() {
  const headSha = 'a'.repeat(40);
  const testedCommit = 'b'.repeat(40);
  const tree = 'c'.repeat(40);
  const source = pull(27, 'refactor/server-final-tip', 'refactor/server-parent', { tip: true });
  source.head.sha = headSha;
  source.base.repo = { full_name: repository };
  return {
    repository,
    workflowId: 7,
    jobsAttempt: 2,
    currentTree: tree,
    testedCommitTree: tree,
    headCommitTree: tree,
    headIncluded: true,
    requiredScope: { api: true, mobile: true, shared: true },
    proof: {
      version: 1,
      repository,
      runId: 101,
      attempt: 2,
      pullNumber: 27,
      reason: 'cumulative-stack-tip',
      stackLabel: 'stack:1.10.0',
      headSha,
      testedCommit,
      tree,
      baseSha: 'd'.repeat(40),
      ancestors: ['e'.repeat(40)],
      scopes: { api: true, mobile: true, shared: true },
    },
    run: {
      id: 101,
      run_attempt: 2,
      workflow_id: 7,
      path: '.github/workflows/ci.yml',
      event: 'pull_request',
      status: 'completed',
      conclusion: 'success',
      head_sha: headSha,
      head_branch: source.head.ref,
      repository: { full_name: repository },
      head_repository: { full_name: repository },
    },
    artifact: {
      name: validationProofName(101, 2),
      expired: false,
      workflow_run: { id: 101, head_sha: headSha },
    },
    pull: source,
    jobs: ['Lint & Type Check', 'Verify API', 'Test - Mobile & Contracts'].map((name) => ({
      name,
      run_id: 101,
      status: 'completed',
      conclusion: 'success',
    })),
  };
}

test('head H와 실제 checkout P가 달라도 같은 tree·성공 attempt의 필수 jobs가 있으면 재사용한다', () => {
  const input = proofFixture();
  assert.notEqual(input.proof.headSha, input.proof.testedCommit);
  assert.deepEqual(validateTreeProof(input), {
    reusable: true,
    reason: 'successful-stack-tip-tree',
  });
});

test('원본 tip PR이 merge·close된 뒤에도 동일 tree 증거를 재사용한다', () => {
  const input = proofFixture();
  input.pull.state = 'closed';
  input.pull.merged = true;
  assert.equal(validateTreeProof(input).reusable, true);
});

const invalidProofCases = [
  [
    'artifact만으로 승인하지 않는다',
    (f) => {
      f.jobs = [];
    },
  ],
  [
    '실패 run',
    (f) => {
      f.run.conclusion = 'failure';
    },
  ],
  [
    '진행중 run',
    (f) => {
      f.run.status = 'in_progress';
    },
  ],
  [
    '이전 attempt artifact',
    (f) => {
      f.run.run_attempt = 3;
    },
  ],
  [
    '다른 workflow',
    (f) => {
      f.run.workflow_id = 8;
    },
  ],
  [
    '다른 workflow path',
    (f) => {
      f.run.path = '.github/workflows/other.yml';
    },
  ],
  [
    'push 결과는 tip 증거가 아니다',
    (f) => {
      f.run.event = 'push';
    },
  ],
  [
    'fork run',
    (f) => {
      f.run.head_repository.full_name = 'other/repo';
    },
  ],
  [
    'fork PR',
    (f) => {
      f.pull.head.repo.full_name = 'other/repo';
    },
  ],
  [
    'regular PR',
    (f) => {
      f.proof.reason = 'regular';
    },
  ],
  [
    '중간 PR',
    (f) => {
      f.pull.labels = f.pull.labels.filter((label) => label.name !== 'ci:stack-tip');
    },
  ],
  [
    '새 tip head',
    (f) => {
      f.pull.head.sha = 'f'.repeat(40);
    },
  ],
  [
    '만료 artifact',
    (f) => {
      f.artifact.expired = true;
    },
  ],
  [
    '다른 run artifact',
    (f) => {
      f.artifact.workflow_run.id = 102;
    },
  ],
  [
    '다른 attempt 이름',
    (f) => {
      f.artifact.name = validationProofName(101, 1);
    },
  ],
  [
    'source tree 변경',
    (f) => {
      f.currentTree = 'f'.repeat(40);
    },
  ],
  [
    '실제 checkout tree 변경',
    (f) => {
      f.testedCommitTree = 'f'.repeat(40);
    },
  ],
  [
    'H의 tree와 P의 tree 불일치',
    (f) => {
      f.headCommitTree = 'f'.repeat(40);
    },
  ],
  [
    'head ancestry 불포함',
    (f) => {
      f.headIncluded = false;
    },
  ],
  [
    '필요 scope 누락',
    (f) => {
      f.proof.scopes.shared = false;
    },
  ],
  [
    'Verify API skipped',
    (f) => {
      f.jobs[1].conclusion = 'skipped';
    },
  ],
  [
    'Contracts failed',
    (f) => {
      f.jobs[2].conclusion = 'failure';
    },
  ],
  [
    '다른 attempt job',
    (f) => {
      f.jobsAttempt = 1;
    },
  ],
  [
    '같은 이름 job 중복',
    (f) => {
      f.jobs.push({ ...f.jobs[0] });
    },
  ],
];
for (const [scenario, mutate] of invalidProofCases) {
  test(`동일 tree 검증 재사용 거부: ${scenario}`, () => {
    const input = proofFixture();
    mutate(input);
    assert.equal(validateTreeProof(input).reusable, false);
  });
}

test('API-only tip은 mobile/shared 증거를 요구하지 않지만 해당 범위로 확대할 수 없다', () => {
  const input = proofFixture();
  input.proof.scopes = { api: true, mobile: false, shared: false };
  input.requiredScope = { api: true, mobile: false, shared: false };
  input.jobs.pop();
  assert.equal(validateTreeProof(input).reusable, true);
  input.requiredScope.mobile = true;
  assert.deepEqual(validateTreeProof(input), { reusable: false, reason: 'insufficient-scope' });
});

test('없는·형식이 잘못된 proof는 예외 대신 재사용 거부로 처리한다', () => {
  for (const proof of [undefined, null, {}, { version: 1 }, 'not-a-proof']) {
    assert.deepEqual(validateTreeProof({ ...proofFixture(), proof }), {
      reusable: false,
      reason: 'invalid-proof',
    });
  }
});
