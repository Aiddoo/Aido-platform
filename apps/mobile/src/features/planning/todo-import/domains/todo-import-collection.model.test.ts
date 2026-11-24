import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import { TodoImportCollectionPolicy } from './todo-import-collection.model';

const PERSONAL = createImportCollection({ collectionKey: 'personal', accountKind: 'cloud' });
const HOLIDAYS = createImportCollection({ collectionKey: 'holidays', accountKind: 'holidays' });
const BIRTHDAYS = createImportCollection({ collectionKey: 'birthdays', accountKind: 'birthdays' });
const EMPTY = createImportCollection({ collectionKey: 'empty', itemCount: 0 });

describe('TodoImportCollectionPolicy.getSelectedCollections', () => {
  it('아직 고르지 않았으면 공휴일·생일·구독과 일정 없는 캘린더를 빼고 고른다', () => {
    // When
    const selected = TodoImportCollectionPolicy.getSelectedCollections(
      [PERSONAL, HOLIDAYS, BIRTHDAYS, EMPTY],
      null,
    );

    // Then
    expect(selected.map((collection) => collection.collectionKey)).toEqual(['personal']);
  });

  it('고른 캘린더는 기본 해제여도 넣고, 기간을 줄여 일정이 사라진 캘린더는 뺀다', () => {
    // When
    const selected = TodoImportCollectionPolicy.getSelectedCollections(
      [PERSONAL, HOLIDAYS, EMPTY],
      ['holidays', 'empty'],
    );

    // Then
    expect(selected.map((collection) => collection.collectionKey)).toEqual(['holidays']);
  });
});

describe('TodoImportCollectionPolicy.isOverImportLimit', () => {
  it('고른 일정 수가 한 번에 가져올 수 있는 수와 같으면 시작할 수 있다', () => {
    // Given
    const collections = [
      createImportCollection({
        collectionKey: 'a',
        itemCount: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT - 1,
      }),
      createImportCollection({ collectionKey: 'b', itemCount: 1 }),
    ];

    // When
    const isOver = TodoImportCollectionPolicy.isOverImportLimit(collections);

    // Then
    expect(isOver).toBe(false);
  });

  it('한 개라도 넘으면 시작하지 못한다', () => {
    // Given
    const collections = [
      createImportCollection({
        collectionKey: 'a',
        itemCount: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT,
      }),
      createImportCollection({ collectionKey: 'b', itemCount: 1 }),
    ];

    // When
    const isOver = TodoImportCollectionPolicy.isOverImportLimit(collections);

    // Then
    expect(isOver).toBe(true);
  });
});
