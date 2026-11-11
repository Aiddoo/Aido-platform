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
import { getPaneEdgeInsets, type PaneSlot } from './get-pane-edge-insets';
import { usePaneAreaWidth, usePaneColumns } from './pane-area';

/** pane마다 SafeAreaProvider를 두어 창이 아닌 pane이 실제로 겹치는 safe area만 보게 한다. 접고 펼 때 목록 pane이 다시 마운트되지 않게 같은 트리 슬롯에 둔다 */
export function AdaptivePane(props: AdaptivePaneProps) {
  return (
    <ReservedRegionsProvider style={{ flex: 1 }}>
      <AdaptivePaneLayout {...props} />
    </ReservedRegionsProvider>
  );
}

/** 접힘선은 pane의 좌표로 재므로 `AdaptivePane` 안에서 부른다. 탭 사이드바가 열려 칸이 옮겨 가도 바뀐다 */
export function useAdaptivePaneLayoutKey(): string {
  const areaWidth = usePaneAreaWidth();
  const fold = findVerticalFold(useReservedRegions());

  return `${areaWidth}:${fold?.frame.x ?? 'none'}`;
}

/** 반쯤 접은 자세에서는 접힘선 위치로 목록과 상세를 나누고, 접힘선 폭만큼 비운다. */
function AdaptivePaneLayout({ primary, secondary }: AdaptivePaneProps) {
  const { isSplit, primaryWidth } = usePaneColumns();
  const fold = findVerticalFold(useReservedRegions());

  return (
    <HStack flex={1}>
      <Pane
        slot="primary"
        isSplit={isSplit}
        style={isSplit ? { width: primaryWidth } : { flex: 1 }}
      >
        {primary}
      </Pane>
      {isSplit &&
        (fold == null ? (
          <Box className="w-px bg-gray-2" />
        ) : (
          <Box style={{ width: fold.frame.width }} />
        ))}
      {isSplit && (
        <Pane slot="secondary" isSplit style={{ flex: 1 }}>
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
    ? getPaneEdgeInsets(windowInsets, slot, { isRTL: I18nManager.isRTL })
    : windowInsets;

  return (
    <Box testID={`adaptive-pane-${slot}`} style={style}>
      <SafeAreaProvider initialMetrics={{ insets, frame }}>{children}</SafeAreaProvider>
    </Box>
  );
}
