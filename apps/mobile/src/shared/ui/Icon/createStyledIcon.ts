import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';
import { withUniwind } from 'uniwind';

/**
 * SVG 아이콘 컴포넌트를 withUniwind로 래핑하여 colorClassName prop을 지원하도록 합니다.
 *
 * @example
 * const StyledArrowIcon = createStyledIcon(ArrowRightIconSvg);
 * <StyledArrowIcon colorClassName="accent-gray-6" width={24} height={24} />
 */
export function createStyledIcon<P extends SvgProps>(IconComponent: ComponentType<P>) {
  return withUniwind(IconComponent, {
    color: {
      fromClassName: 'colorClassName',
      styleProperty: 'color',
    },
  });
}
