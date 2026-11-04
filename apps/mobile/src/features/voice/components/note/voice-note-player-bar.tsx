import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, PauseIcon, PlayIcon, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { clamp } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { WAVEFORM_BAR } from '../../constants/voice-note.constants';
import { useSkiaColor } from '../../hooks/use-skia-color';
import { useVoiceNotePlayback, type VoiceNotePlayer } from '../../hooks/use-voice-note-player';
import { formatMediaTime } from '../../utils/format-media-time';
import { resampleLevels } from '../../utils/view-models/waveform.view-model';

const STEP = WAVEFORM_BAR.width + WAVEFORM_BAR.gap;
const BAR_VERTICAL_SHARE = 0.8;
const FLAG = { poleWidth: 2, width: 6, height: 6 } as const;

interface VoiceNotePlayerBarProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  player: VoiceNotePlayer;
  /** 한 칸이 `WAVEFORM_BAR.intervalMs`인 노트 전체 소리 크기 */
  levels: readonly number[];
  flagIndexes: readonly number[];
  /** 녹음 파일이 기기에 아직 있는지. 없으면 파형 대신 안내를 보인다 */
  isRecordingAvailable: boolean;
}

/** 위쪽에 고정하는 미니 플레이어. 재생 버튼, 누르거나 끌어 옮기는 파형 스크러버, 시간으로 이뤄진다 */
export function VoiceNotePlayerBar({
  player,
  levels,
  flagIndexes,
  isRecordingAvailable,
  className,
  ...stackProps
}: VoiceNotePlayerBarProps) {
  const { t } = useTranslation('voiceNote');
  const playback = useVoiceNotePlayback(player, (current) => current);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const positionRatio = playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0;
  const shownMs = dragRatio == null ? playback.positionMs : dragRatio * playback.durationMs;

  if (!isRecordingAvailable) {
    return (
      <HStack className={cn('rounded-2xl bg-gray-1 px-3 py-3', className)} {...stackProps}>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('player.unavailable')}
        </Text>
      </HStack>
    );
  }

  return (
    <HStack
      gap={12}
      className={cn('items-center rounded-2xl bg-gray-1 px-3 py-3', className)}
      {...stackProps}
    >
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={playback.isPlaying ? t('player.pause') : t('player.play')}
        isDisabled={!playback.isLoaded}
        hitSlop={4}
        onPress={player.togglePlay}
        className="size-9 items-center justify-center rounded-full bg-main"
      >
        {playback.isPlaying ? (
          <PauseIcon colorClassName="accent-white" width={14} height={14} />
        ) : (
          <PlayIcon colorClassName="accent-white" width={14} height={14} />
        )}
      </PressableFeedback>
      <Scrubber
        levels={levels}
        flagIndexes={flagIndexes}
        ratio={dragRatio ?? positionRatio}
        accessibilityLabel={t('player.position')}
        accessibilityValue={{
          text: t('player.positionValue', {
            position: formatMediaTime(shownMs),
            duration: formatMediaTime(playback.durationMs),
          }),
        }}
        onDrag={setDragRatio}
        onSeek={(ratio) => player.seekTo(ratio * playback.durationMs)}
        className="flex-1"
      />
      <Text size="e1" shade={7} maxLines={1} className="tabular-nums">
        {formatMediaTime(shownMs)} / {formatMediaTime(playback.durationMs)}
      </Text>
    </HStack>
  );
}

interface ScrubberProps extends Omit<
  ComponentProps<typeof Box>,
  'children' | 'onLayout' | 'accessibilityRole'
> {
  levels: readonly number[];
  flagIndexes: readonly number[];
  /** 0..1 재생 위치 */
  ratio: number;
  onDrag: (ratio: number | null) => void;
  onSeek: (ratio: number) => Promise<void>;
}

function Scrubber({
  levels,
  flagIndexes,
  ratio,
  onDrag,
  onSeek,
  className,
  ...boxProps
}: ScrubberProps) {
  const playedColor = useSkiaColor('text-main');
  const restColor = useSkiaColor('text-gray-4');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const barCount = Math.floor(size.width / STEP);
  const toRatio = (x: number) => (size.width > 0 ? clamp(x / size.width, 0, 1) : 0);

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((event) => onDrag(toRatio(event.x)))
    .onUpdate((event) => onDrag(toRatio(event.x)))
    .onFinalize((event) => {
      onDrag(null);
      onSeek(toRatio(event.x)).catch(() => undefined);
    });

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  const radius = WAVEFORM_BAR.width / 2;
  const playedPath = Skia.PathBuilder.Make();
  const restPath = Skia.PathBuilder.Make();
  resampleLevels(levels, barCount).forEach((level, index) => {
    const height = Math.max(
      size.height * WAVEFORM_BAR.minHeightRatio,
      level * size.height * BAR_VERTICAL_SHARE,
    );
    (index / barCount < ratio ? playedPath : restPath).addRRect(
      Skia.RRectXY(
        Skia.XYWHRect(index * STEP, (size.height - height) / 2, WAVEFORM_BAR.width, height),
        radius,
        radius,
      ),
    );
  });

  const flagPath = Skia.PathBuilder.Make();
  flagIndexes.forEach((flagIndex) => {
    const x = Math.floor((flagIndex / Math.max(levels.length, 1)) * barCount) * STEP;
    flagPath.addRect(Skia.XYWHRect(x, 0, FLAG.poleWidth, size.height * 0.45));
    flagPath
      .moveTo(x + FLAG.poleWidth, 0)
      .lineTo(x + FLAG.poleWidth + FLAG.width, FLAG.height / 2)
      .lineTo(x + FLAG.poleWidth, FLAG.height)
      .close();
  });

  return (
    <GestureDetector gesture={gesture}>
      <Box
        accessibilityRole="adjustable"
        className={cn('h-8', className)}
        onLayout={handleLayout}
        {...boxProps}
      >
        <Canvas style={{ flex: 1 }}>
          <Path path={restPath.build()} color={restColor} />
          <Path path={playedPath.build()} color={playedColor} />
          <Path path={flagPath.build()} color={playedColor} />
        </Canvas>
      </Box>
    </GestureDetector>
  );
}
