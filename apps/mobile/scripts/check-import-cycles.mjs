#!/usr/bin/env node
/**
 * 런타임 순환 참조 검사기.
 *
 * Metro는 사이클을 허용하되 경고만 남긴다("Require cycle: ..."). 사이클은 모듈 하나가
 * 아직 초기화되지 않은 값을 보게 만들 수 있고, 그 실패는 런타임에만 드러난다.
 * 경고를 읽는 사람에게 맡기지 않고 CI에서 막는다.
 *
 * Biome의 `suspicious/noImportCycles`를 쓰지 않는 이유(2.4.10 기준):
 * - 이 모노레포 설정에서 규칙이 사이클을 검출하지 못한다(의도적으로 심은 사이클로 확인)
 * - 루트 설정에 켜면 project 스캐너가 한글 마크다운에서 패닉한다(biome_markdown_parser)
 * 업스트림이 해결되면 이 스크립트를 규칙으로 교체한다.
 *
 * **타입 전용 import는 컴파일 후 사라지므로 런타임 사이클을 만들지 않는다.**
 * 단, 같은 모듈에서 타입과 값을 함께 가져올 수 있다(`import type {T}` + `import {v}`).
 * 그래서 모듈 단위가 아니라 **구문 단위**로 판정한다. 모듈 단위로 뭉개면 값 의존성을
 * 통째로 놓쳐 사이클을 못 잡는다 — 지키는 게 없는 초록불이 된다.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['src', 'app'];
const EXTENSIONS = ['.tsx', '.ts'];
const ALIASES = { '@src/': 'src/', '@/': 'app/' };

/** `import ... from 'x'` / `export ... from 'x'` — 바인딩 절을 1번 그룹으로 잡는다. */
const BINDING_STATEMENT = /\b(?:import|export)\s+([^;'"]*?)\s*from\s*['"]([^'"]+)['"]/gs;
/** `import 'x'`(부수효과)와 `require('x')` — 언제나 런타임 엣지다. */
const SIDE_EFFECT_STATEMENT = /\bimport\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

const isTestFile = (path) => path.includes('__tests__') || /\.test\.tsx?$/.test(path);

/**
 * 주석을 제거한다. 문자열·템플릿 리터럴 안의 `//`는 주석이 아니므로 따옴표를 추적한다.
 *
 * 이게 없으면 주석에 적어둔 예시 import가 진짜 의존성으로 둔갑해 없는 사이클을 만든다.
 */
function stripComments(source) {
  let output = '';
  let quote = null;
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (char === '\\') {
        output += char + (next ?? '');
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      output += char;
      index += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 2;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    }
    output += char;
    index += 1;
  }

  return output;
}

/**
 * 이 구문이 컴파일 후 사라지는가?
 *
 * - `import type { T } from 'x'`         → 사라진다
 * - `export type { T } from 'x'`         → 사라진다
 * - `import { type A, type B } from 'x'` → 지정자가 전부 type이면 사라진다
 * - `import { type A, b } from 'x'`      → `b`가 남으므로 런타임 엣지다
 */
function isTypeOnlyClause(clause) {
  const trimmed = clause.trim();
  if (trimmed === 'type' || trimmed.startsWith('type ') || trimmed.startsWith('type{')) {
    return true;
  }

  const braces = trimmed.match(/^\{([^}]*)\}$/);
  if (!braces) {
    return false;
  }

  const specifiers = braces[1]
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean);

  return specifiers.length > 0 && specifiers.every((specifier) => specifier.startsWith('type '));
}

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !isTestFile(path));
}

/** 임포트 지정자를 실제 파일 경로로 해석한다. 외부 패키지는 undefined. */
function resolveSpecifier(specifier, fromFile) {
  const alias = Object.keys(ALIASES).find((prefix) => specifier.startsWith(prefix));

  let base;
  if (alias) {
    base = join(ROOT, ALIASES[alias], specifier.slice(alias.length));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return undefined;
  }

  const candidates = [
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];

  return candidates.find((candidate) => {
    try {
      readFileSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
}

/** 한 파일이 런타임에 실제로 끌어오는 모듈들. */
function runtimeDependencies(file) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const specifiers = new Set();

  for (const [, clause, specifier] of source.matchAll(BINDING_STATEMENT)) {
    if (!isTypeOnlyClause(clause)) {
      specifiers.add(specifier);
    }
  }

  for (const [, bare, required] of source.matchAll(SIDE_EFFECT_STATEMENT)) {
    specifiers.add(bare ?? required);
  }

  const dependencies = new Set();
  for (const specifier of specifiers) {
    const target = resolveSpecifier(specifier, file);
    if (target && target !== file) {
      dependencies.add(target);
    }
  }

  return dependencies;
}

/** Tarjan 대신 DFS + 스택 — 사이클 경로를 그대로 보여주기 위해. */
function findCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const stack = [];
  const onStack = new Set();

  const visit = (node) => {
    visited.add(node);
    stack.push(node);
    onStack.add(node);

    for (const next of [...(graph.get(node) ?? [])].sort()) {
      if (!visited.has(next)) {
        visit(next);
      } else if (onStack.has(next)) {
        cycles.push([...stack.slice(stack.indexOf(next)), next]);
      }
    }

    stack.pop();
    onStack.delete(node);
  };

  for (const node of [...graph.keys()].sort()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return cycles;
}

const files = (
  await Promise.all(SOURCE_DIRS.map((dir) => collectSourceFiles(join(ROOT, dir))))
).flat();

const graph = new Map(files.map((file) => [file, runtimeDependencies(file)]));
const cycles = findCycles(graph);

if (cycles.length === 0) {
  console.log(`✓ 순환 참조 없음 (${files.length}개 파일)`);
  process.exit(0);
}

console.error(`✗ 순환 참조 ${cycles.length}건\n`);
for (const cycle of cycles) {
  console.error(`  ${cycle.map((path) => path.slice(ROOT.length + 1)).join('\n  → ')}\n`);
}
console.error('사이클은 초기화되지 않은 값을 만든다. 임포트가 한 방향만 향하도록 코드를 옮겨라.');
process.exit(1);
