import { ToastProvider, useToast } from 'heroui-native';
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
import { createToastLayers, type ToastLayers } from './toast-layers';

type Toaster = ReturnType<typeof useToast>['toast'];
type ToastComponent = Extract<Parameters<Toaster['show']>[0], { component: unknown }>['component'];
type ToastComponentProps = Parameters<ToastComponent>[0];

export type AppToastRender = (
  toastProps: ToastComponentProps,
  presentation: { isMoved: boolean },
) => ReactElement;

export const ToastLayersContext = createContext<ToastLayers<AppToastRender> | null>(null);

export function ToastLayersProvider({ children }: { children: ReactNode }) {
  const [layers] = useState(() => createToastLayers<AppToastRender>({ now: Date.now }));

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

/**
 * 가장 가까운 heroui ToastProvider를 토스트 면으로 쌓는다. toaster는 토스트가 바뀔 때마다 새로 만들어져 ref로 읽는다.
 * 걷기는 layout 정리에서 해 토스트 본문이 내려가기 전에 남은 토스트를 아래 면으로 옮긴다
 */
export function ToastLayerRegistration({ isBase = false }: { isBase?: boolean }) {
  const layers = use(ToastLayersContext);
  const { toast } = useToast();
  const toasterRef = useRef(toast);

  useLayoutEffect(() => {
    toasterRef.current = toast;
  });

  useLayoutEffect(
    () =>
      layers?.add(
        {
          show: ({ id, render, duration, isMoved, onHide }) => {
            toasterRef.current.show({
              id,
              duration,
              onHide,
              component: (toastProps) => render(toastProps, { isMoved }),
            });
          },
        },
        { isBase },
      ),
    [layers, isBase],
  );

  return null;
}

/**
 * 시트 route 안의 토스트 면. iOS 시트 route는 루트 위에 따로 뜨는 모달이라 루트 토스트가 시트 배경 아래에 깔리고
 * VoiceOver가 읽지 못한다. 모달 안의 보통 View에 시트보다 뒤에 그려 시트 위에 보이게 한다
 */
export function SheetToastLayer({ children }: { children: ReactNode }) {
  const placement = useToastPlacement();

  return (
    <ToastProvider {...placement} disableFullWindowOverlay>
      {/* Android는 형제끼리만 elevation으로 겹침을 정한다. 시트 그림자가 토스트를 덮지 않게 내용을 한 겹으로 묶는다 */}
      <View style={styles.content} collapsable={false}>
        {children}
      </View>
      <ToastLayerRegistration />
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
