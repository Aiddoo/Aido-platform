import { createMockSyncStorage } from '@src/shared/__tests__';

import { buildWidgetSnapshot } from '../__tests__/widget-snapshot.factory';
import { WidgetSnapshotRepositoryImpl } from './widget-snapshot.repository';

describe('WidgetSnapshotRepositoryImpl', () => {
  it('스냅샷을 기록하고 그대로 읽는다 (라운드트립)', () => {
    // Given
    const storage = createMockSyncStorage();
    let saved: string | undefined;
    storage.set.mockImplementation((_key, value) => {
      saved = value;
    });
    storage.getString.mockImplementation(() => saved);
    const repository = new WidgetSnapshotRepositoryImpl(storage);
    const snapshot = buildWidgetSnapshot();

    // When
    repository.write(snapshot);
    const result = repository.read();

    // Then
    expect(result).toEqual(snapshot);
  });

  it('저장된 값이 없으면 null을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);
    const repository = new WidgetSnapshotRepositoryImpl(storage);

    // When / Then
    expect(repository.read()).toBeNull();
  });

  it('손상된 JSON은 null로 취급한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('{broken json');
    const repository = new WidgetSnapshotRepositoryImpl(storage);

    // When / Then
    expect(repository.read()).toBeNull();
  });

  it('스키마에 맞지 않는 데이터는 null로 취급한다 (버전 불일치 등)', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(JSON.stringify({ version: 999, foo: 'bar' }));
    const repository = new WidgetSnapshotRepositoryImpl(storage);

    // When / Then
    expect(repository.read()).toBeNull();
  });

  it('clear는 저장 키를 삭제한다', () => {
    // Given
    const storage = createMockSyncStorage();
    const repository = new WidgetSnapshotRepositoryImpl(storage);

    // When
    repository.clear();

    // Then
    expect(storage.delete).toHaveBeenCalledWith('aido_widget_snapshot_v1');
  });
});
