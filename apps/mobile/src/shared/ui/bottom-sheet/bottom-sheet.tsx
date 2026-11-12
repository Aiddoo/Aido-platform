import {
  BottomSheetScrollView,
  useBottomSheetInternal,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet as HeroBottomSheet,
  useBottomSheet,
  useBottomSheetAnimation,
} from 'heroui-native';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useResolveClassNames } from 'uniwind';

import {
  HANDLE_HEIGHT,
  SHARED_SHEET_STYLES,
  SHEET_ANIMATION_DURATION_MS,
  SHEET_CONTENT_PADDING,
  SHEET_DETACHED_MARGIN,
  SHEET_FOOTER_PADDING_TOP,
  SHEET_INDEX,
  SHEET_OVERLAY_OPACITY,
  SHEET_RADIUS,
} from './bottom-sheet.constants';
import { getSheetMaxHeight } from './get-sheet-layout';
import { usePortalTarget } from './portal-target';
import { SheetFooterContext, SheetFooterSlot } from './sheet-footer-slot';
import { SheetFixedHeaderContext } from './sheet-header-layout';
import { useSheetLayout } from './use-sheet-layout';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// HeroUI 진행값은 열리기 전 0, 다 열리면 1, 스와이프로 닫히면 2다. 닫힌 시트가 정확히 0·2에 멈추지 않는 Android 기기가 있다
const PROGRESS_EPSILON = 0.01;
const PROGRESS_SWIPE_CLOSED = 2;

interface BottomSheetProps extends Omit<ComponentProps<typeof HeroBottomSheet>, 'children'> {
  onCloseStart?: () => void;
  children: ReactNode;
  /** 내용이 길어 스크롤돼도 시트 아래에 고정되는 영역. 주 동작 버튼을 둔다. */
  footer?: ReactNode;
  /** 머리글을 고정하고 본문만 스크롤한다. 손잡이로만 끌어내린다. */
  hasFixedHeader?: boolean;
}

/** 내용은 Portal로 그려지므로 주변 Context는 시트 안에 둔다. `onOpenChange(false)`는 닫힘 애니메이션이 끝난 뒤에 와서 route를 바로 떠나도 잘리지 않는다 */
export function BottomSheet({
  isOpen = false,
  onOpenChange,
  onCloseStart,
  children,
  footer,
  hasFixedHeader = false,
  ...rootProps
}: BottomSheetProps) {
  // HeroUI는 닫힘에서 열림으로 바뀔 때만 시트를 올리고, gorhom은 높이를 재기 전의 열기를 버린다
  const [isMeasured, setIsMeasured] = useState(false);
  // HeroUI는 스와이프 도중과 뒤로 가기에서 닫으라고 알린다. 부모에는 애니메이션이 끝난 뒤 알린다
  const [isDismissing, setIsDismissing] = useState(false);
  const [hasOpenRequest, setHasOpenRequest] = useState(isOpen);
  const [footerContentHeight, setFooterContentHeight] = useState(0);
  const portalTarget = usePortalTarget();
  const insets = useSafeAreaInsets();
  const animationConfigs = useBottomSheetTimingConfigs({ duration: SHEET_ANIMATION_DURATION_MS });
  const { margins, topInset } = useSheetLayout({ minMargin: SHEET_DETACHED_MARGIN });
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const bottomInset = insets.bottom || SHEET_DETACHED_MARGIN;
  const maxDynamicContentSize =
    getSheetMaxHeight(windowHeight, topInset, bottomInset) - HANDLE_HEIGHT;
  const bodyMaxHeight = maxDynamicContentSize - HANDLE_HEIGHT;

  if (isOpen && !hasOpenRequest) {
    setHasOpenRequest(true);
  }

  const handleAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex === SHEET_INDEX.CLOSED) {
      onCloseStart?.();
    }
  };

  const handleDismissed = () => {
    setIsDismissing(false);
    setHasOpenRequest(false);
    onOpenChange?.(false);
  };

  // gorhom BottomSheetFooter는 매 프레임 화면에 보이는 바닥에 붙어 시트가 올라오는 동안 내용을 덮으므로, 시트 바닥에 붙여 함께 움직인다
  const renderFooter = useCallback(
    () => (
      <View style={[styles.footer, backgroundStyle]}>
        <SheetFooterSlot onHeightChange={setFooterContentHeight} />
      </View>
    ),
    [backgroundStyle],
  );

  return (
    <HeroBottomSheet
      {...rootProps}
      isOpen={isOpen && isMeasured && !isDismissing}
      onOpenChange={(nextIsOpen) => setIsDismissing(!nextIsOpen)}
    >
      <HeroBottomSheet.Portal {...portalTarget}>
        <SheetOverlay />
        <SheetDismissedSignal
          isClosing={hasOpenRequest && (!isOpen || isDismissing)}
          onDismissed={handleDismissed}
        />
        <SheetFooterContext value={footer}>
          <HeroBottomSheet.Content
            accessible={false}
            animationConfigs={animationConfigs}
            enableDynamicSizing
            maxDynamicContentSize={maxDynamicContentSize}
            enableContentPanningGesture={!hasFixedHeader}
            detached
            bottomInset={bottomInset}
            style={[
              SHARED_SHEET_STYLES.detached,
              { marginLeft: margins.left, marginRight: margins.right },
            ]}
            backgroundClassName="bg-white dark:bg-gray-1 shadow-none"
            backgroundStyle={SHARED_SHEET_STYLES.detachedBackground}
            handleIndicatorClassName="bg-gray-4"
            handleIndicatorStyle={SHARED_SHEET_STYLES.handleIndicator}
            contentContainerClassName="flex-none p-0"
            contentContainerProps={CONTENT_CONTAINER_PROPS}
            footerComponent={footer == null ? undefined : renderFooter}
            onAnimate={handleAnimate}
          >
            <SheetMeasuredSignal onMeasured={() => setIsMeasured(true)} />
            {hasFixedHeader ? (
              <SheetFixedHeaderContext value>
                <View
                  style={[
                    SHARED_SHEET_STYLES.content,
                    styles.fixedBody,
                    { maxHeight: bodyMaxHeight },
                  ]}
                >
                  {children}
                </View>
              </SheetFixedHeaderContext>
            ) : (
              <BottomSheetScrollView
                style={{ maxHeight: bodyMaxHeight }}
                contentContainerStyle={[
                  SHARED_SHEET_STYLES.content,
                  footer != null && {
                    paddingBottom:
                      SHEET_FOOTER_PADDING_TOP + footerContentHeight + SHEET_CONTENT_PADDING,
                  },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {children}
              </BottomSheetScrollView>
            )}
          </HeroBottomSheet.Content>
        </SheetFooterContext>
      </HeroBottomSheet.Portal>
    </HeroBottomSheet>
  );
}

/** HeroUI 문서의 커스텀 Overlay 방식. 기본 Overlay는 닫기 시작하면 바로 사라져 배경이 툭 끊긴다 */
function SheetOverlay() {
  const { t } = useTranslation('common');
  const { isOpen, onOpenChange } = useBottomSheet();
  const { progress } = useBottomSheetAnimation();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1, 2], [0, SHEET_OVERLAY_OPACITY, 0]),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={t('actions.close')}
      pointerEvents={isOpen ? 'auto' : 'none'}
      style={[styles.overlay, animatedStyle]}
      onPress={() => onOpenChange(false)}
    />
  );
}

