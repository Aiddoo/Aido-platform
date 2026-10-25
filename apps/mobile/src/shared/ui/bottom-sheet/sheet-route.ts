import type { Href, NativeStackNavigationOptions } from 'expo-router';
import { match } from 'ts-pattern';

/** 시트 route는 아래 화면을 그대로 두고, 등장·퇴장 애니메이션은 gorhom 시트가 맡는다. */
export const SHEET_ROUTE_SCREEN_OPTIONS = {
  presentation: 'transparentModal',
  animation: 'none',
  headerShown: false,
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const satisfies NativeStackNavigationOptions;

export type SheetRouteExit =
  | { type: 'back' }
  | { type: 'replace'; href: Href }
  | { type: 'back-then-replace'; href: Href };

export interface SheetRouteNavigator {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
}

/** 시트가 닫힌 뒤 route를 떠난다. 딥링크로 바로 열려 돌아갈 화면이 없으면 fallback으로 바꾼다. */
export function exitSheetRoute(
  navigator: SheetRouteNavigator,
  exit: SheetRouteExit,
  fallbackHref: Href,
) {
  match(exit)
    .with({ type: 'back' }, () => {
      if (navigator.canGoBack()) {
        navigator.back();
        return;
      }
      navigator.replace(fallbackHref);
    })
    .with({ type: 'replace' }, ({ href }) => navigator.replace(href))
    .with({ type: 'back-then-replace' }, ({ href }) => {
      if (navigator.canGoBack()) {
        navigator.back();
      }
      navigator.replace(href);
    })
    .exhaustive();
}
