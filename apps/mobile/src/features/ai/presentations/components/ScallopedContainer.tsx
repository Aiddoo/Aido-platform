import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

const SCALLOP_RADIUS = 8;

interface ScallopedContainerProps {
  children: React.ReactNode;
}

export function ScallopedContainer({ children }: ScallopedContainerProps) {
  const [width, setWidth] = useState(0);
  const { backgroundColor: fill } = useResolveClassNames('bg-white');

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  return (
    <View onLayout={onLayout}>
      {width > 0 && <ScallopEdge width={width} position="top" fill={fill as string} />}
      <View style={{ backgroundColor: fill }}>{children}</View>
      {width > 0 && <ScallopEdge width={width} position="bottom" fill={fill as string} />}
    </View>
  );
}

function ScallopEdge({
  width,
  position,
  fill,
}: {
  width: number;
  position: 'top' | 'bottom';
  fill: string;
}) {
  const r = SCALLOP_RADIUS;
  const count = Math.floor(width / (r * 2));
  const actualWidth = count * r * 2;
  const offset = (width - actualWidth) / 2;

  let d: string;

  if (position === 'top') {
    d = `M 0,${r} L 0,0 L ${offset},0`;
    for (let i = 0; i < count; i++) {
      const x = offset + (i + 1) * r * 2;
      d += ` A ${r},${r} 0 0,0 ${x},0`;
    }
    d += ` L ${width},0 L ${width},${r} Z`;
  } else {
    d = `M 0,0 L 0,${r} L ${offset},${r}`;
    for (let i = 0; i < count; i++) {
      const x = offset + (i + 1) * r * 2;
      d += ` A ${r},${r} 0 0,1 ${x},${r}`;
    }
    d += ` L ${width},${r} L ${width},0 Z`;
  }

  return (
    <Svg width={width} height={r} viewBox={`0 0 ${width} ${r}`}>
      <Path d={d} fill={fill} />
    </Svg>
  );
}
