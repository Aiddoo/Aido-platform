import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';

import { createTodoImportCollection } from '../__tests__/todo-import.fixtures';
import {
  type TodoImportCategoryLimit,
  type TodoImportPlan,
  TodoImportPlanPolicy,
} from './todo-import-plan.model';
import type { TodoImportTarget } from './todo-import-target.model';

const WORK = createTodoCategoryWithCount({ id: 7, name: ' 업무 ', sortOrder: 1 });
const DEFAULT = createTodoCategoryWithCount({ id: 3, name: '기본', sortOrder: 0 });

const DEFAULT_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 3 } as const;
const WORK_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 7 } as const;
const SCHOOL_TARGET = { kind: 'NEW_CATEGORY', name: '학교', color: '#339AF0' } as const;
const MAX_PER_CATEGORY = 300;

const SCHOOL = createTodoImportCollection({ collectionKey: 'school' });
const OFFICE = createTodoImportCollection({ collectionKey: 'work' });

function createPlan(overrides: Partial<TodoImportPlan> = {}): TodoImportPlan {
  return {
    collections: [SCHOOL, OFFICE],
    categoryMode: 'single',
    singleTarget: null,
    targets: {},
    ...overrides,
  };
}

function createLimits(entries: [number | null, number][]): TodoImportCategoryLimit[] {
  return entries.map(([categoryId, activeCount]) => ({
    categoryId,
    limit: { maxPerCategory: MAX_PER_CATEGORY, activeCount },
  }));
}

