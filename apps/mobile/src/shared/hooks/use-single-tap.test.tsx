import { setupFakeTimersPerTest } from '@src/testing/timers';
import { renderHook } from '@testing-library/react-native';

import { useSingleTap } from './use-single-tap';

/** 가드 간격(600ms)보다 확실히 긴 시간 */
const AFTER_GUARD_MS = 700;

/** 가드 간격보다 짧고 렌더가 건 타이머는 끝나는 시간 */
const RENDER_SETTLE_MS = 10;

/**
 * 시간은 렌더가 끝난 뒤에만 조작한다 — 렌더 도중 Date.now를 고정하면
 * React 스케줄러까지 멈춰 훅 결과가 준비되지 않는다.
 */
function freezeTimeAt(now: number) {
  jest.spyOn(Date, 'now').mockReturnValue(now);
}

describe('useSingleTap', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('짧은 간격의 연타는 한 번만 실행한다', async () => {
    // Given
    const onTap = jest.fn();
    const { result } = await renderHook(() => useSingleTap(onTap));
    freezeTimeAt(1_000);

    // When
    // 같은 프레임에 세 번 들어온 탭
    result.current();
    result.current();
    result.current();

    // Then
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('가드 시간이 지나면 다시 실행한다', async () => {
    // Given
    const onTap = jest.fn();
    const { result } = await renderHook(() => useSingleTap(onTap));

    // When
    freezeTimeAt(1_000);
    result.current();
    freezeTimeAt(1_000 + AFTER_GUARD_MS);
    result.current();

    // Then
    expect(onTap).toHaveBeenCalledTimes(2);
  });

  it('가장 최근에 넘긴 핸들러를 실행한다', async () => {
    // Given
    const staleTap = jest.fn();
    const latestTap = jest.fn();
    const { result, rerender } = await renderHook(
      (props: { onTap: () => void }) => useSingleTap(props.onTap),
      { initialProps: { onTap: staleTap } },
    );

    // When
    await rerender({ onTap: latestTap });
    result.current();

    // Then
    expect(latestTap).toHaveBeenCalledTimes(1);
    expect(staleTap).not.toHaveBeenCalled();
  });

  it('서로 다른 동작은 각자의 가드를 가져 연달아 실행된다', async () => {
    // Given
    // 예: 모달을 닫고 곧바로 다른 화면으로 이동하는 흐름
    const dismiss = jest.fn();
    const navigate = jest.fn();
    const { result } = await renderHook(() => ({
      dismiss: useSingleTap(dismiss),
      navigate: useSingleTap(navigate),
    }));
    freezeTimeAt(1_000);

    // When
    result.current.dismiss();
    result.current.navigate();

    // Then
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  describe('언마운트', () => {
    setupFakeTimersPerTest();

    it('화면이 내려가면 남은 가드 타이머를 지운다', async () => {
      // Given
      const { result, unmount } = await renderHook(() => useSingleTap(jest.fn()));
      // 마운트가 건 React 타이머를 먼저 흘려 가드 타이머만 남긴다
      await jest.advanceTimersByTimeAsync(RENDER_SETTLE_MS);
      result.current();
      const guardTimerCount = jest.getTimerCount();

      // When
      await unmount();
      await jest.advanceTimersByTimeAsync(RENDER_SETTLE_MS);

      // Then
      expect(guardTimerCount).toBe(1);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
