import { Skia, type SkPath, type SkPathBuilder } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { type SharedValue, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

// Skia usePathValue는 콜백 안 shared value를 입력으로 찾지 못하고 앞 경로를 놓지 않는다. 입력은 read가 읽은 값뿐이다.
// 정리 effect가 마운트마다 한 번만 돈다고 본다. StrictMode·expo-router activityEnabled(React Activity)처럼 effect만
// 다시 돌면 놓은 빌더·경로를 다시 쓰므로, 둘 중 하나를 켜기 전에 빌더·경로를 effect 안에서 만들도록 바꾼다(ui.md)
export function useRebuiltPath<T>(
  read: () => T,
  draw: (builder: SkPathBuilder, input: T) => void,
): SharedValue<SkPath> {
  const builder = useMemo(() => Skia.PathBuilder.Make(), []);
  const emptyPath = useMemo(() => Skia.Path.Make(), []);
  const path = useSharedValue(emptyPath);

  useAnimatedReaction(read, (input) => {
    draw(builder, input);
    const previous = path.get();
    // detach는 경로를 넘기고 빌더를 비워 다음 프레임에 그대로 다시 쓴다
    path.set(builder.detach());
    // Canvas는 경로를 값으로 복사해 그려 앞 경로를 바로 놓아도 된다
    previous.dispose();
  });

  useEffect(
    () => () => {
      // 내려가는 같은 프레임에 Canvas 매퍼가 마지막 경로를 한 번 더 읽을 수 있어 다음 프레임에 놓는다
      scheduleOnUI(() => {
        requestAnimationFrame(() => {
          path.get().dispose();
          builder.dispose();
        });
      });
    },
    [builder, path],
  );

  return path;
}
