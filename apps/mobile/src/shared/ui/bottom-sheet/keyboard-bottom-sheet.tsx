import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  BottomSheetScrollView,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useAndroidBackHandler } from '@src/shared/hooks/use-android-back-handler';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheet as HeroBottomSheet } from 'heroui-native';
import {
  type ComponentRef,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Keyboard, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import { useKeyboardContext } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useResolveClassNames } from 'uniwind';

import { FocusedFieldContext } from '../input/focused-field';
import { FieldMaxHeightContext } from '../text-area/field-max-height';
import {
  HANDLE_HEIGHT,
  SHARED_SHEET_STYLES,
  SHEET_ANIMATION_DURATION,
  SHEET_CONTENT_PADDING,
  SHEET_FOOTER_PADDING_TOP,
  SHEET_INDEX,
  SHEET_OVERLAY_OPACITY,
  SHEET_RADIUS,
} from './bottom-sheet.constants';
import {
  getBodyHeightAboveKeyboard,
  getKeyboardHiddenHeight,
  getKeyboardSheetContentPadding,
  getKeyboardSheetMaxHeight,
  getKeyboardSheetTopInset,
} from './keyboard-bottom-sheet.geometry';
import { usePortalTarget } from './portal-target';
import { SheetFooterContext, SheetFooterSlot } from './sheet-footer-slot';
import { useScrollFocusedInputIntoView } from './use-scroll-focused-input-into-view';
import { useSheetLayout } from './use-sheet-layout';

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 시트 닫기 애니메이션 시작 시 호출 (backdrop 탭, 스와이프 등) */
  onCloseStart?: () => void;
  children: ReactNode;
  /** 키보드에 가려도 보여야 하는 주 동작 버튼. 칩 줄 등 나머지는 children 흐름에 둔다 */
  footer?: ReactNode;
  backgroundDecoration?: ReactNode;
  enableContentPanningGesture?: boolean;
  /** 손잡이·내용 끌어내리기는 gorhom이 닫아 여기로 오지 않는다 */
  onDismissRequest?: () => void;
}

/** 키보드 컨트롤러는 전역이라 마지막으로 닫히는 시트만 다시 켠다 */
let openSheetCount = 0;

