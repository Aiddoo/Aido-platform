import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

interface LayoutSize {
  width: number;
  height: number;
}

/** 그려진 뒤의 크기. 재기 전에는 null이라 첫 프레임은 호출부가 어림값(`size?.width ?? estimate`)으로 그린다 */
export function useLayoutSize(): readonly [LayoutSize | null, (event: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<LayoutSize | null>(null);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize((previous) =>
      previous?.width === width && previous.height === height ? previous : { width, height },
    );
  };

  return [size, handleLayout] as const;
}
