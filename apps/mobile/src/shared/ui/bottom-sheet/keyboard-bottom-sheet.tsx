import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import {
  type ComponentRef,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  type AppStateStatus,
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useKeyboardContext } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useResolveClassNames } from 'uniwind';

import { HANDLE_HEIGHT, SHEET_INDEX } from './constants';
import { getSheetMaxHeight } from './get-sheet-layout';
import { useAndroidSheetBackHandler } from './use-android-sheet-back-handler';
import { useSheetLayout } from './use-sheet-layout';

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 시트 닫기 애니메이션 시작 시 호출 (backdrop 탭, 스와이프 등) */
  onCloseStart?: () => void;
  children: ReactNode;
  /** 내용이 길어 스크롤돼도 시트 아래(키보드 위)에 고정되는 영역. 주 동작 버튼을 둔다. */
  footer?: ReactNode;
}

/**
 * 키보드 연동 BottomSheet.
 *
 * 내용은 스크롤된다. 내용이 짧으면 시트가 그 높이에 맞춰 줄어들지만(enableDynamicSizing),
 * 키보드가 올라온 채로 내용이 길어지면 시트만으로는 아래쪽에 손이 닿지 않기 때문이다.
 * keyboardShouldPersistTaps가 'always'인 것도 같은 이유다 — 없으면 키보드가 떠 있을 때
 * 첫 탭이 키보드를 내리는 데 먹혀 버튼을 두 번 눌러야 한다.
 */
export const KeyboardBottomSheet = ({
  isOpen,
  onOpenChange,
  onCloseStart,
  children,
  footer,
}: KeyboardBottomSheetProps) => {
  const { setEnabled } = useKeyboardContext();
  const sheetRef = useRef<ComponentRef<typeof GorhomBottomSheet> | null>(null);
  const lastContentHeightRef = useRef(0);
  const isClosingRef = useRef(false);
  const hasNotifiedCloseRef = useRef(false);
  const prevIsOpenRef = useRef(isOpen);
  const closeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeFrameRef = useRef<number | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const { margins, topInset } = useSheetLayout({ minMargin: 0 });
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');
  const maxDynamicContentSize = getSheetMaxHeight(windowHeight, topInset, 0) - HANDLE_HEIGHT;
  const bottomPadding = (insets.bottom || 20) + 4;
  // 고정 영역이 가리는 만큼 스크롤 내용 아래를 비워 마지막 내용까지 올려 볼 수 있게 한다
  const [footerHeight, setFooterHeight] = useState(0);

  const closeSheet = useCallback(() => {
    isClosingRef.current = true;
    Keyboard.dismiss();
    sheetRef.current?.forceClose();
    if (closeRetryTimerRef.current) {
      clearTimeout(closeRetryTimerRef.current);
    }
    closeRetryTimerRef.current = setTimeout(() => {
      closeRetryTimerRef.current = null;
      if (isClosingRef.current) {
        sheetRef.current?.forceClose();
      }
    }, 500);
  }, []);

  useAndroidSheetBackHandler(isOpen, closeSheet);

  const resizeSheet = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }
    if (resizeFrameRef.current != null) {
      cancelAnimationFrame(resizeFrameRef.current);
    }
    resizeFrameRef.current = requestAnimationFrame(() => {
      resizeFrameRef.current = undefined;
      if (!isClosingRef.current) {
        sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
      }
    });
  }, []);

  useEffect(
    () => () => {
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      if (closeRetryTimerRef.current) {
        clearTimeout(closeRetryTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    setEnabled(!isOpen);
    return () => setEnabled(true);
  }, [isOpen, setEnabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      resizeSheet();
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
  }, [isOpen, resizeSheet]);

  useEffect(() => {
    if (!isOpen) {
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = undefined;
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
      const frame = requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
      });
      return () => cancelAnimationFrame(frame);
    }

    isClosingRef.current = true;
    hasNotifiedCloseRef.current = false;
    Keyboard.dismiss();
    const frame = requestAnimationFrame(() => {
      sheetRef.current?.close();
    });
    return () => cancelAnimationFrame(frame);
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

  // gorhom 기본 press 동작(close/collapse)은 forceClose와 겹치므로 탭은 closeSheet만 실행한다.
  const backdropTapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        scheduleOnRN(closeSheet);
      }),
    [closeSheet],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <GestureDetector gesture={backdropTapGesture}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={SHEET_INDEX.CLOSED}
            appearsOnIndex={SHEET_INDEX.OPEN}
            opacity={0.5}
            pressBehavior="none"
          />
        </View>
      </GestureDetector>
    ),
    [backdropTapGesture],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={[styles.footer, backgroundStyle, { paddingBottom: bottomPadding }]}
        >
          {footer}
        </View>
      </BottomSheetFooter>
    ),
    [backgroundStyle, bottomPadding, footer],
  );

  const handleContentSizeChange = (_width: number, height: number) => {
    if (!isOpen || isClosingRef.current) {
      return;
    }

    const nextHeight = Math.round(height);
    const prevHeight = lastContentHeightRef.current;

    if (Math.abs(nextHeight - prevHeight) < 2) {
      return;
    }

    lastContentHeightRef.current = nextHeight;
    resizeSheet();
  };

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      accessible={false}
      index={isOpen ? SHEET_INDEX.OPEN : SHEET_INDEX.CLOSED}
      enableDynamicSizing
      maxDynamicContentSize={maxDynamicContentSize}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustPan"
      topInset={topInset}
      style={{ marginLeft: margins.left, marginRight: margins.right }}
      backgroundStyle={[backgroundStyle, { borderRadius: 32 }]}
      handleIndicatorStyle={[styles.handleIndicator, handleIndicatorStyle]}
      backdropComponent={renderBackdrop}
      onAnimate={handleAnimate}
      onChange={handleSheetChange}
      footerComponent={footer == null ? undefined : renderFooter}
    >
      <BottomSheetScrollView
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footer == null ? bottomPadding : footerHeight + 4 },
        ]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {children}
      </BottomSheetScrollView>
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
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
  },
});
