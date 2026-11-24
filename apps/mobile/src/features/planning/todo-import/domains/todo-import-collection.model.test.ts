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
