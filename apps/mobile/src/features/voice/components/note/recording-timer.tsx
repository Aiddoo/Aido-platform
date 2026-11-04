import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useTranslation } from '@src/shared/i18n';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { clamp } from 'es-toolkit';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import { useSkiaColor } from '../../hooks/use-skia-color';
import { formatMediaTime } from '../../utils/format-media-time';

const RING = { size: 156, strokeWidth: 5, startAngle: -90, fullSweep: 359.99 } as const;
const DEGREES = 360;

interface RecordingTimerProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  elapsedMs: number;
  /** 한 번에 녹음할 수 있는 최대 길이. 서버 `featureQuota.perUse.maxSeconds`에서 온 값이고, 끝이 없으면 null이다 */
  limitMs: number | null;
  /** 잠시 멈춘 때처럼 남은 시간 대신 보일 글자 */
  label?: string;
}

/** 큰 타이머 둘레에 한 번에 녹음할 수 있는 시간이 얼마나 찼는지 보여주는 링 */
export function RecordingTimer({
  elapsedMs,
  limitMs,
  label,
  className,
  ...boxProps
}: RecordingTimerProps) {
  const { t } = useTranslation('voiceNote');
  const trackColor = useSkiaColor('text-gray-2');
  const progressColor = useSkiaColor('text-main');
  const inset = RING.strokeWidth / 2;
  const bounds = Skia.XYWHRect(
    inset,
    inset,
    RING.size - RING.strokeWidth,
    RING.size - RING.strokeWidth,
  );
  const progress = limitMs != null && limitMs > 0 ? clamp(elapsedMs / limitMs, 0, 1) : 0;
  // 남은 시간은 올림한다. 시작하자마자 한 칸 줄어 보이거나 0:00에 아직 듣는 일이 없게 한다
  const remainingMs =
    limitMs == null ? null : Math.ceil(Math.max(0, limitMs - elapsedMs) / 1_000) * 1_000;
  const remainingTime = remainingMs == null ? null : formatMediaTime(remainingMs);

  const track = Skia.PathBuilder.Make().addArc(bounds, RING.startAngle, RING.fullSweep).build();
  const arc = Skia.PathBuilder.Make()
    .addArc(bounds, RING.startAngle, Math.min(progress * DEGREES, RING.fullSweep))
    .build();

  return (
    <Box
      accessible
      accessibilityLabel={
        remainingTime == null
          ? t('timer.a11yNoLimit', { elapsed: formatMediaTime(elapsedMs) })
          : t('timer.a11y', { elapsed: formatMediaTime(elapsedMs), remaining: remainingTime })
      }
      className={cn('items-center justify-center', className)}
      style={{ width: RING.size, height: RING.size }}
      {...boxProps}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={track} style="stroke" strokeWidth={RING.strokeWidth} color={trackColor} />
        {progress > 0 && (
          <Path
            path={arc}
            style="stroke"
            strokeWidth={RING.strokeWidth}
            strokeCap="round"
            color={progressColor}
          />
        )}
      </Canvas>
      <Text size="h1" weight="bold" align="center" className="tabular-nums">
        {formatMediaTime(elapsedMs)}
      </Text>
      {(label != null || remainingTime != null) && (
        <Text size="b4" shade={6} align="center" maxLines={1} className="tabular-nums">
          {label ?? t('timer.remaining', { time: remainingTime })}
        </Text>
      )}
    </Box>
  );
}
