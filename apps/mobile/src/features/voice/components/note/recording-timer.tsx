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
  /** 한 번에 녹음할 수 있는 최대 길이. 서버 `featureQuota.perUse.maxSeconds`에서 온 값이다 */
  limitMs: number;
}

/** 큰 타이머 둘레에 한 번에 녹음할 수 있는 시간이 얼마나 찼는지 보여주는 링 */
export function RecordingTimer({
  elapsedMs,
  limitMs,
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
  const progress = limitMs > 0 ? clamp(elapsedMs / limitMs, 0, 1) : 0;

  const track = Skia.PathBuilder.Make().addArc(bounds, RING.startAngle, RING.fullSweep).build();
  const arc = Skia.PathBuilder.Make()
    .addArc(bounds, RING.startAngle, Math.min(progress * DEGREES, RING.fullSweep))
    .build();

  return (
    <Box
      accessible
      accessibilityLabel={t('timer.a11y', {
        elapsed: formatMediaTime(elapsedMs),
        limit: formatMediaTime(limitMs),
      })}
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
      <Text size="b4" shade={6} align="center" maxLines={1} className="tabular-nums">
        {t('timer.limit', { time: formatMediaTime(limitMs) })}
      </Text>
    </Box>
  );
}
