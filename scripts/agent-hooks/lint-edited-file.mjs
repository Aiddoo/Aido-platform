// Claude Code PostToolUse hook: 서버·공유 계약·모바일 파일을 고친 직후 oxlint로 lint와 관례(aido 플러그인)를 검사한다.
// 위반이면 stderr에 내고 exit 2로 Claude에게 되돌린다. 대상이 아니거나 통과면 exit 0이다.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TARGET = /^(?:(?:apps|packages)\/api\/src\/.+\.ts|apps\/mobile\/(?:src|app)\/.+\.tsx?)$/;

function readFilePath() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const filePath = input?.tool_input?.file_path;
    return typeof filePath === 'string' ? filePath : null;
  } catch {
    return null;
  }
}

// 3초 안에 끝낸다. 시간 초과·실행 오류는 통과로 본다.
const TIMEOUT_MS = 3000;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', timeout: TIMEOUT_MS });
  return {
    ok: result.status === 0 || result.error != null,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

const filePath = readFilePath();
if (filePath == null) {
  process.exit(0);
}

const absolute = isAbsolute(filePath) ? filePath : resolve(repoRoot, filePath);
const rel = relative(repoRoot, absolute).split(sep).join('/');
if (!TARGET.test(rel) || !existsSync(absolute)) {
  process.exit(0);
}

const lint = run(join(repoRoot, 'node_modules/.bin/oxlint'), [rel]);
if (!lint.ok) {
  console.error(`${rel} 검사 실패. 고친 뒤 다시 저장한다.\n${lint.output}`);
  process.exit(2);
}
