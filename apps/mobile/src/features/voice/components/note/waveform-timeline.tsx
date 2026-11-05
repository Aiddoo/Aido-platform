import { Canvas, Group, Path, Skia, type SkPathBuilder } from '@shopify/react-native-skia';
import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechEvent } from '@src/core/ports/speech-recognizer';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { useTranslation } from '@src/shared/i18n';
import { Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { type ComponentProps, useCallback, useEffect, useRef } from 'react';
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
import { VOICE_NO_VOLUME_GAP_MS } from '../../constants/voice.constants';
import { useSkiaColor } from '../../hooks/use-skia-color';
import { useSkiaDensityScale } from '../../hooks/use-skia-density-scale';
import {
  appendLevelSample,
  appendTimelineBar,
  createLevelSampler,
  getTimelineLevel,
  type LevelSampler,
} from '../../utils/view-models/waveform.view-model';

const STEP = WAVEFORM_BAR.width + WAVEFORM_BAR.gap;
const BAR_VERTICAL_SHARE = 0.8;
const FLAG = { poleWidth: 2, top: 2, width: 8, height: 8, heightShare: 0.2 } as const;
const IDLE_DASH_HEIGHT = 2;
const RADIUS = WAVEFORM_BAR.width / 2;
const NO_FLAGS: readonly number[] = [];

export interface LiveWaveform {
  /** 재생선 왼쪽에 그릴 최근 칸(오래된 순). 길이는 `WAVEFORM_BAR.maxLiveBars`를 넘지 않는다 */
  bars: SharedValue<readonly number[]>;
  /** 지금까지 만든 칸 수. 깃발 위치를 `bars` 안의 칸으로 옮길 때 쓴다 */
  barCount: SharedValue<number>;
  shift: SharedValue<number>;
  /** 인식기의 음량을 넣는다. React를 거치지 않고 UI 스레드 값만 바꾼다 */
  pushLevel: (level: number) => void;
}

/** 녹음 중 파형의 값. 음량 이벤트(초당 20번)가 React 렌더를 일으키지 않는다 */
export function useLiveWaveform(): LiveWaveform {
  const reduceMotion = useReduceMotion();
  const bars = useSharedValue<readonly number[]>([]);
  const barCount = useSharedValue(0);
  const shift = useSharedValue(0);
  const samplerRef = useRef<LevelSampler>(createLevelSampler());
  const barsRef = useRef<readonly number[]>([]);
  const barCountRef = useRef(0);

  useEffect(() => () => cancelAnimation(shift), [shift]);

  const pushLevel = useCallback(
    (level: number) => {
      const { sampler, bar } = appendLevelSample(samplerRef.current, level);
      samplerRef.current = sampler;
      if (bar == null) {
        return;
      }
      barsRef.current = appendTimelineBar(barsRef.current, bar);
      barCountRef.current += 1;
      bars.set(barsRef.current);
      barCount.set(barCountRef.current);
      if (!reduceMotion) {
        shift.set(STEP);
        shift.set(withTiming(0, { duration: WAVEFORM_BAR.intervalMs, easing: Easing.linear }));
      }
    },
    [barCount, bars, reduceMotion, shift],
  );

  return { bars, barCount, shift, pushLevel };
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

/** 소리가 있는 칸 중 말한 칸 또는 조용한 칸만 그린다. 색이 달라 경로를 나눈다 */
function addLevelBars(
  target: SkPathBuilder,
  { width, height }: { width: number; height: number },
  levels: readonly number[],
  isSpeech: boolean,
) {
  'worklet';
  const sideCount = getSideCount(width);
  for (let slot = 0; slot <= sideCount * 2; slot += 1) {
    const level = getTimelineLevel(levels, slot, sideCount);
    if (level != null && level >= SPEECH_LEVEL_THRESHOLD === isSpeech) {
      const barHeight = Math.max(
        height * WAVEFORM_BAR.minHeightRatio,
        level * height * BAR_VERTICAL_SHARE,
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
  /** 깃발이 꽂힌 칸. `getBarIndexAt`으로 구한 전체 칸 번호다 */
  flagIndexes?: readonly number[];
}

/** 가운데 고정 재생선을 지나 왼쪽으로 흐르는 파형. 말한 구간은 main, 조용한 구간은 gray, 중요 표시는 깃발이다 */
export function WaveformTimeline({
  waveform,
  flagIndexes = NO_FLAGS,
  className,
  ...boxProps
}: WaveformTimelineProps) {
  const { t } = useTranslation('voiceNote');
  const mainColor = useSkiaColor('text-main');
  const quietColor = useSkiaColor('text-gray-4');
  const idleColor = useSkiaColor('text-gray-3');
  const layout = useSharedValue({ width: 0, height: 0 });
  const { bars, barCount, shift } = waveform;

  const densityScale = useSkiaDensityScale();
  const transform = useDerivedValue(() => [{ scale: densityScale }, { translateX: shift.get() }]);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    layout.set({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  // Reanimated 매퍼는 넘겨받은 콜백 안의 shared value를 입력으로 찾지 않아(`usePathValue`) 값을 직접 읽는 `useDerivedValue`로 만든다
  const speechPath = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    addLevelBars(target, layout.get(), bars.get(), true);
    return target.build();
  });

  const quietPath = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    addLevelBars(target, layout.get(), bars.get(), false);
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
      if (barsBehindCursor >= 0 && barsBehindCursor < levels.length) {
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

interface RecognizerWaveformProps extends Omit<WaveformTimelineProps, 'waveform'> {
  /** 듣지 않을 때는 음량을 받지 않아 파형이 멈춘다 */
  isActive: boolean;
}

/** 인식기 음량을 직접 구독해 UI 스레드 값만 바꾼다. 음량 이벤트(초당 20번)에 React가 다시 그리지 않는다 */
export function RecognizerWaveform({ isActive, ...timelineProps }: RecognizerWaveformProps) {
  const speechRecognizer = useSpeechRecognizer();
  const waveform = useLiveWaveform();
  const { pushLevel } = waveform;

  useEffect(() => {
    if (!isActive) {
      return;
    }
    let lastVolumeAt = Date.now();
    const unsubscribe = speechRecognizer.subscribe((event: SpeechEvent) => {
      if (event.type === 'volume') {
        lastVolumeAt = Date.now();
        pushLevel(event.level);
      }
    });
    const silenceTimer = setInterval(() => {
      if (Date.now() - lastVolumeAt >= VOICE_NO_VOLUME_GAP_MS) {
        pushLevel(0);
      }
    }, WAVEFORM_BAR.intervalMs / 2);

    return () => {
      unsubscribe();
      clearInterval(silenceTimer);
    };
  }, [isActive, pushLevel, speechRecognizer]);

  return <WaveformTimeline {...timelineProps} waveform={waveform} />;
}
