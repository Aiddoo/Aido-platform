import { Canvas, Path, Skia, type SkPathBuilder } from '@shopify/react-native-skia';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { useIsAppInBackground } from '@src/shared/hooks/use-is-app-in-background';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { useRebuiltPath } from '@src/shared/hooks/use-rebuilt-path';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, PauseIcon, PlayIcon, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { noop } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { useEffect, useMemo, useState } from 'react';
import type { AccessibilityActionEvent, AccessibilityValue } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  clamp,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { WAVEFORM_BAR } from '../../constants/voice-note.constants';
import { useVoiceNotePlayback } from '../../hooks/use-voice-note-playback';
import type { VoiceNotePlayer } from '../../hooks/use-voice-note-player';
import { formatMediaTime } from '../../utils/media-time.view-model';
import { getPlayedBarCount, resampleLevels, toRoundedBar } from '../../utils/waveform.geometry';

const STEP = WAVEFORM_BAR.width + WAVEFORM_BAR.gap;
const FLAG = { poleWidth: 2, width: 6, height: 6, poleHeightShare: 0.45 } as const;
const SCRUBBER_ACCESSIBILITY_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }];
/** 접근성 조작(증가·감소) 한 번에 옮기는 길이 */
const ACCESSIBILITY_SEEK_STEP_MS = 5 * SECOND_MS;

interface VoiceNotePlayerBarProps {
  player: VoiceNotePlayer;
  /** 한 칸이 `WAVEFORM_BAR.intervalMs`인 노트 전체 소리 크기 */
  levels: readonly number[];
  flagIndexes: readonly number[];
  isRecordingAvailable: boolean;
}

export function VoiceNotePlayerBar({
  player,
  levels,
  flagIndexes,
  isRecordingAvailable,
}: VoiceNotePlayerBarProps) {
  const { t } = useTranslation('voiceNote');
  const isPlaying = useVoiceNotePlayback(player, (playback) => playback.isPlaying);
  const isLoaded = useVoiceNotePlayback(player, (playback) => playback.isLoaded);
  const durationMs = useVoiceNotePlayback(player, (playback) => playback.durationMs);
  const positionText = useVoiceNotePlayback(player, ({ positionMs }) =>
    formatMediaTime(positionMs),
  );
  const positionRatio = useSharedValue(0);
  const dragRatio = useSharedValue<number | null>(null);
  const [dragSeconds, setDragSeconds] = useState<number | null>(null);

  // 재생 위치는 100ms마다 바뀐다. 렌더를 거치지 않고 UI 스레드 값만 바꾸고, 앱이 백그라운드로 가면 멈췄다가 돌아오면 바로 맞춘다
  const isInBackground = useIsAppInBackground();
  useEffect(() => {
    if (isInBackground) {
      return;
    }
    const syncPositionRatio = () => {
      const playback = player.getPlayback();
      positionRatio.set(playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0);
    };
    syncPositionRatio();

    return player.subscribe(syncPositionRatio);
  }, [isInBackground, player, positionRatio]);

  // 드래그는 터치마다 온다. 글자는 초가 바뀔 때만 JS로 넘겨 다시 그린다
  useAnimatedReaction(
    () => {
      const ratio = dragRatio.get();
      return ratio == null ? null : Math.floor((ratio * durationMs) / SECOND_MS);
    },
    (seconds, previousSeconds) => {
      if (seconds !== previousSeconds) {
        scheduleOnRN(setDragSeconds, seconds);
      }
    },
  );

  const shownText = dragSeconds == null ? positionText : formatMediaTime(dragSeconds * SECOND_MS);
  const durationText = formatMediaTime(durationMs);

  if (!isRecordingAvailable) {
    return (
      <HStack className="self-start rounded-xl bg-gray-1 px-3 py-2">
        <Text size="e1" shade={7} lineBreakStrategyIOS="hangul-word" className="shrink">
          {t('player.unavailable')}
        </Text>
      </HStack>
    );
  }

  return (
    <HStack gap={12} className="items-center rounded-2xl bg-gray-1 px-3 py-3">
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? t('player.pause') : t('player.play')}
        isDisabled={!isLoaded}
        hitSlop={4}
        onPress={() => {
          player.togglePlay().catch(noop);
        }}
        className="size-9 items-center justify-center rounded-full bg-main"
      >
        {isPlaying ? (
          <PauseIcon colorClassName="text-white dark:text-gray-9" width={14} height={14} />
        ) : (
          <PlayIcon colorClassName="text-white dark:text-gray-9" width={14} height={14} />
        )}
      </PressableFeedback>
      <Scrubber
        levels={levels}
        flagIndexes={flagIndexes}
        positionRatio={positionRatio}
        dragRatio={dragRatio}
        accessibilityLabel={t('player.position')}
        accessibilityValue={{
          text: t('player.positionValue', { position: shownText, duration: durationText }),
        }}
        accessibilityStepRatio={durationMs > 0 ? ACCESSIBILITY_SEEK_STEP_MS / durationMs : 0}
        onSeek={(ratio) => {
          player.seekTo(ratio * durationMs).catch(noop);
        }}
        className="flex-1"
      />
      <Text size="e1" shade={7} numberOfLines={1} className="tabular-nums">
        {shownText} / {durationText}
      </Text>
    </HStack>
  );
}

