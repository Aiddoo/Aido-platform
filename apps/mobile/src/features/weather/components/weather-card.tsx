import { useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { HStack, Text, VStack } from '@src/shared/ui';
import { tv } from '@src/shared/utils/tv';
import { Card, GlassView } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { useUniwind } from 'uniwind';

import { ALERT_SURFACE_COLORS } from '../constants/weather-colors.constants';
import { useWeatherSurface } from '../hooks/use-weather-surface';

const GLASS_INTENSITY = 40;
const HAS_BACKDROP_BLUR = process.env.EXPO_OS === 'ios';

const weatherCard = tv({
  slots: {
    frame: 'grow gap-0 overflow-hidden rounded-[22px] border-[0.5px] p-0',
    body: 'grow gap-2',
  },
  variants: {
    density: {
      default: { body: 'px-4 py-3.5' },
      tile: { body: 'gap-0 p-3.5' },
    },
  },
  defaultVariants: { density: 'default' },
});

type WeatherCardTone = 'default' | 'alert';

interface WeatherCardProps extends Omit<
  ComponentProps<typeof Card>,
  'variant' | 'className' | 'children'
> {
  title?: string;
  icon?: ReactNode;
  /** alert는 특보처럼 주의를 끄는 주황 유리 면이다. */
  tone?: WeatherCardTone;
  density?: 'default' | 'tile';
  /** 카드 면이 아니라 안쪽(body) 여백·간격을 시안의 카드별 값으로 바꿀 때 쓴다. */
  className?: string;
  children: ReactNode;
}

/**
 * 하늘 장면 위에 놓이는 유리 카드. 면은 장면 색조로 반투명하게 물들이고 iOS에서만 뒤를 흐린다.
 * Android는 블러 없이 같은 반투명 면만 그리고, 투명도 줄이기에서는 불투명 면으로 그린다.
 * 격자 칸처럼 부모가 높이를 정하면 그 높이를 채워 같은 줄 카드의 높이가 맞는다.
 */
export function WeatherCard({
  title,
  icon,
  tone = 'default',
  density,
  className,
  children,
  style,
  ...cardProps
}: WeatherCardProps) {
  const surface = useWeatherSurface();
  const { theme } = useUniwind();
  const { isOpaque } = surface;
  const alertBackground = isOpaque
    ? ALERT_SURFACE_COLORS.opaque
    : ALERT_SURFACE_COLORS[theme === 'dark' ? 'dark' : 'light'];
  /** 기본은 하늘 장면 색조, alert는 주황으로 물들이고 투명도 줄이기에서는 불투명하게 그린다. */
  const background = tone === 'default' ? surface.card : alertBackground;
  const edge = tone === 'default' ? surface.cardEdge : ALERT_SURFACE_COLORS.edge;
  const minimumFontScale = useMinimumFontScale('b4');
  const styles = weatherCard({ density });

  return (
    <Card
      variant="transparent"
      className={styles.frame()}
      style={[{ borderColor: edge }, style]}
      {...cardProps}
    >
      {HAS_BACKDROP_BLUR && !isOpaque && (
        <GlassView intensity={GLASS_INTENSITY} tint="systemUltraThinMaterialDark" />
      )}
      <VStack className={styles.body({ className })} style={{ backgroundColor: background }}>
        {title != null && (
          <HStack gap={6} align="center" accessibilityRole="header">
            {icon}
            <Text
              size="b4"
              weight="medium"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={minimumFontScale}
              className="shrink leading-[18px] text-on-sky/[0.62]"
            >
              {title}
            </Text>
          </HStack>
        )}
        {children}
      </VStack>
    </Card>
  );
}
