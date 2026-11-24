import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import {
  findDefaultTarget,
  placeImportTargets,
  summarizePlacements,
  TodoImportTargetPolicy,
} from './todo-import-target.model';

const WORK = createTodoCategoryWithCount({ id: 7, name: ' 업무 ', sortOrder: 1 });
const DEFAULT = createTodoCategoryWithCount({ id: 3, name: '기본', sortOrder: 0 });

describe('findDefaultTarget', () => {
  it.each([
    {
      scenario: '새 할 일처럼 목록 첫 카테고리에 넣고 새 카테고리는 만들지 않는다',
      categories: [DEFAULT, WORK],
      expected: { kind: 'EXISTING_CATEGORY', categoryId: DEFAULT.id },
    },
    {
      scenario: '만드는 중인 카테고리는 건너뛴다',
      categories: [createTodoCategoryWithCount({ id: -1, name: '학교' }), WORK],
      expected: { kind: 'EXISTING_CATEGORY', categoryId: WORK.id },
    },
    { scenario: '카테고리가 없으면 고를 곳이 없다', categories: [], expected: null },
  ])('$scenario', ({ categories, expected }) => {
    // When
    const target = findDefaultTarget(categories);

    // Then
    expect(target).toEqual(expected);
  });
});

describe('placeImportTargets', () => {
  it.each([
    {
      scenario: '기존 카테고리에 남은 자리보다 많으면 남은 자리만큼만 들어간다',
      todoCount: 248,
      itemCounts: [100, 80],
      expected: { importCount: 180, placedCount: 52, skippedCount: 128 },
    },
    {
      scenario: '합쳐 300개면 모두 들어간다',
      todoCount: 290,
      itemCounts: [6, 4],
      expected: { importCount: 10, placedCount: 10, skippedCount: 0 },
    },
    {
      scenario: '이미 300개를 넘었으면 하나도 들어가지 않는다',
      todoCount: 310,
      itemCounts: [3],
      expected: { importCount: 3, placedCount: 0, skippedCount: 3 },
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
    const placements = placeImportTargets(collections, targets, [category]);

    // Then
    expect(placements).toEqual([
      { target: { kind: 'EXISTING_CATEGORY', categoryId: 7 }, ...expected },
    ]);
  });

  it('이름이 같은 새 카테고리는 하나로 모아 300개까지 센다', () => {
    // Given
    const collections = [
      createImportCollection({ collectionKey: 'a', itemCount: 200 }),
      createImportCollection({ collectionKey: 'b', itemCount: 101 }),
    ];
    const target = { kind: 'NEW_CATEGORY', name: '가져온 일정', color: '#339AF0' } as const;

    // When
    const placements = placeImportTargets(
      collections,
      { a: target, b: { ...target, name: ' 가져온 일정' } },
      [],
    );

    // Then
    expect(placements).toEqual([{ target, importCount: 301, placedCount: 300, skippedCount: 1 }]);
  });

  it('넣을 곳이 없는 캘린더는 세지 않는다', () => {
    // Given
    const collections = [createImportCollection({ collectionKey: 'a', itemCount: 4 })];

    // When
    const placements = placeImportTargets(collections, {}, [DEFAULT]);

    // Then
    expect(placements).toEqual([]);
  });
});

describe('summarizePlacements', () => {
  it('넣을 곳마다 실제로 들어가는 수를 더해 건너뛸 수를 알 수 있다', () => {
    // When
    const summary = summarizePlacements([
      {
        target: { kind: 'EXISTING_CATEGORY', categoryId: 1 },
        importCount: 180,
        placedCount: 52,
        skippedCount: 128,
      },
      {
        target: { kind: 'NEW_CATEGORY', name: '가족', color: '#339AF0' },
        importCount: 4,
        placedCount: 4,
        skippedCount: 0,
      },
    ]);

    // Then
    expect(summary).toEqual({ totalCount: 184, placedCount: 56, destinationCount: 2 });
  });
});

describe('TodoImportTargetPolicy.isMissingCategory', () => {
  it.each([
    ['목록에 있는 카테고리는 그대로다', { kind: 'EXISTING_CATEGORY', categoryId: 7 }, false],
    ['가져오기 전에 삭제한 카테고리다', { kind: 'EXISTING_CATEGORY', categoryId: 99 }, true],
    [
      '새 카테고리는 사라질 수 없다',
      { kind: 'NEW_CATEGORY', name: '학교', color: '#339AF0' },
      false,
    ],
  ] as const)('%s', (_case, target, expected) => {
    // When
    const isMissing = TodoImportTargetPolicy.isMissingCategory(target, [DEFAULT, WORK]);

    // Then
    expect(isMissing).toBe(expected);
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

describe('TodoImportTargetPolicy.findSameNameCategory', () => {
  const pending = createTodoCategoryWithCount({ id: -1, name: '학교' });

  it.each([
    [
      '새 카테고리 이름이 같으면(공백·대소문자 무시) 그 카테고리다',
      { kind: 'NEW_CATEGORY', name: '업무', color: '#339AF0' },
      WORK.id,
    ],
    [
      '만드는 중인 카테고리는 견주지 않는다',
      { kind: 'NEW_CATEGORY', name: '학교', color: '#339AF0' },
      null,
    ],
    ['이미 있는 카테고리를 고른 대상은 없다', { kind: 'EXISTING_CATEGORY', categoryId: 7 }, null],
  ] as const)('%s', (_case, target, expectedCategoryId) => {
    // When
    const category = TodoImportTargetPolicy.findSameNameCategory(target, [DEFAULT, WORK, pending]);

    // Then
    expect(category?.id ?? null).toBe(expectedCategoryId);
  });
});
