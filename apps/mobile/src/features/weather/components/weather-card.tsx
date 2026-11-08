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
  tone?: WeatherCardTone;
  density?: 'default' | 'tile';
  className?: string;
  children: ReactNode;
}

/** 하늘 장면 위에 놓이는 유리 카드 */
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