// `BottomSheet.Content`는 내용을 `BottomSheetView`로 한 번 더 감싸 키보드로 시트가 줄어도 안쪽 스크롤 높이가 줄지 않으므로 gorhom을 직접 쓴다
// keyboardShouldPersistTaps가 'always'인 것은 키보드가 떠 있을 때 첫 탭이 키보드를 내리는 데 먹혀 버튼을 두 번 눌러야 하기 때문이다
export function KeyboardBottomSheet({
  isOpen,
  onOpenChange,
  onCloseStart,
  children,
  footer,
  backgroundDecoration,
  enableContentPanningGesture = true,
  onDismissRequest,
}: KeyboardBottomSheetProps) {
  const { setEnabled } = useKeyboardContext();
  const portalTarget = usePortalTarget();
  const sheetRef = useRef<ComponentRef<typeof GorhomBottomSheet> | null>(null);
  const animatedPosition = useSharedValue(0);
  const animatedIndex = useSharedValue<number>(SHEET_INDEX.CLOSED);
  const isBackdropTouchable = useSharedValue(false);
  const appLifecycle = useAppLifecycle();
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
  const maxDynamicContentSize = getKeyboardSheetMaxHeight(windowHeight, topInset);
  const keyboardTopInset = getKeyboardSheetTopInset({ topInset, safeAreaTop: insets.top });
  const contentPadding = getKeyboardSheetContentPadding({ margins, safeAreaInsets: insets });
  const bottomPadding = getContentBottomPadding(insets.bottom);
  const contentHeight = useSharedValue(0);
  const keyboardHeight = useSharedValue(0);
  // 시트가 위쪽 한계에 닿으면 바닥이 키보드에 가린다(gorhom은 내용 영역을 줄이지 않는다). 다 올라간 위치로 정해 프레임마다 다시 붙지 않는다
  const keyboardHiddenHeight = useDerivedValue(() =>
    getKeyboardHiddenHeight({
      contentHeight: contentHeight.get(),
      keyboardHeight: keyboardHeight.get(),
      maxSheetHeight: maxDynamicContentSize,
      windowHeight,
      topInset: keyboardTopInset,
    }),
  );
  // 스크롤 영역 아래 끝을 키보드 위에 맞춰야 footer 뒤로 들어간 내용(카테고리 색)까지 스크롤된다
  const scrollAnimatedStyle = useAnimatedStyle(() => ({
    marginBottom: withTiming(keyboardHiddenHeight.get() ?? 0, {
      duration: SHEET_ANIMATION_DURATION,
    }),
  }));
  const footerAnimatedStyle = useAnimatedStyle(() => {
    const hiddenHeight = keyboardHiddenHeight.get();
    const isSheetAtTop = hiddenHeight != null;

    return {
      // 키보드 위로 시트가 끝까지 올라가는 작은 화면(접은 Duo·SE)에서만 footer 아래 safe area 여백을 줄인다
      paddingBottom: withTiming(isSheetAtTop ? FOOTER_KEYBOARD_GAP : bottomPadding, {
        duration: SHEET_ANIMATION_DURATION,
      }),
      transform: [
        {
          translateY: withTiming(-(hiddenHeight ?? 0), {
            duration: SHEET_ANIMATION_DURATION,
          }),
        },
      ],
    };
  });
  // 고정 영역이 가리는 만큼 스크롤 내용 아래를 비운다. 키보드가 오르내릴 때 시트를 다시 맞추지 않도록 키보드가 없을 때 높이를 기준으로 한다
  const [footerContentHeight, setFooterContentHeight] = useState(0);
  const footerChromeHeight = SHEET_FOOTER_PADDING_TOP + footerContentHeight;
  const footerSpace = footer == null ? 0 : footerChromeHeight + FOOTER_CONTENT_GAP;
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const bodyContentRef = useRef<ComponentRef<typeof View>>(null);
  const visibleBodyHeight =
    !isOpen || keyboardTop == null
      ? null
      : getBodyHeightAboveKeyboard({
          keyboardTop,
          topInset: keyboardTopInset,
          maxSheetHeight: maxDynamicContentSize,
          reservedHeight: CONTENT_PADDING_TOP + footerSpace,
        });
  // 칸을 뺀 나머지 내용이 키보드 위에 남도록 칸 상한을 준다. 내용 높이는 칸과 같은 배치에서 동기로 잰다
  const getMaxFieldHeight = useCallback(
    (fieldHeight: number) => {
      let maxFieldHeight: number | null = null;
      if (visibleBodyHeight != null) {
        bodyContentRef.current?.measure((_x, _y, _width, bodyHeight) => {
          maxFieldHeight = visibleBodyHeight - (bodyHeight - fieldHeight);
        });
      }
      return maxFieldHeight;
    },
    [visibleBodyHeight],
  );
  const { scrollViewRef, handleScrollBeginDrag, reportFocusedField } =
    useScrollFocusedInputIntoView({
      isOpen,
      animatedPosition,
      bottomInset: footer == null ? 0 : footerChromeHeight + FOOTER_KEYBOARD_GAP,
      viewportTopLimit: keyboardTopInset + HANDLE_HEIGHT,
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
    }, FORCE_CLOSE_RETRY_DELAY_MS);
  }, []);

  // 핸들러가 렌더마다 바뀌어도 backdrop 제스처가 다시 만들어지면 backdrop이 다시 마운트되어 누르던 탭을 놓친다
  const onDismissRequestRef = useRef(onDismissRequest);
  useLayoutEffect(() => {
    onDismissRequestRef.current = onDismissRequest;
  }, [onDismissRequest]);
  const requestDismiss = useCallback(() => {
    (onDismissRequestRef.current ?? closeSheet)();
  }, [closeSheet]);

  // 닫힌 시트는 듣지 않고, 뒤에 열린 시트의 구독이 먼저 불려 마지막 시트부터 닫힌다
  useAndroidBackHandler({
    isEnabled: isOpen,
    onBack: () => {
      requestDismiss();
      return true;
    },
  });

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
    if (!isOpen) {
      return;
    }
    openSheetCount += 1;
    setEnabled(false);
    return () => {
      openSheetCount -= 1;
      if (openSheetCount === 0) {
        setEnabled(true);
      }
    };
  }, [isOpen, setEnabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const showEvent = process.env.EXPO_OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = process.env.EXPO_OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      keyboardHeight.set(event.endCoordinates.height);
      setKeyboardTop(event.endCoordinates.screenY);
    });
    // 키보드에 가려 스크롤이 생긴 내용(카테고리 색)이 있다는 것을 스크롤 막대로 잠깐 알린다
    const didShowSubscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollViewRef.current?.flashScrollIndicators();
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.set(0);
      setKeyboardTop(null);
      resizeSheet();
    });

    const unsubscribeLifecycle = appLifecycle.subscribe((nextState) => {
      if (nextState === 'background' && !isClosingRef.current) {
        Keyboard.dismiss();
      }
    });

    return () => {
      showSubscription.remove();
      didShowSubscription.remove();
      hideSubscription.remove();
      unsubscribeLifecycle();
    };
  }, [appLifecycle, isOpen, keyboardHeight, resizeSheet, scrollViewRef]);

  useEffect(() => {
    if (!isOpen) {
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = undefined;
      contentHeight.set(0);
      keyboardHeight.set(0);
      isClosingRef.current = false;
    }
  }, [contentHeight, isOpen, keyboardHeight]);

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

  // 새 GestureDetector는 Android에서 자식이 터치를 받지 않아도 탭을 받는다. gorhom이 닫힌 시트의 backdrop 터치를 끄는 index에서 탭도 꺼 뒤 화면의 탭을 가로채지 않는다
  useAnimatedReaction(
    () => animatedIndex.get() > SHEET_INDEX.CLOSED,
    (isTouchable) => {
      if (isTouchable !== isBackdropTouchable.get()) {
        isBackdropTouchable.set(isTouchable);
      }
    },
  );

  // gorhom 기본 press 동작(close/collapse)은 forceClose와 겹치므로 탭은 requestDismiss만 실행한다.
  const backdropTapGesture = useTapGesture({
    testID: 'keyboard-sheet-backdrop-tap',
    enabled: isBackdropTouchable,
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(requestDismiss);
    },
  });

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <GestureDetector gesture={backdropTapGesture}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={SHEET_INDEX.CLOSED}
            appearsOnIndex={SHEET_INDEX.OPEN}
            opacity={SHEET_OVERLAY_OPACITY}
            pressBehavior="none"
          />
        </View>
      </GestureDetector>
    ),
    [backdropTapGesture],
  );

  const handleContentSizeChange = (_width: number, height: number) => {
    if (!isOpen || isClosingRef.current) {
      return;
    }

    const nextHeight = Math.round(height);
    const prevHeight = contentHeight.get();

    if (Math.abs(nextHeight - prevHeight) < MIN_CONTENT_HEIGHT_CHANGE) {
      return;
    }

    contentHeight.set(nextHeight);
    resizeSheet();
  };

  return (
    <HeroBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <HeroBottomSheet.Portal {...portalTarget}>
        <SheetDecorationContext value={backgroundDecoration}>
          <SheetFooterContext value={footer}>
            <GorhomBottomSheet
              ref={sheetRef}
              animatedIndex={animatedIndex}
              animatedPosition={animatedPosition}
              accessible={false}
              animationConfigs={animationConfigs}
              index={isOpen ? SHEET_INDEX.OPEN : SHEET_INDEX.CLOSED}
              enableDynamicSizing
              maxDynamicContentSize={maxDynamicContentSize}
              enablePanDownToClose
              enableContentPanningGesture={enableContentPanningGesture}
              activeOffsetY={PAN_ACTIVE_OFFSET_Y}
              failOffsetX={PAN_FAIL_OFFSET_X}
              keyboardBehavior="interactive"
              keyboardBlurBehavior="restore"
              android_keyboardInputMode="adjustPan"
              // 쉬는 높이는 maxDynamicContentSize가 occlusion 아래로 막고, 키보드가 올릴 때만 이 한계까지 간다
              topInset={keyboardTopInset}
              style={{ marginLeft: margins.left, marginRight: margins.right }}
              backgroundComponent={DecoratedSheetBackground}
              backgroundStyle={[backgroundStyle, { borderRadius: SHEET_RADIUS }]}
              handleIndicatorStyle={[SHARED_SHEET_STYLES.handleIndicator, handleIndicatorStyle]}
              backdropComponent={renderBackdrop}
              onAnimate={handleAnimate}
              onChange={handleSheetChange}
              onClose={handleSheetClose}
            >
              {/* gorhom footerComponent는 매 프레임 키보드 바로 위에 붙어 시트가 올라오는 동안 내용을 덮으므로, 시트 바닥에 두어 시트와 함께 움직인다 */}
              <View style={styles.body}>
                <BottomSheetScrollView
                  ref={scrollViewRef}
                  style={scrollAnimatedStyle}
                  onScrollBeginDrag={handleScrollBeginDrag}
                  onContentSizeChange={handleContentSizeChange}
                  contentContainerStyle={[
                    styles.content,
                    {
                      paddingLeft: contentPadding.left,
                      paddingRight: contentPadding.right,
                      paddingBottom: bottomPadding + footerSpace,
                    },
                  ]}
                  keyboardShouldPersistTaps="always"
                  scrollIndicatorInsets={{
                    right: contentPadding.right - SHEET_CONTENT_PADDING,
                    bottom: footer == null ? 0 : footerChromeHeight,
                  }}
                  automaticallyAdjustsScrollIndicatorInsets={false}
                  bounces={false}
                >
                  <FocusedFieldContext value={reportFocusedField}>
                    <FieldMaxHeightContext value={getMaxFieldHeight}>
                      <View ref={bodyContentRef}>{children}</View>
                    </FieldMaxHeightContext>
                  </FocusedFieldContext>
                </BottomSheetScrollView>
                {footer != null && (
                  <Animated.View
                    style={[
                      styles.footer,
                      backgroundStyle,
                      { paddingLeft: contentPadding.left, paddingRight: contentPadding.right },
                      footerAnimatedStyle,
                    ]}
                  >
                    <SheetFooterSlot onHeightChange={setFooterContentHeight} />
                  </Animated.View>
                )}
              </View>
            </GorhomBottomSheet>
          </SheetFooterContext>
        </SheetDecorationContext>
      </HeroBottomSheet.Portal>
    </HeroBottomSheet>
  );
}

