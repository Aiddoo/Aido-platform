export interface MyPageDetailRootStore {
  /** 넓은 화면 메뉴가 쌓인 상세를 걷고 새 첫 상세를 열기 직전에 부른다 */
  request(pathname: string): void;
  /** 같은 경로를 더 깊이 다시 열 때 첫 상세로 잘못 보지 않게 이동이 반영된 뒤 지운다 */
  clear(): void;
  getRequestedPathname(): string | null;
}

/**
 * 메뉴가 쌓인 화면을 걷고 바로 연 화면의 경로. 걷기와 열기가 한 번에 반영돼 Stack 옵션을 처음 계산할 때는 걷기 전 상태만 보인다.
 * Stack `screenOptions` 콜백이 렌더 밖에서 읽어 구독은 두지 않는다
 */
export function createMyPageDetailRootStore(): MyPageDetailRootStore {
  let requestedPathname: string | null = null;

  return {
    request: (pathname) => {
      requestedPathname = pathname;
    },
    clear: () => {
      requestedPathname = null;
    },
    getRequestedPathname: () => requestedPathname,
  };
}