function SheetDismissedSignal({
  isClosing,
  onDismissed,
}: {
  isClosing: boolean;
  onDismissed: () => void;
}) {
  const { progress } = useBottomSheetAnimation();
  const [isAtRest, setIsAtRest] = useState(true);
  const handleDismissed = useEffectEvent(onDismissed);

  useAnimatedReaction(
    () =>
      progress.get() <= PROGRESS_EPSILON ||
      progress.get() >= PROGRESS_SWIPE_CLOSED - PROGRESS_EPSILON,
    (current, previous) => {
      if (current !== previous) {
        scheduleOnRN(setIsAtRest, current);
      }
    },
  );

  useEffect(() => {
    if (isClosing && isAtRest) {
      handleDismissed();
    }
  }, [isClosing, isAtRest]);

  return null;
}

/** gorhom에는 높이 측정이 끝났다는 공개 이벤트가 없다. HeroUI 시트 내용도 같은 값을 읽는다 */
function SheetMeasuredSignal({ onMeasured }: { onMeasured: () => void }) {
  const { animatedDetentsState } = useBottomSheetInternal();

  useAnimatedReaction(
    () => (animatedDetentsState.get().detents?.length ?? 0) > 0,
    (isMeasured, wasMeasured) => {
      if (isMeasured && !wasMeasured) {
        scheduleOnRN(onMeasured);
      }
    },
  );

  return null;
}

const styles = StyleSheet.create({
  // HeroUI 기본 pb-safe-offset-3가 머리글 고정 시트의 높이에 더해진다. 안쪽 여백은 시트 내용이 맡는다
  contentContainer: { paddingBottom: 0 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'black' },
  fixedBody: { flexShrink: 1 },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingTop: SHEET_FOOTER_PADDING_TOP,
    paddingHorizontal: SHEET_CONTENT_PADDING,
    paddingBottom: SHEET_CONTENT_PADDING,
    borderBottomLeftRadius: SHEET_RADIUS,
    borderBottomRightRadius: SHEET_RADIUS,
  },
});

const CONTENT_CONTAINER_PROPS = { style: styles.contentContainer };
