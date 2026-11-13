import { getNowInstant } from '@src/shared/date/clock';
import { type ToastComponentProps, ToastProvider, useToast } from 'heroui-native';
import {
  type ComponentProps,
  createContext,
  type ReactElement,
  type ReactNode,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getToastTopInset } from './get-toast-top-inset';
import { createToastLayers, type ToastLayer, type ToastLayers } from './toast-layers';

export type AppToastRender = (
  toastProps: ToastComponentProps,
  presentation: { isMoved: boolean },
) => ReactElement;

export const ToastLayersContext = createContext<ToastLayers<AppToastRender> | null>(null);

/**
 * 시트 route의 시트가 닫히기 시작하면 부른다(`useSheetRoute`의 닫기·떠나기, 시트의 닫힘 애니메이션 시작).
 * overlay·Portal 안의 시트는 route 시트가 아니라 `OverlayProvider`가 null로 비운다. 시트 route 밖도 null이다
 */
export const ToastLayerClosingContext = createContext<(() => void) | null>(null);

export function ToastLayersProvider({ children }: { children: ReactNode }) {
  const [layers] = useState(() => createToastLayers<AppToastRender>({ now: getNowInstant }));

  return <ToastLayersContext value={layers}>{children}</ToastLayersContext>;
}

/** 루트와 시트 route가 같은 자리·모양으로 토스트를 그린다 */
export function useToastPlacement() {
  const { top: safeAreaTop } = useSafeAreaInsets();

  return {
    insets: { top: getToastTopInset(safeAreaTop, process.env.EXPO_OS) },
    defaultProps: { placement: 'top' },
  } satisfies Pick<ComponentProps<typeof ToastProvider>, 'insets' | 'defaultProps'>;
}

export function ToastLayerRegistration({ isBase = false }: { isBase?: boolean }) {
  useToastLayer({ isBase });

  return null;
}

/**
 * 시트 route 안의 토스트 면. iOS 시트 route는 루트 위에 따로 뜨는 모달이라 루트 토스트가 시트 배경 아래에 깔리고
 * VoiceOver가 읽지 못한다. 모달 안의 보통 View에 시트보다 뒤에 그려 시트 위에 보이게 한다.
 * 시트가 닫히기 시작하면 토스트를 아래 면으로 옮기고 여기 남은 것은 그 자리에서 감춘다. 지우면 퇴장 움직임이 겹쳐 두 번 보인다
 */
export function SheetToastLayer({ children }: { children: ReactNode }) {
  const placement = useToastPlacement();
  const [isClosing, setIsClosing] = useState(false);

  return (
    <ToastProvider
      {...placement}
      disableFullWindowOverlay
      // 감출 때 감싸개를 새로 끼우면 토스트가 다시 마운트돼 퇴장 움직임이 보이므로 늘 같은 감싸개를 두고 모양만 바꾼다
      contentWrapper={(toasts) => (
        <View
          style={[styles.toasts, isClosing && styles.hidden]}
          pointerEvents={isClosing ? 'none' : 'box-none'}
          accessibilityElementsHidden={isClosing}
          importantForAccessibility={isClosing ? 'no-hide-descendants' : 'auto'}
        >
          {toasts}
        </View>
      )}
    >
      <SheetToastLayer.Registration onClosingStart={() => setIsClosing(true)}>
        {/* Android는 형제끼리만 elevation으로 겹침을 정한다. 시트 그림자가 토스트를 덮지 않게 내용을 한 겹으로 묶는다 */}
        <View style={styles.content} collapsable={false}>
          {children}
        </View>
      </SheetToastLayer.Registration>
    </ToastProvider>
  );
}

/** 면을 쌓고, 닫히기 시작하면 새 토스트를 아래 면에 띄우고 보이던 토스트를 그때 옮기게 route 안에 알린다 */
SheetToastLayer.Registration = function Registration({
  onClosingStart,
  children,
}: {
  onClosingStart: () => void;
  children: ReactNode;
}) {
  const { layers, layer } = useToastLayer({ isBase: false });

  return (
    <ToastLayerClosingContext
      value={() => {
        layers?.startClosing(layer);
        onClosingStart();
      }}
    >
      {children}
    </ToastLayerClosingContext>
  );
};

/** heroui가 토스트를 그려 화면에 오른 때를 면 묶음에 알린다. 오르기 전에 옮겨진 토스트는 옮긴 면에서 처음 뜨는 것처럼 움직인다 */
function PresentedToast({
  onPresent,
  children,
}: {
  onPresent: () => void;
  children: ReactElement;
}) {
  useLayoutEffect(onPresent, [onPresent]);

  return children;
}

/**
 * 가장 가까운 heroui ToastProvider를 토스트 면으로 쌓고 그 면을 돌려준다. toaster는 토스트가 바뀔 때마다 새로 만들어져 ref로 읽는다.
 * 걷기는 layout 정리에서 해 토스트 본문이 내려가기 전에 남은 토스트를 아래 면으로 옮긴다
 */
function useToastLayer({ isBase }: { isBase: boolean }) {
  const layers = use(ToastLayersContext);
  const { toast } = useToast();
  const toasterRef = useRef(toast);
  const [layer] = useState<ToastLayer<AppToastRender>>(() => ({
    show: ({ id, render, duration, isMoved, onPresent, onHide }) => {
      toasterRef.current.show({
        id,
        duration,
        onHide,
        component: (toastProps) => (
          <PresentedToast onPresent={onPresent}>{render(toastProps, { isMoved })}</PresentedToast>
        ),
      });
    },
  }));

  useLayoutEffect(() => {
    toasterRef.current = toast;
  });

  useLayoutEffect(() => layers?.add(layer, { isBase }), [layers, layer, isBase]);

  return { layers, layer };
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  toasts: { flex: 1 },
  hidden: { opacity: 0 },
});
