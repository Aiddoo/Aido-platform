import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { findVerticalFold } from '@src/shared/utils/find-vertical-fold';
import type { ReactNode } from 'react';
import { I18nManager, type StyleProp, type ViewStyle } from 'react-native';
import { ReservedRegionsProvider, useReservedRegions } from 'react-native-reserved-regions';
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Box } from '../box/box';
import { HStack } from '../h-stack/h-stack';
import type { AdaptivePaneProps } from './adaptive-pane.types';
import { getPaneInitialInsets, type PaneSlot } from './get-pane-initial-insets';
import { getPrimaryPaneWidth } from './get-primary-pane-width';

/**
 * pane마다 SafeAreaProvider를 두어 그 안의 SafeAreaView와 useSafeAreaInsets가 창이 아닌
 * pane이 실제로 겹치는 safe area(iPhone Duo 세로 레일 등)만 보게 한다.
 *
 * 접기/펼치기에서 pane이 다시 마운트되면 스크롤 위치·입력·내비게이터 상태를 잃으므로
 * 두 pane을 size class와 무관하게 같은 트리 슬롯에 두고 보이는 슬롯만 바꾼다.
 */
export function AdaptivePane(props: AdaptivePaneProps) {
  return (
    <ReservedRegionsProvider style={{ flex: 1 }}>
      <AdaptivePaneLayout {...props} />
    </ReservedRegionsProvider>
  );
}

/** 반쯤 접은 자세에서는 접힘선 위치로 목록과 상세를 나누고, 접힘선 폭만큼 비운다. */
function AdaptivePaneLayout({ primary, secondary, compactPane = 'primary' }: AdaptivePaneProps) {
  const windowSizeClass = useWindowSizeClass();
  const fold = findVerticalFold(useReservedRegions());
  const isCompact = windowSizeClass === 'compact';
  const showsPrimary = !isCompact || compactPane === 'primary';
  const showsSecondary = !isCompact || compactPane === 'secondary';

  return (
    <HStack flex={1}>
      {showsPrimary && (
        <Pane
          slot="primary"
          isSplit={!isCompact}
          style={
            isCompact
              ? { flex: 1 }
              : { width: getPrimaryPaneWidth({ windowSizeClass, foldFrame: fold?.frame }) }
          }
        >
          {primary}
        </Pane>
      )}
      {!isCompact &&
        (fold == null ? (
          <Box className="w-px bg-gray-2" />
        ) : (
          <Box style={{ width: fold.frame.width }} />
        ))}
      {showsSecondary && (
        <Pane slot="secondary" isSplit={!isCompact} style={{ flex: 1 }}>
          {secondary}
        </Pane>
      )}
    </HStack>
  );
}

interface PaneProps {
  slot: PaneSlot;
  isSplit: boolean;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}

function Pane({ slot, isSplit, style, children }: PaneProps) {
  const windowInsets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const insets = isSplit
    ? getPaneInitialInsets(windowInsets, slot, I18nManager.isRTL)
    : windowInsets;

  return (
    <Box testID={`adaptive-pane-${slot}`} style={style}>
      <SafeAreaProvider initialMetrics={{ insets, frame }}>{children}</SafeAreaProvider>
    </Box>
  );
}
