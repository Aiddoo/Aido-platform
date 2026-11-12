import { type Href, router } from 'expo-router';

/** expo-router 58의 `router`가 실행 때 갖고 있지만 공개 타입(`ImperativeRouter`)에는 없는 이동 */
interface EntryLinkRouter {
  linkTo(href: Href, options: { event: 'NAVIGATE'; __internal__popToNavigator: true }): void;
}

function canLinkLikeOs(value: object): value is EntryLinkRouter {
  return 'linkTo' in value && typeof value.linkTo === 'function';
}

/**
 * 앱 밖에서 들어온 이동(앱이 켜져 있을 때 누른 푸시)을 OS가 같은 URL을 연 것처럼 연다.
 * Stack에 그 화면이 있으면 그리로 돌아가고 없으면 쌓아, 탭 위 화면에서 열어도 탭 묶음이 두 겹이 되지 않는다
 */
export function openEntryHref(href: Href): void {
  // OS 링크와 같은 NAVIGATE+pop. expo-router 58 공개 API에 없다: dismissTo는 없으면 바꿔 끼우고, dangerouslySingular는 순서만 바꾸고, withAnchor는 새 navigator에만 듣는다
  if (canLinkLikeOs(router)) {
    router.linkTo(href, { event: 'NAVIGATE', __internal__popToNavigator: true });
    return;
  }
  // SDK가 이 이동을 없애도 화면은 연다. 겹침을 막는 동작은 open-entry-href.test가 잡는다
  router.navigate(href);
}
