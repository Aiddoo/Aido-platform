import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { type ComponentRef, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';

import {
  HANDLE_HEIGHT,
  SHEET_DETACHED_MARGIN,
  SHEET_INDEX,
  SHARED_SHEET_STYLES,
} from './constants';
import { getSheetMaxHeight } from './get-sheet-layout';
import { useAndroidSheetBackHandler } from './use-android-sheet-back-handler';
import { useSheetLayout } from './use-sheet-layout';

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCloseStart?: () => void;
  children: ReactNode;
  /** 내용이 길어 스크롤돼도 시트 아래에 고정되는 영역. 주 동작 버튼을 둔다. */
  footer?: ReactNode;
}

/**
 * 키보드 불필요 BottomSheet. 피커, 액션시트 등에 사용.
 */
export const BottomSheet = ({
  isOpen,
  onOpenChange,
  onCloseStart,
  children,
  footer,
}: BottomSheetProps) => {
  const sheetRef = useRef<ComponentRef<typeof GorhomBottomSheet> | null>(null);
  const resizeFrameRef = useRef<number | undefined>(undefined);
  const lastContentHeightRef = useRef(0);
  const isClosingRef = useRef(false);
  const hasNotifiedCloseRef = useRef(false);
  const prevIsOpenRef = useRef(isOpen);
  useAndroidSheetBackHandler(isOpen, () => sheetRef.current?.close());
  const insets = useSafeAreaInsets();
  const { margins, topInset } = useSheetLayout({ minMargin: SHEET_DETACHED_MARGIN });
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');
  const bottomInset = insets.bottom || 16;
  const maxDynamicContentSize =
    getSheetMaxHeight(windowHeight, topInset, bottomInset) - HANDLE_HEIGHT;
  // 고정 영역이 가리는 만큼 스크롤 내용 아래를 비워 마지막 내용까지 올려 볼 수 있게 한다
  const [footerHeight, setFooterHeight] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      lastContentHeightRef.current = 0;
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = undefined;
    }
  }, [isOpen]);

  useEffect(
    () => () => {
      if (resizeFrameRef.current != null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
    },
    [],
  );

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
    const frame = requestAnimationFrame(() => {
      sheetRef.current?.close();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const handleAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex === SHEET_INDEX.CLOSED) {
      isClosingRef.current = true;
      onCloseStart?.();
    }
  };

  const handleSheetChange = (index: number) => {
    if (index === SHEET_INDEX.CLOSED) {
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
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={[styles.footer, backgroundStyle]}
        >
          {footer}
        </View>
      </BottomSheetFooter>
    ),
    [backgroundStyle, footer],
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
    if (resizeFrameRef.current != null) {
      cancelAnimationFrame(resizeFrameRef.current);
    }
    resizeFrameRef.current = requestAnimationFrame(() => {
      resizeFrameRef.current = undefined;
      if (!isClosingRef.current) {
        sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
      }
    });
  };

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      accessible={false}
      index={isOpen ? SHEET_INDEX.OPEN : SHEET_INDEX.CLOSED}
      enableDynamicSizing
      maxDynamicContentSize={maxDynamicContentSize}
      enablePanDownToClose
      detached
      bottomInset={bottomInset}
      style={[
        SHARED_SHEET_STYLES.detached,
        { marginLeft: margins.left, marginRight: margins.right },
      ]}
      backgroundStyle={[backgroundStyle, SHARED_SHEET_STYLES.detachedBackground]}
      handleIndicatorStyle={[SHARED_SHEET_STYLES.handleIndicator, handleIndicatorStyle]}
      backdropComponent={renderBackdrop}
      onAnimate={handleAnimate}
      onChange={handleSheetChange}
      footerComponent={footer == null ? undefined : renderFooter}
    >
      <BottomSheetScrollView
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={[
          SHARED_SHEET_STYLES.content,
          footer != null && { paddingBottom: footerHeight },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {children}
      </BottomSheetScrollView>
    </GorhomBottomSheet>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
});
