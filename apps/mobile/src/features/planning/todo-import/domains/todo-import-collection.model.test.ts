import { TODO_IMPORT_LIMITS } from '@aido/api/vocabulary';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import { TodoImportCollectionPolicy } from './todo-import-collection.model';

const PERSONAL = createImportCollection({ collectionKey: 'personal', accountKind: 'cloud' });
const HOLIDAYS = createImportCollection({ collectionKey: 'holidays', accountKind: 'holidays' });
const BIRTHDAYS = createImportCollection({ collectionKey: 'birthdays', accountKind: 'birthdays' });
const EMPTY = createImportCollection({ collectionKey: 'empty', itemCount: 0 });

describe('TodoImportCollectionPolicy', () => {
  describe('getSelectedCollections', () => {
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

    it('기본 선택은 20개를 넘지 않고 일정이 많은 캘린더부터 고른다', () => {
      // Given
      const limit = TODO_IMPORT_LIMITS.MAX_COLLECTIONS;
      const collections = Array.from({ length: limit + 2 }, (_, index) =>
        createImportCollection({ collectionKey: `calendar-${index}`, itemCount: index + 1 }),
      );

      // When
      const selected = TodoImportCollectionPolicy.getSelectedCollections(collections, null);

      // Then
      expect(selected).toHaveLength(limit);
      expect(selected.map((collection) => collection.collectionKey)).not.toContain('calendar-0');
      expect(selected.map((collection) => collection.collectionKey)).not.toContain('calendar-1');
      expect(TodoImportCollectionPolicy.isAtCollectionLimit(selected)).toBe(true);
    });

    it('고른 캘린더가 20개를 넘어도 요청에는 20개까지만 넣는다', () => {
      // Given
      const limit = TODO_IMPORT_LIMITS.MAX_COLLECTIONS;
      const collections = Array.from({ length: limit + 1 }, (_, index) =>
        createImportCollection({ collectionKey: `calendar-${index}` }),
      );

      // When
      const selected = TodoImportCollectionPolicy.getSelectedCollections(
        collections,
        collections.map((collection) => collection.collectionKey),
      );

      // Then
      expect(selected).toHaveLength(limit);
    });
  });

  describe('hasEmailTitle', () => {
    it.each([
      ['계정 이메일 그대로인 이름', 'someone@gmail.com', true],
      ['이메일이 들어간 이름', '업무 (me@company.co.kr)', true],
      ['보통 이름', '가족 일정', false],
      ['골뱅이만 있는 이름', '@회의실', false],
    ])('%s → %s', (_case, title, expected) => {
      // When
      const hasEmail = TodoImportCollectionPolicy.hasEmailTitle(createImportCollection({ title }));

      // Then
      expect(hasEmail).toBe(expected);
    });
  });

  describe('isOverImportLimit', () => {
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
});
