import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';
import { withUniwind } from 'uniwind';

export function createStyledIcon<P extends SvgProps>(IconComponent: ComponentType<P>) {
  return withUniwind(IconComponent, {
    color: {
      fromClassName: 'colorClassName',
      styleProperty: 'color',
    },
  });
}

export type StyledIcon = ReturnType<typeof createStyledIcon>;
