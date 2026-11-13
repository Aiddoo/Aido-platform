// 생성기 smoke: 임시 worktree에 serial·cuid slice를 하나씩 만들고 서버 검사(lint·이름·typecheck·경계·단위 테스트)를 돈다.
// 템플릿이 import하는 공용 코드가 바뀌어도 생성 결과는 조용히 깨지므로 생성기를 바꿀 때 pre-push가 돌린다.
// 사용: pnpm test:generator
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const work = join(mkdtempSync(join(tmpdir(), 'aido-generator-')), 'repo');
const run = (args, cwd = work) => execFileSync(args[0], args.slice(1), { cwd, stdio: 'inherit' });

run(['git', 'worktree', 'add', '--detach', work, 'HEAD'], root);
try {
  // 훅 설치·패키지 빌드 postinstall을 건너뛰고 아래에서 계약만 빌드한다.
  run([
    'pnpm',
    'install',
    '--frozen-lockfile',
    '--prefer-offline',
    '--ignore-scripts',
    '--filter=@aido/server...',
    '--filter=@aido/monorepo',
  ]);
  run([
    'pnpm',
    'exec',
    'turbo',
    'gen',
    'api-slice',
    '--args',
    'notes',
    'drafts',
    'draft',
    'serial',
  ]);
  run(['pnpm', 'exec', 'turbo', 'gen', 'api-slice', '--args', 'notes', 'pins', 'pin', 'cuid']);
  run(['pnpm', '--filter', '@aido/api', 'build']);
  run(['pnpm', 'exec', 'oxlint', 'apps/api', 'packages/api']);
  run(['pnpm', 'exec', 'ls-lint']);
  run(['pnpm', '--filter', '@aido/server', 'typecheck']);
  run(['pnpm', '--filter', '@aido/server', 'lint:deps']);
  run([
    'pnpm',
    '--filter',
    '@aido/server',
    'exec',
    'vitest',
    'run',
    '--project',
    'unit',
    'src/modules/notes/drafts',
    'src/modules/notes/pins',
  ]);
} finally {
  run(['git', 'worktree', 'remove', '--force', work], root);
}
