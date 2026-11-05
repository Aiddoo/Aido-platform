import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetScrollView,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import {
  type ComponentRef,
  createContext,
  type ReactNode,
  use,
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
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useResolveClassNames } from 'uniwind';

import {
  HANDLE_HEIGHT,
  SHEET_ANIMATION_DURATION,
  SHEET_CONTENT_PADDING,
  SHEET_INDEX,
  SHEET_RADIUS,
} from './constants';
import { getSheetMaxHeight } from './get-sheet-layout';
import { useAndroidSheetBackHandler } from './use-android-sheet-back-handler';
import { useScrollFocusedInputIntoView } from './use-scroll-focused-input-into-view';
import { useSheetLayout } from './use-sheet-layout';

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 시트 닫기 애니메이션 시작 시 호출 (backdrop 탭, 스와이프 등) */
  onCloseStart?: () => void;
  children: ReactNode;
  /** 내용이 길어 스크롤돼도 시트 아래(키보드 위)에 고정되는 영역. 주 동작 버튼을 둔다. */
  footer?: ReactNode;
  /** 시트 면 뒤에 깔리는 장식. 시트 크기를 기준으로 absolute로 배치하고, 내용 위로는 올라오지 않는다 */
  backgroundDecoration?: ReactNode;
  /** 내용을 끌어 시트를 움직일지. 내용이 안쪽 스크롤을 직접 두면 끄고 손잡이로만 움직이게 한다 */
  isContentPanEnabled?: boolean;
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
  backgroundDecoration,
  isContentPanEnabled = true,
}: KeyboardBottomSheetProps) => {
  const { setEnabled } = useKeyboardContext();
  const sheetRef = useRef<ComponentRef<typeof GorhomBottomSheet> | null>(null);
  const animatedPosition = useSharedValue(0);
  const lastContentHeightRef = useRef(0);
  const isClosingRef = useRef(false);
  const hasNotifiedCloseRef = useRef(false);
  const prevIsOpenRef = useRef(isOpen);
  const closeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeFrameRef = useRef<number | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const animationConfigs = useBottomSheetTimingConfigs({ duration: SHEET_ANIMATION_DURATION });
  const { margins, topInset } = useSheetLayout({ minMargin: 0 });
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');
  const maxDynamicContentSize = getSheetMaxHeight(windowHeight, topInset, 0) - HANDLE_HEIGHT;
  const bottomPadding = getContentBottomPadding(insets.bottom);
  // 키보드 위로 시트가 끝까지 올라가 내용이 잘리는 작은 화면(접은 Duo·SE)에서만 footer 아래 safe area 여백을 줄여 입력 칸이 들어갈
  // 높이를 남긴다. 키보드가 오르내릴 때 시트 전체를 다시 그리지 않도록 shared value로 둔다.
  const isKeyboardShown = useSharedValue(false);
  const footerPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom:
      isKeyboardShown.get() && animatedPosition.get() <= topInset + 1
        ? FOOTER_KEYBOARD_GAP
        : bottomPadding,
  }));
  // 고정 영역이 가리는 만큼 스크롤 내용 아래를 비워 마지막 내용까지 올려 볼 수 있게 한다.
  // 키보드가 오르내릴 때 내용 높이가 바뀌어 시트를 다시 맞추지 않도록 키보드가 없을 때 높이를 기준으로 한다.
  const [footerContentHeight, setFooterContentHeight] = useState(0);
  const footerChromeHeight = FOOTER_PADDING_TOP + footerContentHeight;
  const { scrollViewRef, handleScrollBeginDrag } = useScrollFocusedInputIntoView({
    isOpen,
    animatedPosition,
    bottomInset: footer == null ? 0 : footerChromeHeight + FOOTER_KEYBOARD_GAP,
    viewportTopLimit: topInset + HANDLE_HEIGHT,
  });

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

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      isKeyboardShown.set(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      isKeyboardShown.set(false);
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
      showSubscription.remove();
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
      isKeyboardShown.set(false);
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

  // 열리는 도중에 닫히면 gorhom은 index가 -1 그대로라 onChange를 부르지 않고 onClose만 부른다.
  // 닫힘을 onClose로 받아야 route 시트가 투명한 모달로 남아 터치를 막는 일이 없다
  const handleSheetClose = () => {
    if (closeRetryTimerRef.current) {
      clearTimeout(closeRetryTimerRef.current);
      closeRetryTimerRef.current = null;
    }
    if (!hasNotifiedCloseRef.current) {
      hasNotifiedCloseRef.current = true;
      onOpenChange(false);
    }
    isClosingRef.current = false;
  };

  const handleSheetChange = (index: number) => {
    if (index === SHEET_INDEX.CLOSED) {
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
        <Animated.View style={[styles.footer, backgroundStyle, footerPaddingStyle]}>
          <View onLayout={(event) => setFooterContentHeight(event.nativeEvent.layout.height)}>
            <SheetFooterSlot />
          </View>
        </Animated.View>
      </BottomSheetFooter>
    ),
    [backgroundStyle, footerPaddingStyle],
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
    <SheetDecorationContext value={backgroundDecoration}>
      <SheetFooterContext value={footer}>
        <GorhomBottomSheet
          ref={sheetRef}
          animatedPosition={animatedPosition}
          accessible={false}
          animationConfigs={animationConfigs}
          index={isOpen ? SHEET_INDEX.OPEN : SHEET_INDEX.CLOSED}
          enableDynamicSizing
          maxDynamicContentSize={maxDynamicContentSize}
          enablePanDownToClose
          enableContentPanningGesture={isContentPanEnabled}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          enableBlurKeyboardOnGesture
          android_keyboardInputMode="adjustPan"
          topInset={topInset}
          style={{ marginLeft: margins.left, marginRight: margins.right }}
          backgroundComponent={DecoratedSheetBackground}
          backgroundStyle={[backgroundStyle, { borderRadius: SHEET_RADIUS }]}
          handleIndicatorStyle={[styles.handleIndicator, handleIndicatorStyle]}
          backdropComponent={renderBackdrop}
          onAnimate={handleAnimate}
          onChange={handleSheetChange}
          onClose={handleSheetClose}
          footerComponent={footer == null ? undefined : renderFooter}
        >
          <BottomSheetScrollView
            ref={scrollViewRef}
            onScrollBeginDrag={handleScrollBeginDrag}
            onContentSizeChange={handleContentSizeChange}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: bottomPadding + (footer == null ? 0 : footerChromeHeight + 4) },
            ]}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </BottomSheetScrollView>
        </GorhomBottomSheet>
      </SheetFooterContext>
    </SheetDecorationContext>
  );
};

