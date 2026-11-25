import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import type { TodoResourceLimit } from '@src/features/planning/todo/domains/todo-resource-limit.model';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import type { ImportCollection } from './todo-import-collection.model';
import {
  countNewCategories,
  findLimitCategoryIds,
  findTargetPlacement,
  getDefaultTarget,
  type ImportTarget,
  placeImportTargets,
  resolveImportTargets,
  summarizePlacements,
  TodoImportTargetPolicy,
} from './todo-import-target.model';

const WORK = createTodoCategoryWithCount({ id: 7, name: ' 업무 ', sortOrder: 1 });
const DEFAULT = createTodoCategoryWithCount({ id: 3, name: '기본', sortOrder: 0 });

const DEFAULT_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 3 } as const;
const WORK_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 7 } as const;
const SCHOOL_TARGET = { kind: 'NEW_CATEGORY', name: '학교', color: '#339AF0' } as const;
const MAX_PER_CATEGORY = 300;

function createLimits(entries: [number | null, number][]): Map<number | null, TodoResourceLimit> {
  return new Map(
    entries.map(([categoryId, activeCount]) => [
      categoryId,
      { maxPerCategory: MAX_PER_CATEGORY, activeCount },
    ]),
  );
}

describe('getDefaultTarget', () => {
  it.each([
    {
      scenario: '새 할 일처럼 목록 첫 카테고리에 넣고 새 카테고리는 만들지 않는다',
      categories: [DEFAULT, WORK],
      expected: DEFAULT_TARGET,
    },
    {
      scenario: '만드는 중인 카테고리는 건너뛴다',
      categories: [createTodoCategoryWithCount({ id: -1, name: '학교' }), WORK],
      expected: WORK_TARGET,
    },
    { scenario: '카테고리가 없으면 새 카테고리를 만든다', categories: [], expected: SCHOOL_TARGET },
  ])('$scenario', ({ categories, expected }) => {
    // When
    const target = getDefaultTarget(categories, SCHOOL_TARGET);

    // Then
    expect(target).toEqual(expected);
  });
});

describe('resolveImportTargets', () => {
  const school = createImportCollection({ collectionKey: 'school' });
  const work = createImportCollection({ collectionKey: 'work' });

  it.each<{
    scenario: string;
    collections: ImportCollection[];
    choice: Parameters<typeof resolveImportTargets>[1];
    expected: Record<string, ImportTarget>;
  }>([
    {
      scenario: '처음에는 모두 새 할 일의 기본 카테고리에 넣는다',
      collections: [school, work],
      choice: { categoryMode: 'single', singleTarget: null, targets: {} },
      expected: { school: DEFAULT_TARGET, work: DEFAULT_TARGET },
    },
    {
      scenario: '한 곳에 넣으면 캘린더마다 골라 둔 곳이 있어도 모두 그곳이다',
      collections: [school, work],
      choice: {
        categoryMode: 'single',
        singleTarget: WORK_TARGET,
        targets: { school: SCHOOL_TARGET },
      },
      expected: { school: WORK_TARGET, work: WORK_TARGET },
    },
    {
      scenario: '캘린더마다 넣어도 고르지 않은 캘린더는 모두 넣을 곳이다',
      collections: [school, work],
      choice: {
        categoryMode: 'separate',
        singleTarget: WORK_TARGET,
        targets: { school: SCHOOL_TARGET },
      },
      expected: { school: SCHOOL_TARGET, work: WORK_TARGET },
    },
    {
      scenario: '캘린더가 하나면 나눠 넣기를 골랐어도 모두 넣을 곳이다',
      collections: [school],
      choice: {
        categoryMode: 'separate',
        singleTarget: WORK_TARGET,
        targets: { school: SCHOOL_TARGET },
      },
      expected: { school: WORK_TARGET },
    },
  ])('$scenario', ({ collections, choice, expected }) => {
    // When
    const targets = resolveImportTargets(collections, choice, DEFAULT_TARGET);

    // Then
    expect(targets).toEqual(expected);
  });

  it('넣을 곳이 하나도 없으면 캘린더를 뺀다', () => {
    // When
    const targets = resolveImportTargets(
      [school],
      { categoryMode: 'single', singleTarget: null, targets: {} },
      null,
    );

    // Then
    expect(targets).toEqual({});
  });
});

describe('findLimitCategoryIds', () => {
  it('고른 곳마다 한 번만 묻고 새 카테고리는 몇 곳이어도 null 하나다', () => {
    // When
    const categoryIds = findLimitCategoryIds({
      a: WORK_TARGET,
      b: WORK_TARGET,
      c: SCHOOL_TARGET,
      d: { ...SCHOOL_TARGET, name: '알바' },
    });

    // Then
    expect(categoryIds).toEqual([7, null]);
  });
});

