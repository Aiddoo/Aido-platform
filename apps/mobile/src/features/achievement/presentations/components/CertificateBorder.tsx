import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

/** 상장 느낌의 이중 SVG 라운드 테두리 */
export function CertificateBorder({ children }: { children: React.ReactNode }) {
  const { color: strokeColor } = useResolveClassNames('text-main');
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const { width: w, height: h } = size;

  return (
    <View className="relative" onLayout={onLayout}>
      {w > 0 && h > 0 && (
        <View className="absolute inset-0">
          <Svg width={w} height={h}>
            <Rect
              x={2}
              y={2}
              width={w - 4}
              height={h - 4}
              rx={2}
              ry={2}
              stroke={strokeColor as string}
              strokeWidth={1.5}
              fill="none"
              strokeOpacity={0.6}
            />
            <Rect
              x={7}
              y={7}
              width={w - 14}
              height={h - 14}
              rx={1}
              ry={1}
              stroke={strokeColor as string}
              strokeWidth={0.5}
              fill="none"
              strokeOpacity={0.35}
            />
          </Svg>
        </View>
      )}
      <View className="m-2">{children}</View>
    </View>
  );
}
