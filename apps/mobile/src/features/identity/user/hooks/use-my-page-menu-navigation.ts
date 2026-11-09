import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { type Href, router, usePathname } from 'expo-router';

import { isMyPageMenuItemSelected } from '../utils/my-page-menu-navigation';

export type MyPageMenuPathname = Extract<Href, string>;

export function useMyPageMenuNavigation() {
  const currentPathname = usePathname();
  const isCompact = useWindowSizeClass() === 'compact';
  const push = useSingleTap(router.push);
  const showInDetailPane = useSingleTap((target: Href) => {
    // 오른쪽 칸을 고른 메뉴 하나로 바꾼다. 그 안에서 더 들어간 화면이 뒤로 가기에 남지 않게 먼저 걷어 낸다
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.push(target);
  });

  const navigate = (target: Href) => {
    if (currentPathname === (typeof target === 'string' ? target : target.pathname)) {
      return;
    }
    if (isCompact) {
      push(target);
      return;
    }
    showInDetailPane(target);
  };

  const isSelected = (targetPathname: MyPageMenuPathname) =>
    isMyPageMenuItemSelected(currentPathname, targetPathname);

  return { navigate, isSelected };
}