describe('TodoImportPlanPolicy', () => {
  describe('canSplit', () => {
    it.each([
      ['캘린더가 둘이면 나눠 넣을 수 있다', [SCHOOL, OFFICE], true],
      ['캘린더가 하나뿐이면 나눌 것이 없다', [SCHOOL], false],
    ])('%s', (_case, collections, expected) => {
      // When
      const canSplit = TodoImportPlanPolicy.canSplit(createPlan({ collections }));

      // Then
      expect(canSplit).toBe(expected);
    });
  });

  describe('getDestination', () => {
    it.each<[string, TodoImportTarget | null, TodoImportTarget]>([
      ['아직 고르지 않았으면 기본 넣을 곳이다', null, DEFAULT_TARGET],
      ['고른 곳이 있으면 그곳이다', WORK_TARGET, WORK_TARGET],
    ])('%s', (_case, singleTarget, expected) => {
      // When
      const destination = TodoImportPlanPolicy.getDestination(
        createPlan({ singleTarget }),
        DEFAULT_TARGET,
      );

      // Then
      expect(destination).toEqual(expected);
    });
  });

  describe('getAssignedTargets', () => {
    it.each<{
      scenario: string;
      plan: TodoImportPlan;
      expected: Record<string, TodoImportTarget>;
    }>([
      {
        scenario: '처음에는 모두 새 할 일의 기본 카테고리에 넣는다',
        plan: createPlan(),
        expected: { school: DEFAULT_TARGET, work: DEFAULT_TARGET },
      },
      {
        scenario: '한 곳에 넣으면 캘린더마다 골라 둔 곳이 있어도 모두 그곳이다',
        plan: createPlan({ singleTarget: WORK_TARGET, targets: { school: SCHOOL_TARGET } }),
        expected: { school: WORK_TARGET, work: WORK_TARGET },
      },
      {
        scenario: '캘린더마다 넣어도 고르지 않은 캘린더는 모두 넣을 곳이다',
        plan: createPlan({
          categoryMode: 'separate',
          singleTarget: WORK_TARGET,
          targets: { school: SCHOOL_TARGET },
        }),
        expected: { school: SCHOOL_TARGET, work: WORK_TARGET },
      },
      {
        scenario: '캘린더가 하나면 나눠 넣기를 골랐어도 모두 넣을 곳이다',
        plan: createPlan({
          collections: [SCHOOL],
          categoryMode: 'separate',
          singleTarget: WORK_TARGET,
          targets: { school: SCHOOL_TARGET },
        }),
        expected: { school: WORK_TARGET },
      },
    ])('$scenario', ({ plan, expected }) => {
      // When
      const targets = TodoImportPlanPolicy.getAssignedTargets(plan, DEFAULT_TARGET);

      // Then
      expect(targets).toEqual(expected);
    });

    it('넣을 곳이 하나도 없으면 캘린더를 뺀다', () => {
      // When
      const targets = TodoImportPlanPolicy.getAssignedTargets(
        createPlan({ collections: [SCHOOL] }),
        null,
      );

      // Then
      expect(targets).toEqual({});
    });
  });

  describe('findOtherTargets', () => {
    it('그 캘린더를 뺀 나머지 캘린더가 가리키는 곳이다', () => {
      // Given
      const plan = createPlan({
        categoryMode: 'separate',
        targets: { school: SCHOOL_TARGET, work: WORK_TARGET },
      });

      // When
      const otherTargets = TodoImportPlanPolicy.findOtherTargets(plan, DEFAULT_TARGET, 'school');

      // Then
      expect(otherTargets).toEqual([WORK_TARGET]);
    });
  });

  describe('hasMissingCategory', () => {
    it.each<[string, TodoImportTarget, boolean]>([
      ['고른 카테고리가 목록에 있으면 넘길 수 있다', WORK_TARGET, false],
      [
        '가져오기 전에 삭제한 카테고리를 가리키면 다시 골라야 한다',
        { kind: 'EXISTING_CATEGORY', categoryId: 99 },
        true,
      ],
      ['새 카테고리는 사라질 수 없다', SCHOOL_TARGET, false],
    ])('%s', (_case, singleTarget, expected) => {
      // When
      const hasMissingCategory = TodoImportPlanPolicy.hasMissingCategory(
        createPlan({ singleTarget }),
        DEFAULT_TARGET,
        [DEFAULT, WORK],
      );

      // Then
      expect(hasMissingCategory).toBe(expected);
    });
  });

  describe('findLimitCategoryIds', () => {
    it('고른 곳마다 한 번만 묻고 새 카테고리는 몇 곳이어도 null 하나다', () => {
      // Given
      const collections = ['a', 'b', 'c', 'd'].map((collectionKey) =>
        createTodoImportCollection({ collectionKey }),
      );
      const plan = createPlan({
        collections,
        categoryMode: 'separate',
        targets: {
          a: WORK_TARGET,
          b: WORK_TARGET,
          c: SCHOOL_TARGET,
          d: { ...SCHOOL_TARGET, name: '알바' },
        },
      });

      // When
      const categoryIds = TodoImportPlanPolicy.findLimitCategoryIds(plan, DEFAULT_TARGET);

      // Then
      expect(categoryIds).toEqual([7, null]);
    });
  });

  describe('calculatePlacements', () => {
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
        createTodoImportCollection({ collectionKey: `calendar-${index}`, itemCount }),
      );
      const plan = createPlan({ collections, singleTarget: WORK_TARGET });

      // When
      const placements = TodoImportPlanPolicy.calculatePlacements(
        plan,
        DEFAULT_TARGET,
        createLimits([[7, activeCount]]),
      );

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
      const plan = createPlan({
        collections: [createTodoImportCollection({ collectionKey: 'a', itemCount: 7 })],
        singleTarget: WORK_TARGET,
      });

      // When
      const [placement] = TodoImportPlanPolicy.calculatePlacements(
        plan,
        DEFAULT_TARGET,
        createLimits([[7, 290]]),
      );

      // Then
      expect(placement?.remainingCount).toBe(3);
    });

    it('이름이 같은 새 카테고리는 하나로 모아 빈 카테고리 한도까지 센다', () => {
      // Given
      const target = { kind: 'NEW_CATEGORY', name: '가져온 일정', color: '#339AF0' } as const;
      const plan = createPlan({
        collections: [
          createTodoImportCollection({ collectionKey: 'a', itemCount: 200 }),
          createTodoImportCollection({ collectionKey: 'b', itemCount: 101 }),
        ],
        categoryMode: 'separate',
        targets: { a: target, b: { ...target, name: ' 가져온 일정' } },
      });

      // When
      const placements = TodoImportPlanPolicy.calculatePlacements(
        plan,
        DEFAULT_TARGET,
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

    it('한도를 아직 모르는 곳은 세지 않는다', () => {
      // Given
      const plan = createPlan({
        collections: [createTodoImportCollection({ collectionKey: 'a', itemCount: 4 })],
        singleTarget: WORK_TARGET,
      });

      // When
      const placements = TodoImportPlanPolicy.calculatePlacements(
        plan,
        DEFAULT_TARGET,
        createLimits([[3, 0]]),
      );

      // Then
      expect(placements).toEqual([]);
    });
  });
});
