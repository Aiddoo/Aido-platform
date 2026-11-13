import { getNowInstant } from '@src/shared/date/clock';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { createMinuteClockStore, toMinuteStart } from './minute-clock-store';

function createSource() {
  let emit: (isForeground: boolean) => void = () => undefined;
  const stop = jest.fn();
  return {
    stop,
    setForeground: (isForeground: boolean) => emit(isForeground),
    source: {
      now: getNowInstant,
      listenForeground: (onChange: (isForeground: boolean) => void) => {
        emit = onChange;
        return stop;
      },
    },
  };
}

describe('createMinuteClockStore', () => {
  setupFakeTimersPerTest({ now: new Date('2026-11-03T09:00:30.000Z') });

  it('같은 분 안에서는 같은 시각을 돌려준다', () => {
    // Given
    const { source } = createSource();
    const store = createMinuteClockStore(source);
    const first = store.getSnapshot();

    // When
    jest.setSystemTime(new Date('2026-11-03T09:00:59.000Z'));

    // Then
    expect(store.getSnapshot()).toBe(first);
    expect(first).toBe(toMinuteStart(Date.parse('2026-11-03T09:00:00.000Z')));
  });

  it('다음 분 경계에 한 번 알리고 다시 예약한다', () => {
    // Given
    const { source } = createSource();
    const store = createMinuteClockStore(source);
    const onChange = jest.fn();
    store.subscribe(onChange);

    // When
    jest.advanceTimersByTime(29_999);
    const beforeBoundary = onChange.mock.calls.length;
    jest.advanceTimersByTime(1 + 60_000);

    // Then
    expect(beforeBoundary).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toBe(Date.parse('2026-11-03T09:02:00.000Z'));
  });

  it('앱이 뒤에 있으면 타이머를 멈추고 돌아오면 바로 실제 지금으로 알린다', () => {
    // Given
    const { source, setForeground } = createSource();
    const store = createMinuteClockStore(source);
    const onChange = jest.fn();
    store.subscribe(onChange);

    // When
    // 하루 뒤 오프라인 상태로 다시 연다
    setForeground(false);
    jest.advanceTimersByTime(60_000 * 5);
    jest.setSystemTime(new Date('2026-11-04T10:15:10.000Z'));
    const whileBackground = onChange.mock.calls.length;
    setForeground(true);

    // Then
    expect(whileBackground).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(Date.parse('2026-11-04T10:15:00.000Z'));
  });

  it('마지막 구독이 끝나면 타이머와 앱 상태 구독을 푼다', () => {
    // Given
    const { source, stop } = createSource();
    const store = createMinuteClockStore(source);
    const onChange = jest.fn();
    const unsubscribe = store.subscribe(onChange);

    // When
    unsubscribe();
    jest.advanceTimersByTime(120_000);

    // Then
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
