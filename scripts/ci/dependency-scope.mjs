/** Unknown/root inputs deliberately invalidate every scope; a failed diff passes null. */
export function dependencyScope(paths) {
  const scope = { api: false, mobile: false, shared: false };
  if (paths === null) return { api: true, mobile: true, shared: true };
  for (const path of paths) {
    if (
      /\.(md|mdx)$/.test(path) ||
      path.startsWith('docs/') ||
      path.startsWith('.github/ISSUE_TEMPLATE/')
    )
      continue;
    if (
      path.startsWith('apps/api/') ||
      path.startsWith('tooling/database-migrate/') ||
      path === '.dockerignore' ||
      path === 'docker-compose.prod.yml' ||
      path.startsWith('scripts/deploy')
    )
      scope.api = true;
    else if (path.startsWith('apps/mobile/')) scope.mobile = true;
    else if (path.startsWith('packages/errors/') || path.startsWith('packages/validators/')) {
      scope.api = true;
      scope.mobile = true;
      scope.shared = true;
    } else return { api: true, mobile: true, shared: true };
  }
  return scope;
}
