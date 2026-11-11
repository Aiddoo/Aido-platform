import { Canvas, Group, Path, Skia, type SkPathBuilder } from '@shopify/react-native-skia';
import { useIsAppInBackground } from '@src/shared/hooks/use-is-app-in-background';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { type ComponentProps, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SPEECH_LEVEL_THRESHOLD, WAVEFORM_BAR } from '../../constants/voice-note.constants';
import { useSkiaDensityScale } from '../../hooks/use-skia-density-scale';
import { useToggleableFrameCallback } from '../../hooks/use-toggleable-frame-callback';
import {
  appendLevelFrame,
  appendTimelineBar,
  createLevelSampler,
  getTimelineLevel,
  type LevelSampler,
  withFlagBars,
} from '../../utils/waveform.geometry';

const STEP = WAVEFORM_BAR.width + WAVEFORM_BAR.gap;
const FLAG = { poleWidth: 2, top: 2, width: 8, height: 8, heightShare: 0.2 } as const;
const IDLE_DASH_HEIGHT = 2;
const RADIUS = WAVEFORM_BAR.width / 2;

interface LiveWaveform {
  /** 재생선 왼쪽에 그릴 최근 칸(오래된 순). 길이는 `WAVEFORM_BAR.maxLiveBars`를 넘지 않는다 */
  bars: SharedValue<readonly number[]>;
  barCount: SharedValue<number>;
  shift: SharedValue<number>;
}

interface UseLiveWaveformOptions {
  level: SharedValue<number>;
  isActive: boolean;
}

/** 듣는 동안 UI 스레드에서 음량을 칸으로 모은다. JS가 바빠도 파형이 멈추지 않고 React가 다시 그리지 않는다 */
function useLiveWaveform({ level, isActive }: UseLiveWaveformOptions): LiveWaveform {
  const isReducedMotion = useIsReduceMotionEnabled();
  // 값을 모으는 일이라 동작 줄이기·포커스와 무관하게 앱이 백그라운드일 때만 멈춘다
  const isInBackground = useIsAppInBackground();
  const bars = useSharedValue<readonly number[]>([]);
  const barCount = useSharedValue(0);
  const shift = useSharedValue(0);
  const sampler = useSharedValue<LevelSampler>(createLevelSampler());

  useEffect(() => () => cancelAnimation(shift), [shift]);

  useToggleableFrameCallback(
    (frame) => {
      'worklet';
      const next = appendLevelFrame(
        sampler.get(),
        level.get(),
        frame.timeSincePreviousFrame ?? 0,
        WAVEFORM_BAR.intervalMs,
      );
      sampler.set(next.sampler);
      if (next.bar == null) {
        return;
      }
      bars.set(appendTimelineBar(bars.get(), next.bar, WAVEFORM_BAR.maxLiveBars));
      barCount.set(barCount.get() + 1);
      if (!isReducedMotion) {
        shift.set(STEP);
        shift.set(withTiming(0, { duration: WAVEFORM_BAR.intervalMs, easing: Easing.linear }));
      }
    },
    { isActive: isActive && !isInBackground },
  );

  return { bars, barCount, shift };
}

function addRoundedBar(target: SkPathBuilder, left: number, top: number, height: number) {
  'worklet';
  target.addRRect(
    Skia.RRectXY(Skia.XYWHRect(left, top, WAVEFORM_BAR.width, height), RADIUS, RADIUS),
  );
}

function getSideCount(width: number) {
  'worklet';
  return Math.ceil(width / 2 / STEP) + 1;
}

function getSlotLeft(width: number, slot: number, sideCount: number) {
  'worklet';
  return width / 2 + (slot - sideCount) * STEP - RADIUS;
}

function addLevelBars(
  target: SkPathBuilder,
  { width, height }: { width: number; height: number },
  levels: readonly number[],
  { kind }: { kind: 'speech' | 'quiet' },
) {
  'worklet';
  const sideCount = getSideCount(width);
  for (let slot = 0; slot <= sideCount * 2; slot += 1) {
    const level = getTimelineLevel(levels, slot, sideCount);
    if (level != null && level >= SPEECH_LEVEL_THRESHOLD === (kind === 'speech')) {
      const barHeight = Math.max(
        height * WAVEFORM_BAR.minHeightRatio,
        level * height * WAVEFORM_BAR.verticalShare,
      );
      addRoundedBar(
        target,
        getSlotLeft(width, slot, sideCount),
        (height - barHeight) / 2,
        barHeight,
      );
    }
  }
}

