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

  let pathData: string;

  if (position === 'top') {
    pathData = `M 0,${radius} L 0,0 L ${offset},0`;
    for (let index = 0; index < count; index++) {
      const x = offset + (index + 1) * radius * 2;
      pathData += ` A ${radius},${radius} 0 0,0 ${x},0`;
    }
    pathData += ` L ${width},0 L ${width},${radius} Z`;
  } else {
    pathData = `M 0,0 L 0,${radius} L ${offset},${radius}`;
    for (let index = 0; index < count; index++) {
      const x = offset + (index + 1) * radius * 2;
      pathData += ` A ${radius},${radius} 0 0,1 ${x},${radius}`;
    }
    pathData += ` L ${width},${radius} L ${width},0 Z`;
  }

  return (
    <Svg width={width} height={radius} viewBox={`0 0 ${width} ${radius}`}>
      <Path d={pathData} fill={fill} />
    </Svg>
  );
}
