import { type Href, router } from 'expo-router';

import { toSelectedTabPath } from './selected-tab-path';

type HrefObject = Extract<Href, object>;

/** 탭 그룹을 붙인 href. 그룹 경로는 typed routes 밖이라 `linkTo`로만 연다 */
type SelectedTabHref = string | (Omit<HrefObject, 'pathname'> & { pathname: string });

/** expo-router 58의 `router`가 실행 때 갖고 있지만 공개 타입(`ImperativeRouter`)에는 없는 이동 */
interface EntryLinkRouter {
  linkTo(
    href: SelectedTabHref,
    options:
      | { event: 'NAVIGATE'; __internal__popToNavigator: true }
      | { event: 'POP_TO'; withAnchor?: boolean },
  ): void;
}

function canLinkLikeOs(value: object): value is EntryLinkRouter {
  return 'linkTo' in value && typeof value.linkTo === 'function';
}

function toSelectedTabHref(href: Href): SelectedTabHref {
  if (typeof href === 'string') {
    return toSelectedTabPath(href);
  }
  return { ...href, pathname: toSelectedTabPath(href.pathname) };
}

/**
 * 앱 밖에서 들어온 이동(앱이 켜져 있을 때 누른 푸시·위젯)을 OS가 같은 URL을 연 것처럼 연다.
 * Stack에 그 화면이 있으면 그리로 돌아가고 없으면 쌓아, 탭 위 화면에서 열어도 탭 묶음이 두 겹이 되지 않는다.
 * 함께 쓰는 화면은 시트·탭 위 화면 아래에서 보던 탭에 연다
 */
export function openEntryHref(href: Href): void {
  // OS 링크와 같은 NAVIGATE+pop. expo-router 58 공개 API에 없다: dismissTo는 없으면 바꿔 끼우고, dangerouslySingular는 순서만 바꾸고, withAnchor는 새 navigator에만 듣는다
  if (canLinkLikeOs(router)) {
    router.linkTo(toSelectedTabHref(href), { event: 'NAVIGATE', __internal__popToNavigator: true });
    return;
  }
  // SDK가 이 이동을 없애도 화면은 연다. 겹침을 막는 동작은 open-entry-href.test가 잡는다
  router.navigate(href);
}

/**
 * 탭 밖 화면(시트·결제 모달·초대 카드·탭 위 상세)을 닫고 탭 화면으로 떠난다(`router.dismissTo`).
 * 함께 쓰는 화면은 그 아래 보던 탭에 열고, 탭 묶음이 없으면(카드로 앱을 열었을 때) 화면을 가진 탭에 연다
 */
export function dismissToTab(href: Href, options?: { withAnchor?: boolean }): void {
  // 그룹을 붙인 경로는 typed routes에 없어 공개 dismissTo 대신 같은 POP_TO를 linkTo로 보낸다
  if (canLinkLikeOs(router)) {
    router.linkTo(toSelectedTabHref(href), { event: 'POP_TO', ...options });
    return;
  }
  router.dismissTo(href, options);
}
