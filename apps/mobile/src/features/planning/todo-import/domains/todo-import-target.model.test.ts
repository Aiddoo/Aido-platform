import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import {
  hasTargetOverCapacity,
  suggestTargets,
  TodoImportTargetPolicy,
} from './todo-import-target.model';

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
      newCategoryNames: { work: '업무' },
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
      newCategoryNames: { a: '수업', b: '알바', c: '동아리' },
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
      newCategoryNames: { a: '수업', b: '알바' },
    });

    // Then
    expect(targets).toEqual({ a: { kind: 'NEW_CATEGORY' }, b: { kind: 'NEW_CATEGORY' } });
  });
});

describe('hasTargetOverCapacity', () => {
  it.each([
    {
      scenario: '기존 카테고리의 할 일과 가져올 일정을 합쳐 300개를 넘으면 모자랄 수 있다',
      todoCount: 290,
      itemCounts: [6, 5],
      expected: true,
    },
    {
      scenario: '합쳐 300개면 모두 들어간다',
      todoCount: 290,
      itemCounts: [6, 4],
      expected: false,
    },
  ])('$scenario', ({ todoCount, itemCounts, expected }) => {
    // Given
    const category = createTodoCategoryWithCount({ id: 7, todoCount });
    const collections = itemCounts.map((itemCount, index) =>
      createImportCollection({ collectionKey: `calendar-${index}`, itemCount }),
    );
    const targets = Object.fromEntries(
      collections.map((collection) => [
        collection.collectionKey,
        { kind: 'EXISTING_CATEGORY', categoryId: category.id } as const,
      ]),
    );

    // When
    const isOver = hasTargetOverCapacity(collections, targets, [category]);

    // Then
    expect(isOver).toBe(expected);
  });

  it('이름이 같은 새 카테고리는 하나로 모아 센다', () => {
    // Given
    const collections = [
      createImportCollection({ collectionKey: 'a', itemCount: 200 }),
      createImportCollection({ collectionKey: 'b', itemCount: 101 }),
    ];
    const target = { kind: 'NEW_CATEGORY', name: '가져온 일정', color: '#339AF0' } as const;

    // When
    const isOver = hasTargetOverCapacity(
      collections,
      { a: target, b: { ...target, name: ' 가져온 일정' } },
      [],
    );

    // Then
    expect(isOver).toBe(true);
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
