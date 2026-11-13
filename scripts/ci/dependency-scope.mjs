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
