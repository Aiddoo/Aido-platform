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

// 마이페이지에 자기 진입점(친구 초대 카드)이 따로 있는 하위 화면. 상위 항목(친구 관리)을 선택 상태로 만들지 않는다
const STANDALONE_PATHNAMES = ['/friends/invite'];

function isSameOrNestedPathname(currentPathname: string, targetPathname: string): boolean {
  return currentPathname === targetPathname || currentPathname.startsWith(`${targetPathname}/`);
}

/** 현재 경로가 목록 항목의 화면이거나 그 하위 화면이면 선택된 항목이다. 따로 진입점이 있는 하위 화면은 제외한다. */
export function isSettingsMenuItemSelected(
  currentPathname: string,
  targetPathname: string,
): boolean {
  if (!isSameOrNestedPathname(currentPathname, targetPathname)) {
    return false;
  }

  return !STANDALONE_PATHNAMES.some(
    (standalonePathname) =>
      standalonePathname.startsWith(`${targetPathname}/`) &&
      isSameOrNestedPathname(currentPathname, standalonePathname),
  );
}
