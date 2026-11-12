import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { range } from 'es-toolkit';
import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

import { Box } from '../box';

const SCALLOP_RADIUS = 8;

export interface ScallopedContainerProps {
  children: ReactNode;
}

export function ScallopedContainer({ children }: ScallopedContainerProps) {
  const [size, handleLayout] = useLayoutSize();
  const { backgroundColor: fill } = useResolveClassNames('bg-gray-1');
  const width = size?.width ?? 0;

  return (
    <Box onLayout={handleLayout}>
      {/* 폭을 재기 전에도 물결 자리를 잡아 첫 프레임 뒤에 내용이 밀리지 않게 한다 */}
      <Box style={{ height: SCALLOP_RADIUS }}>
        {width > 0 && <ScallopEdge width={width} position="top" fill={fill} />}
      </Box>
      <Box style={{ backgroundColor: fill }}>{children}</Box>
      <Box style={{ height: SCALLOP_RADIUS }}>
        {width > 0 && <ScallopEdge width={width} position="bottom" fill={fill} />}
      </Box>
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
