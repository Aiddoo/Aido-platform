import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

interface LayoutSize {
  width: number;
  height: number;
}

/** 그려진 뒤의 크기. 첫 레이아웃 전에는 0이다. Skia `Canvas`는 `onLayout`을 받지 않아 `onSize`로 잰다 */
export function useLayoutSize(): readonly [LayoutSize, (event: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<LayoutSize>({ width: 0, height: 0 });

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  };

  return [size, handleLayout] as const;
}
