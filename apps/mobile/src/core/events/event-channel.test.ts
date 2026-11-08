import { createEventChannel } from './event-channel';

describe('createEventChannel', () => {
  it('구독자에게 발행한 값을 전달한다', () => {
    // Given
    const channel = createEventChannel<{ value: number }>();
    const listener = jest.fn();
    channel.subscribe(listener);

    // When
    channel.emit({ value: 1 });

    // Then
    expect(listener).toHaveBeenCalledWith({ value: 1 });
  });

  it('구독을 해지하면 더 이상 전달하지 않는다', () => {
    // Given
    const channel = createEventChannel();
    const listener = jest.fn();
    const unsubscribe = channel.subscribe(listener);
    unsubscribe();

    // When
    channel.emit();

    // Then
    expect(listener).not.toHaveBeenCalled();
  });

  it('던지는 리스너가 있어도 다른 리스너에게 알린다', () => {
    // Given
    const channel = createEventChannel();
    const next = jest.fn();
    channel.subscribe(() => {
      throw new Error('listener failed');
    });
    channel.subscribe(next);

    // When
    channel.emit();

    // Then
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('발행 중 해지해도 그 발행의 대상은 바뀌지 않는다', () => {
    // Given
    const channel = createEventChannel();
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
