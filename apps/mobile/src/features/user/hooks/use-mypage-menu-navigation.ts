import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router, usePathname } from 'expo-router';

import {
  isSettingsMenuItemSelected,
  resolveSettingsMenuNavigation,
} from '../utils/settings-menu-navigation';

export type MyPageMenuPathname = Extract<Href, string>;

/** 마이페이지 목록 항목의 이동 방식(push/replace)과 선택 여부를 현재 경로로 정한다. */
export function useMyPageMenuNavigation() {
  const currentPathname = usePathname();
  const push = useSingleTap(router.push);
  const replace = useSingleTap(router.replace);

  const navigate = (targetPathname: MyPageMenuPathname) => {
    if (resolveSettingsMenuNavigation(currentPathname, targetPathname) === 'replace') {
      replace(targetPathname);
      return;
    }
    push(targetPathname);
  };

  const isSelected = (targetPathname: MyPageMenuPathname) =>
    isSettingsMenuItemSelected(currentPathname, targetPathname);

  return { navigate, isSelected };
}
