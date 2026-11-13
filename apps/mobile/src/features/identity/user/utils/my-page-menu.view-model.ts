// 마이페이지에 자기 진입점(친구 초대 카드)이 따로 있는 하위 화면. 상위 항목(친구 관리)을 선택 상태로 만들지 않는다
const STANDALONE_PATHNAMES = ['/friends/invite'];

// 경로가 겹치지 않지만 프로필 화면에서 들어가는 화면. 왼쪽에서 프로필 카드를 선택 상태로 둔다
const PROFILE_PATHNAME = '/settings/profile';
const PROFILE_CHILD_PATHNAMES = [
  '/settings/edit-name',
  '/settings/change-password',
  '/settings/linked-accounts',
];

function isSameOrNestedPathname(currentPathname: string, targetPathname: string): boolean {
  return currentPathname === targetPathname || currentPathname.startsWith(`${targetPathname}/`);
}

export function isMyPageMenuItemSelected(currentPathname: string, targetPathname: string): boolean {
  if (targetPathname === PROFILE_PATHNAME && PROFILE_CHILD_PATHNAMES.includes(currentPathname)) {
    return true;
  }

  if (!isSameOrNestedPathname(currentPathname, targetPathname)) {
    return false;
  }

  return !STANDALONE_PATHNAMES.some(
    (standalonePathname) =>
      standalonePathname.startsWith(`${targetPathname}/`) &&
      isSameOrNestedPathname(currentPathname, standalonePathname),
  );
}
