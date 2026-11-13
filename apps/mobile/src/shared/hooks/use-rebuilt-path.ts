import { Skia, type SkPath, type SkPathBuilder } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { type SharedValue, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

// 그리기 전과 놓은 뒤 Canvas가 읽는 자리다. 모든 훅이 함께 쓰고 놓지 않는다
const EMPTY_PATH = Skia.Path.Make();

interface DrawnInput<T> {
  input: T;
}

/**
 * read가 읽은 값(`===`)이나 draw가 바뀔 때만 경로를 다시 그린다. 빌더 하나를 되쓰고 앞 경로는 바로 놓는다.
 * Skia usePathValue는 콜백 안 shared value를 입력으로 찾지 못하고 앞 경로를 놓지 않는다
 */
export function useRebuiltPath<T>(
  read: () => T,
  draw: (builder: SkPathBuilder, input: T) => void,
): SharedValue<SkPath> {
  const path = useSharedValue(EMPTY_PATH);
  const builder = useSharedValue<SkPathBuilder | null>(null);
  const drawn = useSharedValue<DrawnInput<T> | null>(null);

  // draw가 품은 크기·막대가 바뀌면 같은 입력도 다시 그린다. 리액션을 다시 걸기 전에 UI 스레드에 닿게 위에 둔다
  useEffect(() => {
    drawn.set(null);
  }, [draw, drawn]);

  useAnimatedReaction(read, (input) => {
    if (drawn.get()?.input === input) {
      return;
    }
    const reused = builder.get();
    const current = reused ?? Skia.PathBuilder.Make();
    draw(current, input);
    const previous = path.get();
    // detach는 경로를 넘기고 빌더를 비워 다음에 그대로 다시 쓴다
    path.set(current.detach());
    builder.set(current);
    drawn.set({ input });
    // Canvas는 경로를 값으로 복사해 그려 앞 경로를 바로 놓아도 된다. 빌더가 없던 첫 그림의 앞 경로는 함께 쓰는 빈 경로다
    if (reused != null) {
      previous.dispose();
    }
  });

  useEffect(
    () => () => {
      scheduleOnUI(() => {
        const retiredBuilder = builder.get();
        const retiredPath = path.get();
        // 내려가는 프레임에 Canvas 매퍼가 한 번 더 읽어도 놓은 경로를 만나지 않게 빈 경로로 먼저 바꾼다
        path.set(EMPTY_PATH);
        builder.set(null);
        drawn.set(null);
        // effect만 다시 도는 StrictMode·Activity에서는 다음 그림이 새 빌더를 만든다
        if (retiredBuilder != null) {
          retiredBuilder.dispose();
          retiredPath.dispose();
        }
      });
    },
    [builder, drawn, path],
  );

  return path;
}
