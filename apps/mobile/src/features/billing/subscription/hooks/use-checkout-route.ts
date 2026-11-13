import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { dismissToTab } from '@src/shared/navigation/open-entry-href';
import { type Href, router, usePathname } from 'expo-router';

/** 업셀에서 연 결제 모달. 마이 탭 구독 관리(`/settings/subscription`)와 같은 화면을 지금 맥락 위에 띄운다 */
const PAYWALL_PATHNAME = '/paywall';
const SUBSCRIPTION_PATHNAME = '/settings/subscription';

/** 결제 흐름이 모달인지 마이 탭 화면인지에 따라 같은 화면 안 이동과 흐름 밖으로 떠나는 방법을 고른다 */
export function useCheckoutRoute() {
  const isModal = usePathname() === PAYWALL_PATHNAME;
  const pathname = isModal ? PAYWALL_PATHNAME : SUBSCRIPTION_PATHNAME;
  // 모달은 닫고 아래 보던 탭에서 연다(탭을 새로 쌓지 않는다). 탭 안 구독 화면은 그 Stack에 이어 연다
  const leaveTo = useSingleTap((href: Href) => {
    if (isModal) {
      dismissToTab(href);
      return;
    }
    router.push(href);
  });

  return [pathname, leaveTo] as const;
}
