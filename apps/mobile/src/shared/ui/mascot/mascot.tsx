import catHiImage from '@assets/images/ido_cat_hi.webp';
import catSuggestionImage from '@assets/images/ido_cat_suggestion.webp';
import weatherAnchorImage from '@assets/images/weather/mascot-anchor.png';
import weatherSuggestionImage from '@assets/images/weather/mascot-suggestion.webp';
import type { ComponentProps } from 'react';

import { Image } from '../image/image';

// ido_cat_hi는 든 손 때문에 몸통 중심이 캔버스 중심보다 오른쪽(554/1024)에 있어 가운데 둘 때 그만큼 왼쪽으로 옮긴다
const MASCOTS = {
  catHi: { source: catHiImage, centerOffsetRatio: (512 - 554) / 1024 },
  catSuggestion: { source: catSuggestionImage, centerOffsetRatio: 0 },
  weatherAnchor: { source: weatherAnchorImage, centerOffsetRatio: 0 },
  weatherSuggestion: { source: weatherSuggestionImage, centerOffsetRatio: 0 },
} as const;

type MascotProps = Omit<ComponentProps<typeof Image>, 'source'> & {
  name: keyof typeof MASCOTS;
  /** 없으면 크기를 호출부 style·className이 정한다(`isCentered`는 `size`가 있어야 한다) */
  size?: number;
  isCentered?: boolean;
};

export function Mascot({ name, size, isCentered = false, style, ...props }: MascotProps) {
  const { source, centerOffsetRatio } = MASCOTS[name];
  const centerOffset = isCentered && size != null ? centerOffsetRatio * size : 0;

  return (
    <Image
      source={source}
      accessibilityIgnoresInvertColors
      contentFit="contain"
      style={[
        size != null && { width: size, height: size },
        centerOffset !== 0 && { transform: [{ translateX: centerOffset }] },
        style,
      ]}
      {...props}
    />
  );
}
