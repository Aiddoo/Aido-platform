// CI 범위: 변경 파일로 서버·모바일·공유 계약·문서 중 무엇을 검증할지 정한다. 배포 범위에는 turbo가 모르는
// 패키지 밖 파일(prod compose·deploy 스크립트·.dockerignore)이 들어간다.
// 사용: node scripts/ci/dependency-scope.mjs <base> <head> >> "$GITHUB_OUTPUT"
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isDocumentation = (path) =>
  /\.(md|mdx)$/.test(path) ||
  path.startsWith('docs/') ||
  path.startsWith('.github/ISSUE_TEMPLATE/');

/** Unknown/root inputs deliberately invalidate every scope; a failed diff passes null. */
export function dependencyScope(paths) {
  const scope = { api: false, mobile: false, shared: false };
  if (paths === null) {
    return { api: true, mobile: true, shared: true };
  }
  for (const path of paths) {
    if (isDocumentation(path)) {
      continue;
    }
    if (
      path.startsWith('apps/api/') ||
      path.startsWith('tooling/database-migrate/') ||
      path === '.dockerignore' ||
      path === 'docker-compose.prod.yml' ||
      path.startsWith('scripts/deploy')
    ) {
      scope.api = true;
    } else if (path.startsWith('apps/mobile/')) {
      scope.mobile = true;
    } else if (path.startsWith('packages/api/')) {
      scope.api = true;
      scope.mobile = true;
      scope.shared = true;
    } else {
      return { api: true, mobile: true, shared: true };
    }
  }
  return scope;
}

/** Docs are outside every dependency scope, so a docs-only diff needs its own light check. */
export function touchesDocumentation(paths) {
  return paths !== null && paths.some(isDocumentation);
}

// 비교 기준이 없거나(수동 실행·새 브랜치 push) diff가 실패하면 null을 돌려 전체 범위로 검증한다.
function changedPaths(base, head) {
  if (base == null || base === '' || /^0+$/.test(base)) {
    return null;
  }
  try {
    return execFileSync('git', ['diff', '--name-only', '-z', base, head], { encoding: 'utf8' })
      .split('\0')
      .filter((path) => path !== '');
  } catch {
    process.stderr.write('::warning::변경 파일을 구하지 못해 전체 범위로 검증한다\n');
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = changedPaths(process.argv[2], process.argv[3]);
  const scope = { ...dependencyScope(paths), docs: touchesDocumentation(paths) };
  process.stdout.write(
    `${Object.entries(scope)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`,
  );
}