describe('placeImportTargets', () => {
  it.each([
    {
      scenario: '남은 자리보다 많으면 남은 자리만큼만 들어간다',
      activeCount: 248,
      itemCounts: [100, 80],
      expected: { importCount: 180, roomLeft: 52, placedCount: 52, skippedCount: 128 },
    },
    {
      scenario: '290개에 10개를 더하면 300개로 모두 들어가고 자리가 남지 않는다',
      activeCount: 290,
      itemCounts: [10],
      expected: { importCount: 10, roomLeft: 10, placedCount: 10, skippedCount: 0 },
    },
    {
      scenario: '다른 캘린더가 같은 곳에 넣는 일정도 함께 센다',
      activeCount: 290,
      itemCounts: [6, 5],
      expected: { importCount: 11, roomLeft: 10, placedCount: 10, skippedCount: 1 },
    },
    {
      scenario: '이미 300개면 가득 차 하나도 들어가지 않는다',
      activeCount: 300,
      itemCounts: [3],
      expected: { importCount: 3, roomLeft: 0, placedCount: 0, skippedCount: 3 },
    },
  ])('$scenario', ({ activeCount, itemCounts, expected }) => {
    // Given
    const collections = itemCounts.map((itemCount, index) =>
      createImportCollection({ collectionKey: `calendar-${index}`, itemCount }),
    );
    const targets = Object.fromEntries(
      collections.map((collection) => [collection.collectionKey, WORK_TARGET]),
    );

    // When
    const placements = placeImportTargets(collections, targets, createLimits([[7, activeCount]]));

    // Then
    expect(placements).toEqual([
      {
        target: WORK_TARGET,
        ...expected,
        remainingCount: expected.roomLeft - expected.placedCount,
      },
    ]);
  });

  it('290개 카테고리에 7개를 넣으면 넣은 뒤에도 3개 자리가 남는다', () => {
    // Given
    const collections = [createImportCollection({ collectionKey: 'a', itemCount: 7 })];

    // When
    const [placement] = placeImportTargets(
      collections,
      { a: WORK_TARGET },
      createLimits([[7, 290]]),
    );

    // Then
    expect(placement?.remainingCount).toBe(3);
  });

  it('이름이 같은 새 카테고리는 하나로 모아 빈 카테고리 한도까지 센다', () => {
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
      createLimits([[null, 0]]),
    );

    // Then
    expect(placements).toEqual([
      {
        target,
        importCount: 301,
        roomLeft: 300,
        placedCount: 300,
        skippedCount: 1,
        remainingCount: 0,
      },
    ]);
  });

  it.each<{
    scenario: string;
    targets: Record<string, ImportTarget>;
    limits: Map<number | null, TodoResourceLimit>;
  }>([
    {
      scenario: '넣을 곳이 없는 캘린더는 세지 않는다',
      targets: {},
      limits: createLimits([[3, 0]]),
    },
    {
      scenario: '한도를 아직 모르는 곳은 세지 않는다',
      targets: { a: WORK_TARGET },
      limits: createLimits([[3, 0]]),
    },
  ])('$scenario', ({ targets, limits }) => {
    // Given
    const collections = [createImportCollection({ collectionKey: 'a', itemCount: 4 })];

    // When
    const placements = placeImportTargets(collections, targets, limits);

    // Then
    expect(placements).toEqual([]);
  });
});

describe('summarizePlacements', () => {
  it('넣을 곳마다 실제로 들어가는 수를 더해 건너뛸 수를 알 수 있다', () => {
    // Given
    const collections = [
      createImportCollection({ collectionKey: 'work', itemCount: 180 }),
      createImportCollection({ collectionKey: 'family', itemCount: 4 }),
    ];
    const placements = placeImportTargets(
      collections,
      { work: WORK_TARGET, family: SCHOOL_TARGET },
      createLimits([
        [7, 248],
        [null, 0],
      ]),
    );

    // When
    const summary = summarizePlacements(placements);

    // Then
    expect(summary).toEqual({ totalCount: 184, placedCount: 56, destinationCount: 2 });
  });
});

describe('findTargetPlacement', () => {
  it('이름이 같은 새 카테고리는 같은 곳의 자리 계산이다', () => {
    // Given
    const collections = [createImportCollection({ collectionKey: 'a', itemCount: 4 })];
    const placements = placeImportTargets(
      collections,
      { a: SCHOOL_TARGET },
      createLimits([[null, 0]]),
    );

    // When
    const placement = findTargetPlacement(placements, { ...SCHOOL_TARGET, name: ' 학교 ' });

    // Then
    expect(placement?.placedCount).toBe(4);
  });
});

describe('countNewCategories', () => {
  it('이름이 같은 새 카테고리는 하나로 센다', () => {
    // When
    const count = countNewCategories([
      { kind: 'NEW_CATEGORY', name: '수업', color: '#FF6B43' },
      { kind: 'NEW_CATEGORY', name: ' 수업', color: '#339AF0' },
      { kind: 'NEW_CATEGORY', name: '알바', color: '#339AF0' },
      { kind: 'EXISTING_CATEGORY', categoryId: 3 },
    ]);

    // Then
    expect(count).toBe(2);
  });
});

describe('TodoImportTargetPolicy', () => {
  describe('isMissingCategory', () => {
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

  describe('findSameNameCategory', () => {
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
      const category = TodoImportTargetPolicy.findSameNameCategory(target, [
        DEFAULT,
        WORK,
        pending,
      ]);

      // Then
      expect(category?.id ?? null).toBe(expectedCategoryId);
    });
  });
});
