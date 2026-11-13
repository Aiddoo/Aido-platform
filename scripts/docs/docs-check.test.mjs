import assert from 'node:assert/strict';
import test from 'node:test';

import {
  anchorsOf,
  checkDocs,
  countLines,
  createTree,
  extractLinks,
  isPathCandidate,
  pathExists,
  slugify,
  stripFences,
} from './docs-check.mjs';

const baseConfig = { lineLimit: 200, ruleLineLimit: 40, agentsBytesLimit: 24576, allow: [] };

function run(contents, config = baseConfig, extraFiles = []) {
  const files = [...Object.keys(contents), ...extraFiles];
  return checkDocs({ files, read: (path) => contents[path] ?? null, config }).failures;
}

test('제목 slug는 GitHub 규칙을 따른다', () => {
  // Given
  const cases = [
    ['DI·포트·수명', 'di포트수명'],
    ['6. 클라이언트 (모바일)', '6-클라이언트-모바일'],
    ['baseline (#1400)', 'baseline-1400'],
    ['`useStepper`', 'usestepper'],
    ['[링크](./a.md) 제목', '링크-제목'],
  ];
  // When
  const slugs = cases.map(([heading]) => slugify(heading));
  // Then
  assert.deepEqual(
    slugs,
    cases.map(([, slug]) => slug),
  );
});

test('같은 제목은 -1, -2를 붙이고 펜스 안 제목은 세지 않는다', () => {
  // Given
  const text = '# 예시\n\n```md\n# 코드 안\n```\n\n## 예시\n\n## 예시\n<a id="직접"></a>\n';
  // When
  const anchors = anchorsOf(text);
  // Then
  assert.deepEqual([...anchors].sort(), ['예시', '예시-1', '예시-2', '직접'].sort());
});

test('펜스 안 줄은 비우되 줄 번호는 유지한다', () => {
  // Given
  const text = 'a\n```\n[x](missing.md)\n```\nb';
  // When
  const lines = stripFences(text);
  // Then
  assert.deepEqual(lines, ['a', '', '', '', 'b']);
});

test('링크 대상은 괄호 짝을 맞춰 읽고 코드 안 링크는 건너뛴다', () => {
  // Given
  const line =
    '[화면](../app/(app)/todo/[todoId].tsx "제목") `[코드](no.md)` [참조][r] [b](./b.md#절)';
  // When
  const targets = extractLinks(line);
  // Then
  assert.deepEqual(targets, ['../app/(app)/todo/[todoId].tsx', './b.md#절']);
});

test('줄 수는 wc -l과 같다', () => {
  // Given
  const cases = [
    ['', 0],
    ['a\n', 1],
    ['a\nb', 2],
    ['a\nb\n', 2],
  ];
  // When
  const counts = cases.map(([text]) => countLines(text));
  // Then
  assert.deepEqual(
    counts,
    cases.map(([, count]) => count),
  );
});

test('경로로 보는 코드는 저장소 접두사가 있거나 .md 이름이다', () => {
  // Given
  const cases = [
    ['apps/mobile/src/app.tsx', true],
    ['features/todo', true],
    ['README.md', true],
    ['features/{area}/{feature}', false],
    ['release-x-y-z-steps.tsx', false],
    ['@aido/api', false],
    ['.ts', false],
    ['https://example.com/a', false],
    ['useStepper', false],
  ];
  // When
  const results = cases.map(([code]) => isPathCandidate(code));
  // Then
  assert.deepEqual(
    results,
    cases.map(([, expected]) => expected),
  );
});

test('route 경로는 확장자 없이도, 앱 문서의 src 기준으로도 찾는다', () => {
  // Given
  const tree = createTree([
    'apps/mobile/app/(app)/invite/[inviteCode].tsx',
    'apps/mobile/src/features/todo/domains/todo.model.ts',
    'apps/api/src/modules/ai/shared/domain/plan.domain-service.ts',
  ]);
  // When
  const found = [
    pathExists(tree, 'apps/mobile/docs/a.md', 'app/(app)/invite/[inviteCode]'),
    pathExists(tree, 'apps/mobile/docs/a.md', 'features/todo/domains/todo.model.ts'),
    pathExists(tree, 'apps/api/docs/ai.md', 'shared/domain/plan.domain-service.ts'),
    pathExists(tree, 'apps/mobile/docs/a.md', 'features/todo/domains/gone.model.ts'),
  ];
  // Then
  assert.deepEqual(found, [true, true, true, false]);
});

