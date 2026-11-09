import { createEventChannel, setEventListenerErrorHandler } from './event-channel';

describe('createEventChannel', () => {
  it('구독자에게 발행한 값을 전달한다', () => {
    // Given
    const channel = createEventChannel<{ value: number }>('test');
    const listener = jest.fn();
    channel.subscribe(listener);

    // When
    channel.emit({ value: 1 });

    // Then
    expect(listener).toHaveBeenCalledWith({ value: 1 });
  });

  it('구독을 해지하면 더 이상 전달하지 않는다', () => {
    // Given
    const channel = createEventChannel('test');
    const listener = jest.fn();
    const unsubscribe = channel.subscribe(listener);
    unsubscribe();

    // When
    channel.emit();

    // Then
    expect(listener).not.toHaveBeenCalled();
  });

  it('던지는 리스너가 있어도 다른 리스너에게 알리고 오류를 채널 이름과 함께 보고한다', () => {
    // Given
    const channel = createEventChannel('test');
    const next = jest.fn();
    const handler = jest.fn();
    const restore = setEventListenerErrorHandler(handler);
    const failure = new Error('listener failed');
    channel.subscribe(() => {
      throw failure;
    });
    channel.subscribe(next);

    // When
    channel.emit();
    restore();

    // Then
    expect(next).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(failure, 'test');
  });

  it('핸들러를 풀면 오류를 보고하지 않고 삼킨다', () => {
    // Given
    const channel = createEventChannel('test');
    const handler = jest.fn();
    setEventListenerErrorHandler(handler)();
    channel.subscribe(() => {
      throw new Error('listener failed');
    });

    // When
    channel.emit();

    // Then
    expect(handler).not.toHaveBeenCalled();
  });

  it('발행 중 해지해도 그 발행의 대상은 바뀌지 않는다', () => {
    // Given
    const channel = createEventChannel('test');
    const second = jest.fn();
    let unsubscribeSecond = () => {};
    channel.subscribe(() => unsubscribeSecond());
    unsubscribeSecond = channel.subscribe(second);

    // When
    channel.emit();

    // Then
    expect(second).toHaveBeenCalledTimes(1);
  });
});
