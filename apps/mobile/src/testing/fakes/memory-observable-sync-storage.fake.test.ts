import { createMemoryObservableSyncStorage } from './memory-observable-sync-storage.fake';

describe('createMemoryObservableSyncStorage', () => {
  it('구독한 키가 바뀔 때만 그 구독자에게 알린다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const onTargetChanged = jest.fn();
    const onOtherChanged = jest.fn();
    storage.subscribe('target', onTargetChanged);
    storage.subscribe('other', onOtherChanged);

    // When
    storage.set('target', 'value');

    // Then
    expect(onTargetChanged).toHaveBeenCalledTimes(1);
    expect(onOtherChanged).not.toHaveBeenCalled();
  });

  it('값을 지울 때도 그 키의 구독자에게 알린다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const onChanged = jest.fn();
    storage.set('target', 'value');
    storage.subscribe('target', onChanged);

    // When
    storage.remove('target');

    // Then
    expect(storage.get('target')).toBeUndefined();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('구독을 끝내면 더는 알리지 않는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const onChanged = jest.fn();
    const unsubscribe = storage.subscribe('target', onChanged);
    unsubscribe();

    // When
    storage.set('target', 'value');

    // Then
    expect(onChanged).not.toHaveBeenCalled();
  });
});
