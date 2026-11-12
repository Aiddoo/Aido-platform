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

/**
 * `replace`는 다음 시트 같은 탭 위 route로 바꾼다. `dismiss-to`는 시트와 그 아래 탭 위 화면을 닫고 탭 화면(피드·문의)을
 * 탭 묶음 하나 안에서 연다. 탭 화면으로 `replace`하면 (app) Stack에 탭 묶음이 두 겹 쌓인다
 */
export type SheetRouteExit =
  | { type: 'back' }
  | { type: 'replace'; href: Href }
  | { type: 'dismiss-to'; href: Href };

export interface SheetRouteNavigator {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
  dismissTo: (href: Href) => void;
}

/** 딥링크로 바로 열려 돌아갈 화면이 없으면 fallback으로 바꾼다 */
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
    .with({ type: 'dismiss-to' }, ({ href }) => navigator.dismissTo(href))
    .exhaustive();
}