export function useKeyboardSheetBodyMaxHeight(): number {
  const insets = useSafeAreaInsets();
  const { topInset } = useSheetLayout({ minMargin: 0 });
  const { height: windowHeight } = useWindowDimensions();

  // gorhom의 maxDynamicContentSize는 손잡이까지 포함한 시트 높이라, 내용 높이에서는 손잡이를 한 번 더 뺀다
  return (
    getKeyboardSheetMaxHeight(windowHeight, topInset) -
    HANDLE_HEIGHT -
    CONTENT_PADDING_TOP -
    getContentBottomPadding(insets.bottom)
  );
}

function getContentBottomPadding(bottomInset: number) {
  return (bottomInset || NO_SAFE_AREA_BOTTOM_PADDING) + SAFE_AREA_CONTENT_GAP;
}

const SheetDecorationContext = createContext<ReactNode>(null);

// 컴포넌트를 고정하고 장식만 Context로 넘겨 다시 마운트를 막는다
// gorhom의 pointerEvents="none"을 쓰지 않는다: Android Gesture Handler가 제스처도 배경색도 없는 뷰를 지나쳐 아래 backdrop의 탭까지 불려 시트가 닫혔다(QA: 듣기 X)
function DecoratedSheetBackground({ style }: BottomSheetBackgroundProps) {
  const { t } = useTranslation('common');
  const decoration = use(SheetDecorationContext);

  return (
    <>
      {decoration}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('bottomSheet.label')}
        style={style}
      />
    </>
  );
}

const CONTENT_PADDING_TOP = 20;
const NO_SAFE_AREA_BOTTOM_PADDING = 20;
const SAFE_AREA_CONTENT_GAP = 4;
const FOOTER_CONTENT_GAP = 4;
const FOOTER_KEYBOARD_GAP = 8;
const FORCE_CLOSE_RETRY_DELAY_MS = 500;
const MIN_CONTENT_HEIGHT_CHANGE = 2;
// 시트 끌기는 세로로 움직일 때만 잡아, 손가락이 조금 흔들려도 칩 줄 같은 가로 스크롤이 제스처를 가져가게 한다
const PAN_ACTIVE_OFFSET_Y: [number, number] = [-15, 15];
const PAN_FAIL_OFFSET_X: [number, number] = [-10, 10];

const styles = StyleSheet.create({
  content: {
    paddingTop: CONTENT_PADDING_TOP,
  },
  body: { flex: 1 },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingTop: SHEET_FOOTER_PADDING_TOP,
  },
});
