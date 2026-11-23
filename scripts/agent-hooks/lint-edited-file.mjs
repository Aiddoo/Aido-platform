// Claude Code PostToolUse hook: 서버·공유 계약·모바일 파일을 고친 직후 oxlint로 lint와 관례(aido 플러그인)를 검사한다.
// 위반이면 stderr에 내고 exit 2로 Claude에게 되돌린다. 대상이 아니거나 통과면 exit 0이다.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const TARGET = /^(?:(?:apps|packages)\/api\/src\/.+\.tsx?|apps\/mobile\/(?:src|app)\/.+\.tsx?)$/;

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

function run(command, commandArguments) {
  const result = spawnSync(command, commandArguments, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  return {
    ok: result.status === 0 || result.error != null,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

const filePath = readFilePath();
if (filePath == null) {
  process.exit(0);
}

const absolute = isAbsolute(filePath) ? filePath : resolve(repositoryRoot, filePath);
const relativePath = relative(repositoryRoot, absolute).split(sep).join('/');
if (!TARGET.test(relativePath) || !existsSync(absolute)) {
  process.exit(0);
}

const lint = run(join(repositoryRoot, 'node_modules/.bin/oxlint'), [relativePath]);
if (!lint.ok) {
  console.error(`${relativePath} 검사 실패. 고친 뒤 다시 저장한다.\n${lint.output}`);
  process.exit(2);
}
