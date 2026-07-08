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
 * 타입 전용 import(`import type`)는 컴파일 후 사라지므로 사이클을 만들지 않는다 — 제외한다.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['src', 'app'];
const EXTENSIONS = ['.tsx', '.ts'];
const ALIASES = { '@src/': 'src/', '@/': 'app/' };

const IMPORT_PATTERN = /(?:from|require\()\s*['"]([^'"]+)['"]/g;
const TYPE_IMPORT_PATTERN = /import\s+type\s+[^;]*?from\s*['"]([^'"]+)['"]/gs;

const isTestFile = (path) => path.includes('__tests__') || /\.test\.tsx?$/.test(path);

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !isTestFile(path));
}

/** 임포트 지정자를 실제 파일 경로로 해석한다. 외부 패키지는 null. */
function resolveSpecifier(specifier, fromFile) {
  let base;
  const alias = Object.keys(ALIASES).find((prefix) => specifier.startsWith(prefix));

  if (alias) {
    base = join(ROOT, ALIASES[alias], specifier.slice(alias.length));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
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

function buildGraph(files) {
  const graph = new Map();

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const typeOnly = new Set(
      [...source.matchAll(TYPE_IMPORT_PATTERN)].map(([, specifier]) => specifier),
    );

    const dependencies = new Set();
    for (const [, specifier] of source.matchAll(IMPORT_PATTERN)) {
      if (typeOnly.has(specifier)) {
        continue;
      }
      const target = resolveSpecifier(specifier, file);
      if (target && target !== file) {
        dependencies.add(target);
      }
    }
    graph.set(file, dependencies);
  }

  return graph;
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
const cycles = findCycles(buildGraph(files));

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