test('없는 파일·제목·경로를 줄 번호와 함께 보고한다', () => {
  // Given
  const contents = {
    'docs/a.md': '# 제목\n\n[b](./b.md#없음) [c](./c.md) `apps/gone.ts`\n',
    'docs/b.md': '# 있음\n',
  };
  // When
  const failures = run(contents);
  // Then
  assert.deepEqual(
    failures.map(({ doc, line, check }) => `${doc}:${line} ${check}`),
    ['docs/a.md:3 anchor', 'docs/a.md:3 link', 'docs/a.md:3 path'],
  );
});

test('출시 기록은 링크한 파일만 보고 길이·앵커·경로는 보지 않는다', () => {
  // Given
  const contents = {
    'docs/releases/1.0.0/README.md': `${'줄\n'.repeat(250)}[a](../../a.md#없음) \`apps/gone.ts\` [b](./b.md)\n`,
    'docs/a.md': '# 제목\n',
  };
  // When
  const failures = run(contents);
  // Then
  assert.deepEqual(
    failures.map(({ check }) => check),
    ['link'],
  );
});

test('한도를 넘는 문서는 허용 목록에 이유가 있을 때만 통과한다', () => {
  // Given
  const contents = { 'README.md': '줄\n'.repeat(201) };
  const config = {
    ...baseConfig,
    allow: [{ path: 'README.md', check: 'limit', reason: '사람용 소개' }],
  };
  // When
  const blocked = run(contents);
  const allowed = run(contents, config);
  // Then
  assert.deepEqual(
    blocked.map(({ check }) => check),
    ['limit'],
  );
  assert.deepEqual(allowed, []);
});

test('더 걸리지 않거나 이유가 없는 허용 항목은 실패한다', () => {
  // Given
  const contents = { 'README.md': '짧다\n' };
  const config = { ...baseConfig, allow: [{ path: 'README.md', check: 'limit', reason: '' }] };
  // When
  const failures = run(contents, config);
  // Then
  assert.deepEqual(
    failures.map(({ check }) => check),
    ['allow', 'allow-stale'],
  );
});

test('CLAUDE.md·rules·스킬 모양을 본다', () => {
  // Given
  const contents = {
    'CLAUDE.md': '@AGENTS.md\n',
    'AGENTS.md': '# 루트\n',
    'apps/x/CLAUDE.md': '# 직접 쓴 지침\n',
    'apps/x/AGENTS.md': '# 앱\n',
    'apps/x/.claude/rules/a.md': '# paths 없음\n',
    'apps/x/.claude/skills/new/SKILL.md': '---\nname: other\ndescription: 설명\n---\n',
    '.claude/commands/old/SKILL.md': '---\nname: old\ndescription: 설명\n---\n',
  };
  // When
  const failures = run(contents);
  // Then
  assert.deepEqual(
    failures.map(({ doc }) => doc),
    [
      'apps/x/CLAUDE.md',
      'apps/x/.claude/rules/a.md',
      'apps/x/.claude/skills/new/SKILL.md',
      '.claude/commands/old/SKILL.md',
    ],
  );
});

test('.agents/skills 정본마다 Claude용 .claude/skills 링크가 있어야 한다', () => {
  // Given
  const contents = {
    '.agents/skills/linked/SKILL.md': '---\nname: linked\ndescription: 설명\n---\n',
    '.agents/skills/alone/SKILL.md': '---\nname: alone\ndescription: 설명\n---\n',
  };
  // When
  const failures = run(contents, baseConfig, ['.claude/skills/linked']);
  // Then
  assert.deepEqual(
    failures.map(({ doc, check }) => [doc, check]),
    [['.agents/skills/alone/SKILL.md', 'agent-files']],
  );
});

test('shared/ui 부품 폴더마다 같은 이름의 문서가 있어야 한다', () => {
  // Given
  const contents = { 'apps/mobile/src/shared/ui/box/box.md': '# Box\n' };
  const extraFiles = [
    'apps/mobile/src/shared/ui/box/box.tsx',
    'apps/mobile/src/shared/ui/meter/meter.tsx',
  ];
  // When
  const failures = run(contents, baseConfig, extraFiles);
  // Then
  assert.deepEqual(
    failures.map(({ doc, check }) => `${check} ${doc}`),
    ['ui-doc apps/mobile/src/shared/ui/meter/meter.md'],
  );
});
