/**
 * Maestro E2E 실행 입구. `pnpm e2e`, `pnpm e2e:smoke`, `pnpm e2e:feature <태그>`가 부른다.
 *
 * 1. `.maestro/.env.maestro`를 읽어 MAESTRO_* 값을 Maestro에 넘긴다. Maestro가 shell 변수로 읽어 비밀번호가 명령줄에 남지 않는다.
 * 2. second 계정이 있으면 초대 흐름을 다시 돌릴 수 있게 `accounts.ts reset`을 먼저 부른다.
 * 3. 결과·HTML 보고서는 git이 무시하는 `maestro-output/<시각>/`에 모은다.
 *
 * 나머지 인자는 `maestro test`에 그대로 넘긴다. 예: `pnpm e2e --device <udid>`, `pnpm e2e:feature category`
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = resolve(WORKSPACE_DIR, '..', 'maestro-output');
const ENV_FILE = join(WORKSPACE_DIR, '.env.maestro');
const DEFAULT_ENV = {
  MAESTRO_APP_ID: 'com.aido.mobile.dev',
  MAESTRO_APP_SCHEME: 'aido-dev',
  MAESTRO_API_URL: 'http://localhost:8080',
  MAESTRO_METRO_URL: 'http://localhost:8081',
} as const;

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}
for (const [key, value] of Object.entries(DEFAULT_ENV)) {
  process.env[key] ??= value;
}

if (process.env.MAESTRO_SECOND_EMAIL) {
  const reset = spawnSync('node', [join(WORKSPACE_DIR, 'scripts', 'accounts.ts'), 'reset'], {
    stdio: 'inherit',
  });
  if (reset.status !== 0) {
    process.stderr.write(
      '[e2e] 계정 초기화에 실패했습니다. 초대 흐름은 수락 기록이 남아 있으면 실패합니다.\n',
    );
  }
}

const outputDir = join(OUTPUT_ROOT, new Date().toISOString().replace(/[:.]/g, '-'));
const result = spawnSync(
  'maestro',
  [
    'test',
    '--test-output-dir',
    outputDir,
    '--format',
    'HTML',
    '--output',
    join(outputDir, 'report.html'),
    ...process.argv.slice(2),
    WORKSPACE_DIR,
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