function getDragRatio(x: number, width: number) {
  'worklet';
  return width > 0 ? clamp(x / width, 0, 1) : 0;
}

function addBars(
  target: SkPathBuilder,
  bars: readonly number[],
  from: number,
  to: number,
  canvasHeight: number,
) {
  'worklet';
  for (let index = from; index < Math.min(to, bars.length); index += 1) {
    const height = Math.max(
      canvasHeight * WAVEFORM_BAR.minHeightRatio,
      (bars[index] ?? 0) * canvasHeight * WAVEFORM_BAR.verticalShare,
    );
    target.addRRect(toRoundedBar(index * STEP, (canvasHeight - height) / 2, height));
  }
}

interface ScrubberProps {
  levels: readonly number[];
  flagIndexes: readonly number[];
  /** 0..1 재생 위치 */
  positionRatio: SharedValue<number>;
  /** 0..1 끌고 있는 위치. 끌지 않으면 null */
  dragRatio: SharedValue<number | null>;
  /** 스크린 리더의 증가·감소 한 번이 옮기는 0..1 길이 */
  accessibilityStepRatio: number;
  onSeek: (ratio: number) => void;
  accessibilityLabel: string;
  accessibilityValue: AccessibilityValue;
  className?: string;
}

function Scrubber({
  levels,
  flagIndexes,
  positionRatio,
  dragRatio,
  accessibilityStepRatio,
  onSeek,
  accessibilityLabel,
  accessibilityValue,
  className,
}: ScrubberProps) {
  const playedColor = useResolvedColor('text-main');
  const restColor = useResolvedColor('text-gray-4');
  const [size, handleLayout] = useLayoutSize();
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const barCount = Math.floor(width / STEP);
  const bars = useMemo(() => resampleLevels(levels, barCount), [levels, barCount]);

  const gesture = usePanGesture({
    testID: 'voice-note-scrubber',
    minDistance: 0,
    onBegin: (event) => {
      'worklet';
      dragRatio.set(getDragRatio(event.x, width));
    },
    onUpdate: (event) => {
      'worklet';
      dragRatio.set(getDragRatio(event.x, width));
    },
    onFinalize: (event) => {
      'worklet';
      dragRatio.set(null);
      // 다른 제스처나 시스템이 가로채 끊긴 터치는 위치를 옮기지 않는다
      if (!event.canceled) {
        scheduleOnRN(onSeek, getDragRatio(event.x, width));
      }
    },
  });

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    const direction = nativeEvent.actionName === 'increment' ? 1 : -1;
    onSeek(clamp(positionRatio.get() + direction * accessibilityStepRatio, 0, 1));
  };

  // 칸 수가 그대로면 값이 같아 아래 경로를 다시 만들지 않는다. 드래그 중에도 칸이 바뀔 때만 그린다
  const playedBarCount = useDerivedValue(() =>
    getPlayedBarCount(dragRatio.get() ?? positionRatio.get(), barCount),
  );

  const readPlayedBarCount = () => {
    'worklet';
    return playedBarCount.get();
  };

  const playedPath = useRebuiltPath(readPlayedBarCount, (builder, playedCount) => {
    'worklet';
    addBars(builder, bars, 0, playedCount, height);
  });

  const restPath = useRebuiltPath(readPlayedBarCount, (builder, playedCount) => {
    'worklet';
    addBars(builder, bars, playedCount, bars.length, height);
  });

  const flagPath = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    flagIndexes.forEach((flagIndex) => {
      const x = Math.floor((flagIndex / Math.max(levels.length, 1)) * barCount) * STEP;
      builder.addRect({ x, y: 0, width: FLAG.poleWidth, height: height * FLAG.poleHeightShare });
      builder
        .moveTo(x + FLAG.poleWidth, 0)
        .lineTo(x + FLAG.poleWidth + FLAG.width, FLAG.height / 2)
        .lineTo(x + FLAG.poleWidth, FLAG.height)
        .close();
    });
    const path = builder.detach();
    builder.dispose();
    return path;
  }, [flagIndexes, levels.length, barCount, height]);
  // prop 경로는 Canvas가 커밋 때 복사해 기록하므로 정리 함수에서 바로 놓는다(shared value 경로와 다르다)
  useEffect(() => () => flagPath.dispose(), [flagPath]);

  return (
    <GestureDetector gesture={gesture}>
      <Box
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={accessibilityValue}
        accessibilityActions={SCRUBBER_ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={handleAccessibilityAction}
        className={cn('h-8', className)}
        onLayout={handleLayout}
      >
        <Canvas style={{ flex: 1 }}>
          <Path path={restPath} color={restColor} />
          <Path path={playedPath} color={playedColor} />
          <Path path={flagPath} color={playedColor} />
        </Canvas>
      </Box>
    </GestureDetector>
  );
}
