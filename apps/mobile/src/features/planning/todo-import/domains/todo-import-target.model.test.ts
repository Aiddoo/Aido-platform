import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import { suggestTargets, TodoImportTargetPolicy } from './todo-import-target.model';

const WORK = createTodoCategoryWithCount({ id: 7, name: ' 업무 ', sortOrder: 1 });
const DEFAULT = createTodoCategoryWithCount({ id: 3, name: '기본', sortOrder: 0 });

describe('suggestTargets', () => {
  it('이름이 같은 카테고리(공백·대소문자 무시)가 있으면 그 카테고리에 넣는다', () => {
    // Given
    const collections = [createImportCollection({ collectionKey: 'work', title: '업무' })];

    // When
    const targets = suggestTargets(collections, {
      categories: [DEFAULT, WORK],
      remainingCategorySlots: 0,
    });

    // Then
    expect(targets).toEqual({ work: { kind: 'EXISTING_CATEGORY', categoryId: WORK.id } });
  });

  it('남은 자리만큼 앞에서부터 새 카테고리를 만들고 나머지는 첫 카테고리에 넣는다', () => {
    // Given
    const collections = [
      createImportCollection({ collectionKey: 'a', title: '수업' }),
      createImportCollection({ collectionKey: 'b', title: '알바' }),
      createImportCollection({ collectionKey: 'c', title: '동아리' }),
    ];

    // When
    const targets = suggestTargets(collections, {
      categories: [DEFAULT, WORK],
      remainingCategorySlots: 1,
    });

    // Then
    expect(targets).toEqual({
      a: { kind: 'NEW_CATEGORY' },
      b: { kind: 'EXISTING_CATEGORY', categoryId: DEFAULT.id },
      c: { kind: 'EXISTING_CATEGORY', categoryId: DEFAULT.id },
    });
  });

  it('자리 제한이 없으면 모두 새 카테고리다', () => {
    // Given
    const collections = [
      createImportCollection({ collectionKey: 'a', title: '수업' }),
      createImportCollection({ collectionKey: 'b', title: '알바' }),
    ];

    // When
    const targets = suggestTargets(collections, {
      categories: [DEFAULT],
      remainingCategorySlots: null,
    });

    // Then
    expect(targets).toEqual({ a: { kind: 'NEW_CATEGORY' }, b: { kind: 'NEW_CATEGORY' } });
  });
});

describe('TodoImportTargetPolicy.countNewCategories', () => {
  it('이름이 같은 새 카테고리는 하나로 센다', () => {
    // When
    const count = TodoImportTargetPolicy.countNewCategories([
      { kind: 'NEW_CATEGORY', name: '수업', color: '#FF6B43' },
      { kind: 'NEW_CATEGORY', name: ' 수업', color: '#339AF0' },
      { kind: 'NEW_CATEGORY', name: '알바', color: '#339AF0' },
      { kind: 'EXISTING_CATEGORY', categoryId: 3 },
    ]);

    // Then
    expect(count).toBe(2);
  });
});
