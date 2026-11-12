import { SECOND_MS } from '@src/shared/constants/time-units';
import { useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { clamp } from 'es-toolkit';
import type { ComponentProps } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { formatMediaTime } from '../../utils/media-time.view-model';
import { getRecordingRingLayout } from '../../utils/recording-timer.geometry';

/** 원은 3시 방향에서 시작하므로 12시부터 차오르게 돌린다 */
const RING_START_ANGLE = -90;

interface RecordingTimerProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  elapsedMs: number;
  /** 한 번에 녹음할 수 있는 최대 길이. 서버 `featureQuota.perUse.maxSeconds`에서 온 값이고, 끝이 없으면 null이다 */
  limitMs: number | null;
  label?: string;
}

export function RecordingTimer({
  elapsedMs,
  limitMs,
  label,
  className,
  ...boxProps
}: RecordingTimerProps) {
  const { t } = useTranslation('voiceNote');
  const trackColor = useResolvedColor('text-gray-2');
  const progressColor = useResolvedColor('text-main');
  const { height: windowHeight } = useWindowDimensions();
  const ring = getRecordingRingLayout(windowHeight);
  const center = ring.size / 2;
  const timeMinimumFontScale = useMinimumFontScale('h1');
  const labelMinimumFontScale = useMinimumFontScale('b4');
  const progress = limitMs != null && limitMs > 0 ? clamp(elapsedMs / limitMs, 0, 1) : 0;
  // 남은 시간은 올림한다. 시작하자마자 한 칸 줄어 보이거나 0:00에 아직 듣는 일이 없게 한다
  const remainingMs =
    limitMs == null ? null : Math.ceil(Math.max(0, limitMs - elapsedMs) / SECOND_MS) * SECOND_MS;
  const remainingTime = remainingMs == null ? null : formatMediaTime(remainingMs);

  return (
    <Box
      accessible
      accessibilityLabel={
        remainingTime == null
          ? t('timer.a11yNoLimit', { elapsed: formatMediaTime(elapsedMs) })
          : t('timer.a11y', { elapsed: formatMediaTime(elapsedMs), remaining: remainingTime })
      }
      className={cn('items-center justify-center', className)}
      style={{ width: ring.size, height: ring.size }}
      {...boxProps}
    >
      {/* Android의 Skia는 앱을 켤 때의 화면 배율을 계속 쓴다. 켜 둔 채 디스플레이 크기를 바꾸면 링만 커져 잘리므로 SVG로 그린다 */}
      <Svg width={ring.size} height={ring.size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={ring.radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={ring.strokeWidth}
        />
        {progress > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={ring.radius}
            fill="none"
            stroke={progressColor}
            strokeWidth={ring.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={[progress * ring.circumference, ring.circumference]}
            transform={`rotate(${RING_START_ANGLE} ${center} ${center})`}
            testID="recording-timer-progress"
          />
        )}
      </Svg>
      <Text
        size="h1"
        weight="bold"
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={timeMinimumFontScale}
        className="tabular-nums"
        style={{ width: ring.textWidth }}
      >
        {formatMediaTime(elapsedMs)}
      </Text>
      {(label != null || remainingTime != null) && (
        <Text
          size="b4"
          shade={6}
          align="center"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={labelMinimumFontScale}
          className="tabular-nums"
          style={{ width: ring.textWidth }}
        >
          {label ?? t('timer.remaining', { time: remainingTime })}
        </Text>
      )}
    </Box>
  );
}
