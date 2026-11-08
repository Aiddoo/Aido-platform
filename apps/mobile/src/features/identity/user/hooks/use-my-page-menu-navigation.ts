import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router, usePathname, useRootNavigationState } from 'expo-router';

import {
  hasPushedScreen,
  isMyPageMenuItemSelected,
  getMyPageMenuNavigationMode,
} from '../utils/my-page-menu-navigation';

export type MyPageMenuPathname = Extract<Href, string>;

export function useMyPageMenuNavigation() {
  const currentPathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const push = useSingleTap(router.push);
  const replaceDetail = useSingleTap((target: Href) => {
    // 첫 화면에서 걷으면 메뉴 화면까지 닫혀 상세 안의 화면만 먼저 걷어 낸다
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
