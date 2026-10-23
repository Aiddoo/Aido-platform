export type SettingsMenuNavigationMode = 'push' | 'replace';

function isSettingsPathname(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/');
}

/**
 * 설정 화면 안의 목록에서 다른 설정을 고르면 상세를 교체한다(상세가 스택에 쌓이지 않는다).
 * 마이페이지 탭이나 설정 밖 화면으로 가는 항목은 기존처럼 push한다.
 */
export function resolveSettingsMenuNavigation(
  currentPathname: string,
  targetPathname: string,
): SettingsMenuNavigationMode {
  return isSettingsPathname(currentPathname) && isSettingsPathname(targetPathname)
    ? 'replace'
    : 'push';
}

/** 현재 경로가 목록 항목의 화면이거나 그 하위 화면이면 선택된 항목이다. */
export function isSettingsMenuItemSelected(
  currentPathname: string,
  targetPathname: string,
): boolean {
  return currentPathname === targetPathname || currentPathname.startsWith(`${targetPathname}/`);
}