/** 내용 위아래 여백을 뺀, 시트 안에 한 번에 보일 수 있는 내용의 최대 높이. 안쪽 스크롤을 직접 두는 내용이 쓴다 */
export function useKeyboardSheetBodyMaxHeight(): number {
  const insets = useSafeAreaInsets();
  const { topInset } = useSheetLayout({ minMargin: 0 });
  const { height: windowHeight } = useWindowDimensions();

  // gorhom의 maxDynamicContentSize는 손잡이까지 포함한 시트 높이라, 내용 높이에서는 손잡이를 한 번 더 뺀다
  const sheetMaxHeight = getSheetMaxHeight(windowHeight, topInset, 0) - HANDLE_HEIGHT;

  return (
    sheetMaxHeight - HANDLE_HEIGHT - CONTENT_PADDING_TOP - getContentBottomPadding(insets.bottom)
  );
}

function getContentBottomPadding(bottomInset: number) {
  return (bottomInset || 20) + 4;
}

const SheetDecorationContext = createContext<ReactNode>(null);
/** footer 내용이 바뀔 때 gorhom의 footerComponent가 바뀌면 고정 영역이 다시 마운트되어 누르던 버튼을 놓친다 */
const SheetFooterContext = createContext<ReactNode>(null);

function SheetFooterSlot() {
  return use(SheetFooterContext);
}

/**
 * gorhom 기본 배경과 같은 면 뒤에 장식을 깐다. 장식이 바뀔 때 배경 컴포넌트가 바뀌어 다시 마운트되지 않도록
 * 컴포넌트는 고정하고 장식만 Context로 넘긴다.
 */
function DecoratedSheetBackground({ pointerEvents, style }: BottomSheetBackgroundProps) {
  const decoration = use(SheetDecorationContext);

  return (
    <>
      {decoration}
      <View
        pointerEvents={pointerEvents}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Bottom Sheet"
        style={style}
      />
    </>
  );
}

const CONTENT_PADDING_TOP = 20;
const FOOTER_PADDING_TOP = 12;
const FOOTER_KEYBOARD_GAP = 8;

const styles = StyleSheet.create({
  handleIndicator: {
    width: 36,
  },
  content: {
    paddingTop: CONTENT_PADDING_TOP,
    paddingHorizontal: SHEET_CONTENT_PADDING,
  },
  footer: {
    paddingTop: FOOTER_PADDING_TOP,
    paddingHorizontal: 20,
  },
});
