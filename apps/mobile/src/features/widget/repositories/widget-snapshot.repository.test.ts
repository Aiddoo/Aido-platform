import { createMockSyncStorage } from '@src/shared/__tests__';

import type { WidgetSnapshot } from '../models/widget-snapshot.model';
import { WidgetSnapshotRepositoryImpl } from './widget-snapshot.repository';

function buildSnapshot(): WidgetSnapshot {
  return {
    version: 1,
    state: 'data',
    date: '2026-07-12',
    updatedAtIso: '2026-07-12T09:00:00.000Z',
    totalTodos: 5,
    completedTodos: 3,
    completionRate: 60,
    isComplete: false,
    currentStreak: 12,
    topTodos: [{ id: 1, title: '운동하기', completed: true, categoryColor: '#B3E5C1' }],
    locale: 'ko',
    strings: {
      progressTitle: '오늘의 할 일',
      progressLabel: '3/5 완료',
      percentLabel: '60%',
      streakLabel: '12일 연속',
      allDoneLabel: '모두 완료!',
      moreLabel: '',
      emptyTitle: '오늘 할 일이 없어요',
      emptyCta: '탭해서 추가하기',
      loggedOutTitle: '로그인이 필요해요',
      loggedOutCta: '탭해서 시작하기',
      staleTitle: '새로운 하루가 시작됐어요',
      staleCta: '앱을 열어 확인하기',
    },
  };
}

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
    const snapshot = buildSnapshot();

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
