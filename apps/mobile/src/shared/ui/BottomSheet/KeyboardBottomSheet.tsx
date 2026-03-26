import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  type ComponentRef,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  AppState,
  type AppStateStatus,
  Keyboard,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useKeyboardContext } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';

const SHEET_INDEX = {
  CLOSED: -1,
  OPEN: 0,
} as const;

const MIN_CONTENT_HEIGHT = 280;
const TOP_MARGIN = 24;

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 시트 닫기 애니메이션 시작 시 호출 (backdrop 탭, 스와이프 등) */
  onCloseStart?: () => void;
  children: ReactNode;
}

/**
 * 키보드 연동 BottomSheet.
 */
export const KeyboardBottomSheet = ({
  isOpen,
  onOpenChange,
  onCloseStart,
  children,
}: KeyboardBottomSheetProps) => {
  const { setEnabled } = useKeyboardContext();
  const sheetRef = useRef<ComponentRef<typeof GorhomBottomSheet> | null>(null);
  const lastContentHeightRef = useRef(0);
  const isClosingRef = useRef(false);
  const hasNotifiedCloseRef = useRef(false);
  const prevIsOpenRef = useRef(isOpen);
  const closeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');
  const maxDynamicContentSize = Math.max(
    MIN_CONTENT_HEIGHT,
    windowHeight - insets.top - TOP_MARGIN,
  );

  useLayoutEffect(() => {
    setEnabled(!isOpen);
    return () => setEnabled(true);
  }, [isOpen, setEnabled]);

  useEffect(() => {
    if (!isOpen) return;

    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      if (isClosingRef.current) return;

      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
      });
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' && !isClosingRef.current) {
          Keyboard.dismiss();
        }
      },
    );

    return () => {
      hideSubscription.remove();
      appStateSubscription.remove();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      lastContentHeightRef.current = 0;
      isClosingRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!sheetRef.current || wasOpen === isOpen) {
      return;
    }

    if (isOpen) {
      isClosingRef.current = false;
      hasNotifiedCloseRef.current = false;
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
      });
      return;
    }

    isClosingRef.current = true;
    hasNotifiedCloseRef.current = false;
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      sheetRef.current?.close();
    });
  }, [isOpen]);

  const handleAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex === SHEET_INDEX.CLOSED) {
      isClosingRef.current = true;
      Keyboard.dismiss();
      onCloseStart?.();
    }
  };

  const handleSheetChange = (index: number) => {
    if (index === SHEET_INDEX.CLOSED) {
      if (closeRetryTimerRef.current) {
        clearTimeout(closeRetryTimerRef.current);
        closeRetryTimerRef.current = null;
      }
      if (!hasNotifiedCloseRef.current) {
        hasNotifiedCloseRef.current = true;
        onOpenChange(false);
      }
      isClosingRef.current = false;
      return;
    }

    hasNotifiedCloseRef.current = false;
    isClosingRef.current = false;
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={SHEET_INDEX.CLOSED}
        appearsOnIndex={SHEET_INDEX.OPEN}
        opacity={0.5}
        pressBehavior={'override' as 'none'}
        onPress={() => {
          isClosingRef.current = true;
          Keyboard.dismiss();
          sheetRef.current?.forceClose();
          // 열기 애니메이션과 충돌 시 재시도
          if (closeRetryTimerRef.current) {
            clearTimeout(closeRetryTimerRef.current);
          }
          closeRetryTimerRef.current = setTimeout(() => {
            closeRetryTimerRef.current = null;
            if (isClosingRef.current) {
              sheetRef.current?.forceClose();
            }
          }, 500);
        }}
      />
    ),
    [],
  );

  const handleContentLayout = (event: LayoutChangeEvent) => {
    if (!isOpen || isClosingRef.current) {
      return;
    }

    const nextHeight = Math.round(event.nativeEvent.layout.height);
    const prevHeight = lastContentHeightRef.current;

    if (Math.abs(nextHeight - prevHeight) < 2) {
      return;
    }

    lastContentHeightRef.current = nextHeight;
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
    });
  };

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      index={isOpen ? SHEET_INDEX.OPEN : SHEET_INDEX.CLOSED}
      enableDynamicSizing
      maxDynamicContentSize={maxDynamicContentSize}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustPan"
      topInset={insets.top}
      backgroundStyle={[backgroundStyle, { borderRadius: 32 }]}
      handleIndicatorStyle={[styles.handleIndicator, handleIndicatorStyle]}
      backdropComponent={renderBackdrop}
      onAnimate={handleAnimate}
      onChange={handleSheetChange}
    >
      <BottomSheetView
        onLayout={handleContentLayout}
        style={[styles.content, { paddingBottom: (insets.bottom || 20) + 4 }]}
      >
        {children}
      </BottomSheetView>
    </GorhomBottomSheet>
  );
};

const styles = StyleSheet.create({
  handleIndicator: {
    width: 36,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
});
