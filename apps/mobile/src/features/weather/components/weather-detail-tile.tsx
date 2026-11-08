import { useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Box, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { type ReactNode, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { WeatherCard } from './weather-card';
import { WeatherIcon, type WeatherCardGlyph } from './weather-icon';

const FOUR_COLUMN_MIN_WIDTH = 760;
export const TILE_GRID_GAP = 12;
const TILE_PADDING = 14;
const TILE_BORDER = 1;
const TILE_HEADER_HEIGHT = 18;
const LARGE_TEXT_TILE_HEIGHT = 200;
const DIAL_MAX_SIZE = 140;
const VALUE_FONT_SIZE = 32;

interface TileLayout {
  columns: number;
  bodyMinHeight: number;
  onLayout: (event: LayoutChangeEvent) => void;
}

export function useTileLayout(): TileLayout {
  const isLargeText = useFontScale().fontScale === 'xlarge';
  const [width, setWidth] = useState(0);
  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const wideColumns = width >= FOUR_COLUMN_MIN_WIDTH ? 4 : 2;
  const columns = isLargeText ? wideColumns / 2 : wideColumns;
  const tileSide = (width - TILE_GRID_GAP * (columns - 1)) / columns;
  const tileHeight = isLargeText ? LARGE_TEXT_TILE_HEIGHT : tileSide;
  return {
    columns,
    bodyMinHeight: Math.max(0, tileHeight - TILE_PADDING * 2 - TILE_BORDER),
    onLayout: handleLayout,
  };
}

interface WeatherTileProps {
  icon: WeatherCardGlyph;
  title: string;
  minHeight: number;
  accessibilityLabel: string;
  note: string;
  children: ReactNode;
}

/** 모든 타일이 같은 뼈대(제목 → 본문 → 바닥에 붙은 문구)를 갖도록 높이와 순서를 고정한다. */
export function WeatherTile({
  icon,
  title,
  minHeight,
  accessibilityLabel,
  note,
  children,
}: WeatherTileProps) {
  const noteMinScale = useMinimumFontScale('b4');
  return (
    <WeatherCard title={title} icon={<WeatherIcon.Card glyph={icon} />} density="tile">
      <VStack
        className="grow"
        style={{ minHeight: Math.max(0, minHeight - TILE_HEADER_HEIGHT) }}
        accessible
        accessibilityLabel={accessibilityLabel}
      >
        {children}
        <Text
          size="b4"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={noteMinScale}
          className="mt-2 leading-[18px] text-on-sky/[0.78]"
        >
          {note}
        </Text>
      </VStack>
    </WeatherCard>
  );
}

interface WeatherTextTileProps {
  icon: WeatherCardGlyph;
  title: string;
  minHeight: number;
  value: string;
  subtitle: string;
  note: string;
  children?: ReactNode;
}

export function WeatherTextTile({
  icon,
  title,
  minHeight,
  value,
  subtitle,
  note,
  children,
}: WeatherTextTileProps) {
  const { t } = useTranslation('weather');
  const valueMinScale = useMinimumFontScale(VALUE_FONT_SIZE);
  const subMinScale = useMinimumFontScale('b1');

  return (
    <WeatherTile
      icon={icon}
      title={title}
      minHeight={minHeight}
      note={note}
      accessibilityLabel={t('details.tile', {
        title,
        value: t('details.tileValue', { value, sub: subtitle }),
        note,
      })}
    >
      <VStack className="mt-1.5 flex-1">
        <Text
          tone="onSky"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={valueMinScale}
          className="text-[32px] leading-[38px] font-normal tracking-[-1px] tabular-nums"
        >
          {value}
        </Text>
        <Text
          size="b1"
          weight="semibold"
          tone="onSky"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={subMinScale}
          className="leading-[23px]"
        >
          {subtitle}
        </Text>
        {children}
      </VStack>
    </WeatherTile>
  );
}

interface WeatherDialTileProps {
  icon: WeatherCardGlyph;
  title: string;
  minHeight: number;
  accessibilityValue: string;
  note: string;
  children: (size: number) => ReactNode;
}

export function WeatherDialTile({
  icon,
  title,
  minHeight,
  accessibilityValue,
  note,
  children,
}: WeatherDialTileProps) {
  const { t } = useTranslation('weather');
  const [size, setSize] = useState(0);
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(Math.floor(Math.min(width, height, DIAL_MAX_SIZE)));
  };

  return (
    <WeatherTile
      icon={icon}
      title={title}
      minHeight={minHeight}
      note={note}
      accessibilityLabel={t('details.tile', { title, value: accessibilityValue, note })}
    >
      <Box className="mt-1.5 flex-1 items-center justify-center" onLayout={handleLayout}>
        {size > 0 && <Box className="absolute">{children(size)}</Box>}
      </Box>
    </WeatherTile>
  );
}

WeatherTile.Loading = function Loading({ minHeight }: Pick<WeatherTileProps, 'minHeight'>) {
  return (
    <WeatherCard density="tile">
      <VStack gap={8} style={{ minHeight }}>
        <TextSkeleton size="b4" className="w-16 opacity-40" />
        <TextSkeleton size="t1" className="w-12 opacity-40" />
      </VStack>
    </WeatherCard>
  );
};
