import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router, usePathname, useRootNavigationState } from 'expo-router';

import {
  hasPushedScreen,
  isMyPageMenuItemSelected,
  getMyPageMenuNavigationMode,
} from '../utils/my-page-menu-navigation';

export type MyPageMenuPathname = Extract<Href, string>;

/** 마이페이지 목록 항목의 이동 방식(push/replace)과 선택 여부를 현재 경로로 정한다. */
export function useMyPageMenuNavigation() {
  const currentPathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const push = useSingleTap(router.push);
  const replaceDetail = useSingleTap((target: Href) => {
    // 상세 안에서 더 들어간 화면이 뒤로 가기에 남지 않게 먼저 걷어 낸다. 첫 화면에서 걷으면 메뉴 화면까지 닫힌다
    if (hasPushedScreen(rootNavigationState)) {
      router.dismissAll();
    }
    router.replace(target);
  });

  const navigate = (target: Href) => {
    if (currentPathname === (typeof target === 'string' ? target : target.pathname)) {
      return;
    }
    if (getMyPageMenuNavigationMode(currentPathname) === 'replace') {
      replaceDetail(target);
      return;
    }
    push(target);
  };

  const isSelected = (targetPathname: MyPageMenuPathname) =>
    isMyPageMenuItemSelected(currentPathname, targetPathname);

  return { navigate, isSelected };
}
