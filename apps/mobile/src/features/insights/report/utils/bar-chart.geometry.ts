import type { SkRect, SkRRect } from '@shopify/react-native-skia';
import { clamp } from 'react-native-reanimated';

export interface BarValue {
  total: number;
  completed: number;
}

export interface BarShape {
  widthRatio: number;
  cornerRadius: number;
  minHeight: number;
}

export interface BarRect {
  track: SkRRect;
  fill: SkRect;
}

// 폭이 바뀔 때 UI 스레드에서 다시 계산한다. es-toolkit은 worklet이 아니라 Reanimated clamp를 쓴다
export function toBarRects(
  values: readonly BarValue[],
  width: number,
  height: number,
  shape: BarShape,
): readonly BarRect[] {
  'worklet';
  if (values.length === 0 || width <= 0 || height <= 0) {
    return [];
  }
  const slotWidth = width / values.length;
  const barWidth = slotWidth * shape.widthRatio;
  const radius = Math.min(shape.cornerRadius, barWidth / 2);
  const maxTotal = Math.max(1, ...values.map((value) => value.total));

  return values.map((value, index) => {
    const trackHeight = clamp((value.total / maxTotal) * height, shape.minHeight, height);
    const fillHeight = clamp((value.completed / maxTotal) * height, 0, trackHeight);
    const x = index * slotWidth + (slotWidth - barWidth) / 2;

    return {
      track: {
        rect: { x, y: height - trackHeight, width: barWidth, height: trackHeight },
        rx: radius,
        ry: radius,
      },
      fill: { x, y: height - fillHeight, width: barWidth, height: fillHeight },
    };
  });
}

export function toBarIndex(x: number, width: number, count: number): number {
  'worklet';
  if (width <= 0 || count <= 0) {
    return 0;
  }
  return clamp(Math.floor((x / width) * count), 0, count - 1);
}
