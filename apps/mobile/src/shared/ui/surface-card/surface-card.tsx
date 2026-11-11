import { cn } from '@src/shared/utils/cn';
import { Surface } from 'heroui-native';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

type SurfaceCardProps = Omit<ComponentProps<typeof Surface>, 'variant'> & {
  surface?: keyof typeof SURFACE_CLASS_NAMES;
};

const SURFACE_CLASS_NAMES = {
  screen: '',
  sheet: 'dark:bg-gray-2',
} as const;

// heroui Surface의 continuous 곡선을 기존 손그림 카드의 기본 곡선으로 맞춘다
const styles = StyleSheet.create({
  card: { borderCurve: 'circular' },
});

export function SurfaceCard({ surface = 'screen', className, style, ...props }: SurfaceCardProps) {
  return (
    // transparent는 SurfaceContext를 만들지 않아 안의 Checkbox·Input이 secondary 색으로 바뀌지 않는다
    <Surface
      variant="transparent"
      className={cn(
        'overflow-visible rounded-2xl bg-gray-1',
        SURFACE_CLASS_NAMES[surface],
        className,
      )}
      style={[styles.card, style]}
      {...props}
    />
  );
}