interface WaveformTimelineProps extends Omit<ComponentProps<typeof Box>, 'children' | 'onLayout'> {
  waveform: LiveWaveform;
  flagIndexes: readonly number[];
}

function WaveformTimeline({
  waveform,
  flagIndexes,
  className,
  ...boxProps
}: WaveformTimelineProps) {
  const { t } = useTranslation('voiceNote');
  const mainColor = useResolvedColor('text-main');
  const quietColor = useResolvedColor('text-gray-4');
  const idleColor = useResolvedColor('text-gray-3');
  const layout = useSharedValue({ width: 0, height: 0 });
  const { bars, barCount, shift } = waveform;

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    layout.set({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  const densityScale = useSkiaDensityScale();
  const transform = useDerivedValue(() => [{ scale: densityScale }, { translateX: shift.get() }]);

  // Reanimated 매퍼는 넘겨받은 콜백 안의 shared value를 입력으로 찾지 않아(`usePathValue`) 값을 직접 읽는 `useDerivedValue`로 만든다
  const speechPath = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    addLevelBars(target, layout.get(), bars.get(), { kind: 'speech' });
    return target.build();
  });

  const quietPath = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    addLevelBars(target, layout.get(), bars.get(), { kind: 'quiet' });
    return target.build();
  });

  const idlePath = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    const { width, height } = layout.get();
    const levels = bars.get();
    const sideCount = getSideCount(width);
    for (let slot = 0; slot <= sideCount * 2; slot += 1) {
      if (getTimelineLevel(levels, slot, sideCount) == null) {
        addRoundedBar(
          target,
          getSlotLeft(width, slot, sideCount),
          (height - IDLE_DASH_HEIGHT) / 2,
          IDLE_DASH_HEIGHT,
        );
      }
    }
    return target.build();
  });

  const flagPath = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    const { width, height } = layout.get();
    const levels = bars.get();
    const firstBarIndex = barCount.get() - levels.length;
    const cursorLeft = width / 2 - RADIUS;
    for (const flagIndex of flagIndexes) {
      const barsBehindCursor = levels.length - 1 - (flagIndex - firstBarIndex);
      if (0 <= barsBehindCursor && barsBehindCursor < levels.length) {
        const poleX = cursorLeft - barsBehindCursor * STEP + RADIUS - FLAG.poleWidth / 2;
        target.addRect(
          Skia.XYWHRect(poleX, FLAG.top, FLAG.poleWidth, height * FLAG.heightShare + FLAG.height),
        );
        target
          .moveTo(poleX + FLAG.poleWidth, FLAG.top)
          .lineTo(poleX + FLAG.poleWidth + FLAG.width, FLAG.top + FLAG.height / 2)
          .lineTo(poleX + FLAG.poleWidth, FLAG.top + FLAG.height)
          .close();
      }
    }
    return target.build();
  });

  return (
    <Box
      accessibilityRole="image"
      accessibilityLabel={t('waveform.a11y')}
      className={cn('h-20', className)}
      onLayout={handleLayout}
      {...boxProps}
    >
      <Canvas style={{ flex: 1 }}>
        <Group transform={transform}>
          <Path path={idlePath} color={idleColor} />
          <Path path={quietPath} color={quietColor} />
          <Path path={speechPath} color={mainColor} />
          <Path path={flagPath} color={mainColor} />
        </Group>
      </Canvas>
      <Box
        pointerEvents="none"
        className="absolute top-0 bottom-0 left-1/2 -ml-px w-0.5 rounded-full bg-main"
      />
    </Box>
  );
}

interface RecognizerWaveformProps extends Omit<WaveformTimelineProps, 'waveform' | 'flagIndexes'> {
  /** 세션의 0..1 음량. 인식기가 말이 없으면 세션이 0으로 내린다 */
  level: SharedValue<number>;
  isActive: boolean;
  bookmarksMs: readonly number[];
}

export function RecognizerWaveform({
  level,
  isActive,
  bookmarksMs,
  ...timelineProps
}: RecognizerWaveformProps) {
  const waveform = useLiveWaveform({ level, isActive });
  const { barCount } = waveform;
  const [flagBars, setFlagBars] = useState<ReadonlyMap<number, number>>(new Map());

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 표시는 찍은 순간의 막대 위치에 쌓아 두어야 해서 렌더 중에 계산할 수 없다
    setFlagBars((previous) => withFlagBars(previous, bookmarksMs, barCount.get() - 1));
  }, [barCount, bookmarksMs]);

  return (
    <WaveformTimeline {...timelineProps} waveform={waveform} flagIndexes={[...flagBars.values()]} />
  );
}
