export type MyPageMenuNavigationMode = 'push' | 'replace';

/** 내 정보 메뉴로 들어가는 화면들. 넓은 화면에서 왼쪽 메뉴가 함께 보이는 `(mypage-menu)` 라우트 그룹과 같다. */
const MENU_DETAIL_ROOT_PATHNAMES = ['/settings', '/friends', '/achievements', '/reports'];

function isMenuDetailPathname(pathname: string): boolean {
  return MENU_DETAIL_ROOT_PATHNAMES.some((root) => isSameOrNestedPathname(pathname, root));
}

/**
 * 왼쪽 메뉴가 이미 함께 보이는 화면에서 고르면 오른쪽 상세만 교체한다(뒤로 가기에 쌓이지 않는다).
 * 내 정보 탭이나 그 밖의 화면에서 들어갈 때는 push한다.
 */
export function getMyPageMenuNavigationMode(currentPathname: string): MyPageMenuNavigationMode {
  return isMenuDetailPathname(currentPathname) ? 'replace' : 'push';
}

interface FocusableNavigationState {
  index?: number;
  routes: readonly { state?: FocusableNavigationState }[];
}

/** 지금 보이는 가장 안쪽 Stack에 첫 화면 위로 쌓인 화면이 있는지 본다. */
export function hasPushedScreen(state: FocusableNavigationState | undefined): boolean {
  if (state == null) {
    return false;
  }
  const focusedIndex = state.index ?? state.routes.length - 1;
  const focusedChild = state.routes[focusedIndex]?.state;

  return focusedChild == null ? focusedIndex > 0 : hasPushedScreen(focusedChild);
}

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

/** 현재 경로가 목록 항목의 화면이거나 그 하위 화면이면 선택된 항목이다. 따로 진입점이 있는 하위 화면은 제외한다. */
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
