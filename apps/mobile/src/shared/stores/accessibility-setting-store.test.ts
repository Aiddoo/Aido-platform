import { createAccessibilitySettingStore } from './accessibility-setting-store';

function createSource(readValue: Promise<boolean>) {
  let emit: (isEnabled: boolean) => void = () => undefined;
  const stop = jest.fn();
  const source = {
    read: jest.fn(() => readValue),
    listen: jest.fn((onChange: (isEnabled: boolean) => void) => {
      emit = onChange;
      return stop;
    }),
    onReadError: jest.fn(),
  };
  return { source, stop, emit: (isEnabled: boolean) => emit(isEnabled) };
}

describe('createAccessibilitySettingStore', () => {
  it('카드 여러 장이 구독해도 시스템 설정은 한 번만 읽고 한 번만 듣는다', async () => {
    // Given
    const { source } = createSource(Promise.resolve(true));
    const store = createAccessibilitySettingStore(source);

    // When
    store.subscribe(() => undefined);
    store.subscribe(() => undefined);
    await Promise.resolve();

    // Then
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(source.listen).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(true);
  });

  it('앱을 켠 채 설정을 바꾸면 구독한 화면에 알린다', () => {
    // Given
    const { source, emit } = createSource(new Promise(() => undefined));
    const store = createAccessibilitySettingStore(source);
    const onChange = jest.fn();
    store.subscribe(onChange);

    // When
    emit(true);

    // Then
    expect(store.getSnapshot()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('첫 읽기보다 바뀜 이벤트가 먼저 오면 늦게 온 읽기 값으로 되돌리지 않는다', async () => {
    // Given
    const read = Promise.withResolvers<boolean>();
    const { source, emit } = createSource(read.promise);
    const store = createAccessibilitySettingStore(source);
    store.subscribe(() => undefined);

    // When
    emit(true);
    read.resolve(false);
    await Promise.resolve();

    // Then
    expect(store.getSnapshot()).toBe(true);
  });

  it('마지막 화면이 구독을 끝내면 시스템 리스너를 푼다', () => {
    // Given
    const { source, stop } = createSource(Promise.resolve(false));
    const store = createAccessibilitySettingStore(source);
    const unsubscribeFirst = store.subscribe(() => undefined);
    const unsubscribeSecond = store.subscribe(() => undefined);

    // When
    unsubscribeFirst();
    const stoppedEarly = stop.mock.calls.length;
    unsubscribeSecond();

    // Then
    expect(stoppedEarly).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
