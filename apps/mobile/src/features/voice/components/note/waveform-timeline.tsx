import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { useTranslation } from '@src/shared/i18n';
import { Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { type ComponentProps, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { WAVEFORM_BAR } from '../../constants/voice-note.constants';
import { useSkiaColor } from '../../hooks/use-skia-color';
import { getTimelineWindow } from '../../utils/view-models/waveform.view-model';

const STEP = WAVEFORM_BAR.width + WAVEFORM_BAR.gap;
const BAR_VERTICAL_SHARE = 0.8;
const FLAG = { poleWidth: 2, top: 2, width: 8, height: 8, heightShare: 0.2 } as const;
const IDLE_DASH_HEIGHT = 2;

interface WaveformTimelineProps extends Omit<ComponentProps<typeof Box>, 'children' | 'onLayout'> {
  /** 한 칸이 `WAVEFORM_BAR.intervalMs`인 0..1 소리 크기 */
  levels: readonly number[];
  /** 가운데 재생선이 가리키는 칸. 녹음 중에는 마지막 칸, 다시 듣기는 재생 위치다 */
  cursorIndex: number;
  flagIndexes: readonly number[];
  /** 새 칸이 생길 때 한 칸씩 부드럽게 흐르게 한다(녹음 중). 모션 줄이기에서는 칸 단위로만 움직인다 */
  isLive?: boolean;
}

/** 가운데 고정 재생선을 지나 왼쪽으로 흐르는 파형. 말한 구간은 main, 조용한 구간은 gray, 중요 표시는 깃발이다 */
export function WaveformTimeline({
  levels,
  cursorIndex,
  flagIndexes,
  isLive = false,
  className,
  ...boxProps
}: WaveformTimelineProps) {
  const { t } = useTranslation('voiceNote');
  const reduceMotion = useReduceMotion();
  const mainColor = useSkiaColor('text-main');
  const quietColor = useSkiaColor('text-gray-4');
  const idleColor = useSkiaColor('text-gray-3');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const shift = useSharedValue(0);

  useEffect(() => {
    if (!isLive || reduceMotion) {
      shift.set(0);
      return;
    }
    shift.set(STEP);
    shift.set(withTiming(0, { duration: WAVEFORM_BAR.intervalMs, easing: Easing.linear }));
  }, [cursorIndex, isLive, reduceMotion, shift]);

  const transform = useDerivedValue(() => [{ translateX: shift.get() }]);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  const sideCount = Math.ceil(size.width / 2 / STEP) + 1;
  const speechPath = Skia.PathBuilder.Make();
  const quietPath = Skia.PathBuilder.Make();
  const idlePath = Skia.PathBuilder.Make();
  const flagPath = Skia.PathBuilder.Make();
  const flagSet = new Set(flagIndexes);
  const radius = WAVEFORM_BAR.width / 2;

  getTimelineWindow(levels, cursorIndex, sideCount).forEach((bar, slot) => {
    const left = size.width / 2 + (slot - sideCount) * STEP - radius;
    if (bar.level == null) {
      idlePath.addRRect(
        Skia.RRectXY(
          Skia.XYWHRect(
            left,
            (size.height - IDLE_DASH_HEIGHT) / 2,
            WAVEFORM_BAR.width,
            IDLE_DASH_HEIGHT,
          ),
          radius,
          radius,
        ),
      );
      return;
    }
    const height = Math.max(
      size.height * WAVEFORM_BAR.minHeightRatio,
      bar.level * size.height * BAR_VERTICAL_SHARE,
    );
    (bar.isSpeech ? speechPath : quietPath).addRRect(
      Skia.RRectXY(
        Skia.XYWHRect(left, (size.height - height) / 2, WAVEFORM_BAR.width, height),
        radius,
        radius,
      ),
    );
    if (flagSet.has(bar.index)) {
      const poleX = left + radius - FLAG.poleWidth / 2;
      flagPath.addRect(
        Skia.XYWHRect(
          poleX,
          FLAG.top,
          FLAG.poleWidth,
          size.height * FLAG.heightShare + FLAG.height,
        ),
      );
      flagPath
        .moveTo(poleX + FLAG.poleWidth, FLAG.top)
        .lineTo(poleX + FLAG.poleWidth + FLAG.width, FLAG.top + FLAG.height / 2)
        .lineTo(poleX + FLAG.poleWidth, FLAG.top + FLAG.height)
        .close();
    }
  });

  return (
    <Box
      accessibilityRole="image"
      accessibilityLabel={t('waveform.a11y')}
      className={cn('h-[74px]', className)}
      onLayout={handleLayout}
      {...boxProps}
    >
      <Canvas style={{ flex: 1 }}>
        <Group transform={transform}>
          <Path path={idlePath.build()} color={idleColor} />
          <Path path={quietPath.build()} color={quietColor} />
          <Path path={speechPath.build()} color={mainColor} />
          <Path path={flagPath.build()} color={mainColor} />
        </Group>
      </Canvas>
      <Box
        pointerEvents="none"
        className="absolute top-0 bottom-0 left-1/2 w-[2px] -ml-px rounded-full bg-main"
      />
    </Box>
  );
}
