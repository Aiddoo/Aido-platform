import { readMockPath } from '@src/testing/mocks/react-native-skia';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, renderHook } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

import { useRebuiltPath } from './use-rebuilt-path';

/** 프레임 콜백·UI 스레드 예약이 모두 돌 만큼 흘린다 */
const FRAMES_MS = 100;
/** 번개처럼 시계는 매 프레임 바뀌어도 모양은 이 구간마다 한 번 바뀐다 */
const WINDOW_MS = 1_000;

interface WindowPathProps {
  time: SharedValue<number>;
  width: number;
}

function useWindowPath({ time, width }: WindowPathProps) {
  return useRebuiltPath(
    () => {
      'worklet';
      return Math.floor(time.get() / WINDOW_MS);
    },
    (builder, window) => {
      'worklet';
      builder.moveTo(0, 0).lineTo(width, window);
    },
  );
}

async function nextFrames() {
  await act(async () => {
    jest.advanceTimersByTime(FRAMES_MS);
  });
}

describe('useRebuiltPath', () => {
  setupFakeTimersPerTest();

  it('시계가 바뀌어도 읽은 구간이 같으면 경로를 다시 만들지 않고, 구간이 바뀌면 새로 그린 뒤 앞 경로를 놓는다', async () => {
    // Given
    const time = makeMutable(0);
    const { result } = await renderHook(useWindowPath, { initialProps: { time, width: 100 } });
    await nextFrames();
    const first = result.current.get();

    // When
    time.set(500);
    await nextFrames();
    const inSameWindow = result.current.get();
    time.set(2_500);
    await nextFrames();

    // Then
    expect(inSameWindow).toBe(first);
    expect(readMockPath(result.current.get()).commands).toEqual(['moveTo(0,0)', 'lineTo(100,2)']);
    expect(readMockPath(first).isDisposed).toBe(true);
  });

  it('draw가 품은 값이 바뀌면 읽은 값이 같아도 다시 그린다', async () => {
    // Given
    const time = makeMutable(3_000);
    const { result, rerender } = await renderHook(useWindowPath, {
      initialProps: { time, width: 100 },
    });
    await nextFrames();

    // When
    await rerender({ time, width: 200 });
    await nextFrames();

    // Then
    expect(readMockPath(result.current.get()).commands).toEqual(['moveTo(0,0)', 'lineTo(200,3)']);
  });

  it('StrictMode처럼 effect만 다시 돌아도 놓은 빌더로 그리지 않고 계속 그린다', async () => {
    // Given
    const time = makeMutable(0);
    const { result } = await renderHook(useWindowPath, {
      initialProps: { time, width: 100 },
      wrapper: StrictMode,
    });
    await nextFrames();

    // When
    time.set(7_000);
    await nextFrames();

    // Then
    const path = readMockPath(result.current.get());
    expect(path.commands).toEqual(['moveTo(0,0)', 'lineTo(100,7)']);
    expect(path.isDisposed).toBe(false);
  });

  it('내려가면 마지막 경로를 놓는다', async () => {
    // Given
    const time = makeMutable(2_000);
    const { result, unmount } = await renderHook(useWindowPath, {
      initialProps: { time, width: 100 },
    });
    await nextFrames();
    const last = result.current.get();

    // When
    await unmount();
    await nextFrames();

    // Then
    expect(readMockPath(last).isDisposed).toBe(true);
  });
});
