import { renderHook } from '@testing-library/react-native';

import { useSingleTap } from './useSingleTap';

/** 가드 간격(600ms)보다 확실히 긴 시간 */
const AFTER_GUARD_MS = 700;

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

    // When - 같은 프레임에 세 번 들어온 탭
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

  it('탭에 넘긴 인자를 그대로 전달한다', async () => {
    // Given
    const onTap = jest.fn<void, [string, number]>();
    const { result } = await renderHook(() => useSingleTap(onTap));

    // When
    result.current('/settings/profile', 1);

    // Then
    expect(onTap).toHaveBeenCalledWith('/settings/profile', 1);
  });

  it('다시 렌더되어도 함수 정체성이 유지된다 (memo된 자식이 다시 그려지지 않도록)', async () => {
    // Given
    const { result, rerender } = await renderHook(
      (props: { onTap: () => void }) => useSingleTap(props.onTap),
      { initialProps: { onTap: jest.fn() } },
    );
    const firstTap = result.current;

    // When - 부모가 매 렌더 새 핸들러를 넘기는 흔한 상황
    await rerender({ onTap: jest.fn() });

    // Then
    expect(result.current).toBe(firstTap);
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
    // Given - 예: 모달을 닫고 곧바로 다른 화면으로 이동하는 흐름
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
});
