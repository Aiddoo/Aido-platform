import { range } from 'es-toolkit';
import { type ReactNode, useCallback, useState } from 'react';
import { type ColorValue, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

import { Box } from '../box';

const SCALLOP_RADIUS = 8;

export interface ScallopedContainerProps {
  children: ReactNode;
}

export function ScallopedContainer({ children }: ScallopedContainerProps) {
  const [width, setWidth] = useState(0);
  const { backgroundColor: fill } = useResolveClassNames('bg-gray-1');

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <Box onLayout={onLayout}>
      {width > 0 && <ScallopEdge width={width} position="top" fill={fill} />}
      <Box style={{ backgroundColor: fill }}>{children}</Box>
      {width > 0 && <ScallopEdge width={width} position="bottom" fill={fill} />}
    </Box>
  );
}

function ScallopEdge({
  width,
  position,
  fill,
}: {
  width: number;
  position: 'top' | 'bottom';
  fill: ColorValue | undefined;
}) {
  const radius = SCALLOP_RADIUS;
  const count = Math.floor(width / (radius * 2));
  const actualWidth = count * radius * 2;
  const offset = (width - actualWidth) / 2;

  const { innerY, outerY, sweepFlag } =
    position === 'top'
      ? { innerY: radius, outerY: 0, sweepFlag: 0 }
      : { innerY: 0, outerY: radius, sweepFlag: 1 };
  const arcs = range(count)
    .map((index) => {
      const x = offset + (index + 1) * radius * 2;
      return ` A ${radius},${radius} 0 0,${sweepFlag} ${x},${outerY}`;
    })
    .join('');
  const pathData = `M 0,${innerY} L 0,${outerY} L ${offset},${outerY}${arcs} L ${width},${outerY} L ${width},${innerY} Z`;

  return (
    <Svg width={width} height={radius} viewBox={`0 0 ${width} ${radius}`}>
      <Path d={pathData} fill={fill} />
    </Svg>
  );
}
