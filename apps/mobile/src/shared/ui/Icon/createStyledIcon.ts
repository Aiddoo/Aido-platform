import type { ComponentType } from 'react';
import { withUniwind } from 'uniwind';

/**
 * SVG 아이콘 컴포넌트를 withUniwind로 래핑하여 colorClassName prop을 지원하도록 합니다.
 *
 * @example
 * const StyledArrowIcon = createStyledIcon(ArrowRightIconSvg);
 * <StyledArrowIcon colorClassName="accent-gray-6" />
 */
export function createStyledIcon<P extends { color?: string }>(IconComponent: ComponentType<P>) {
  return withUniwind(IconComponent, {
    color: {
      fromClassName: 'colorClassName',
      styleProperty: 'accentColor',
    },
  });
}
