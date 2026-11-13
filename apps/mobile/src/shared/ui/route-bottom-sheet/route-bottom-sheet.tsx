import type { Href } from 'expo-router';
import { type ComponentProps, type ReactNode, Suspense } from 'react';

import { BottomSheet } from '../bottom-sheet/bottom-sheet';
import { KeyboardBottomSheet } from '../bottom-sheet/keyboard-bottom-sheet';
import type { SheetRouteExit } from '../bottom-sheet/sheet-route';
import { useSheetRoute } from '../bottom-sheet/use-sheet-route';
import { QueryErrorBoundary } from '../query-error-boundary/query-error-boundary';
import { QueryErrorFallback } from '../query-error-boundary/query-error-fallback';

interface RouteSheet {
  isOpen: boolean;
  /** 닫기 애니메이션 뒤 route를 떠난다. 기본은 뒤로, 다음 시트·화면이면 `replace`다 */
  close: (next?: SheetRouteExit) => void;
  /** 애니메이션 없이 바로 떠난다(구독 화면 이동) */
  exit: (next?: SheetRouteExit) => void;
}

interface RouteSheetProps {
  /** 딥링크로 바로 열려 돌아갈 화면이 없을 때 바꿀 화면 */
  fallbackHref: Href;
  /** 대상을 읽는 동안 내용 자리. `.Loading`을 넘긴다 */
  loading: ReactNode;
  children: (sheet: RouteSheet) => ReactNode;
  footer?: (sheet: RouteSheet) => ReactNode;
}

type RouteBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'footer' | 'isOpen' | 'onOpenChange'
> &
  RouteSheetProps;

/** 대상이 있는 시트 route의 껍데기. 대상은 내용이 route 훅으로 읽고, 실패하면 시트를 닫은 뒤 문의 화면으로 바꾼다 */
export function RouteBottomSheet({
  fallbackHref,
  loading,
  children,
  footer,
  ...props
}: RouteBottomSheetProps) {
  const sheet = useSheetRoute(fallbackHref);

  return (
    <BottomSheet
      {...props}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      footer={footer?.(sheet)}
    >
      <RouteSheetBoundary sheet={sheet} loading={loading}>
        {children}
      </RouteSheetBoundary>
    </BottomSheet>
  );
}

type RouteKeyboardBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'footer' | 'isOpen' | 'onOpenChange'
> &
  RouteSheetProps;

/** 입력이 있는 시트 route의 껍데기. 경계와 떠나기는 `RouteBottomSheet`와 같다 */
export function RouteKeyboardBottomSheet({
  fallbackHref,
  loading,
  children,
  footer,
  ...props
}: RouteKeyboardBottomSheetProps) {
  const sheet = useSheetRoute(fallbackHref);

  return (
    <KeyboardBottomSheet
      {...props}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      footer={footer?.(sheet)}
    >
      <RouteSheetBoundary sheet={sheet} loading={loading}>
        {children}
      </RouteSheetBoundary>
    </KeyboardBottomSheet>
  );
}

interface RouteSheetBoundaryProps {
  sheet: RouteSheet;
  loading: ReactNode;
  children: (sheet: RouteSheet) => ReactNode;
}

function RouteSheetBoundary({ sheet, loading, children }: RouteSheetBoundaryProps) {
  return (
    <QueryErrorBoundary
      fallback={({ reset }) => (
        <QueryErrorFallback
          reset={reset}
          onInquiry={(href) => sheet.close({ type: 'dismiss-to', href })}
        />
      )}
    >
      <Suspense fallback={loading}>{children(sheet)}</Suspense>
    </QueryErrorBoundary>
  );
}
