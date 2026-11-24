import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import { dateKeySchema } from '@src/shared/date/date-key';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import type { ImportCollection } from '../domains/todo-import-collection.model';
import type { ImportTarget } from '../domains/todo-import-target.model';
import type { TodoImportFormValues } from '../schemas/todo-import-form.schema';
import {
  findNearestPaletteColor,
  resolveImportTargets,
  toNewCategoryName,
  toNewCategoryTarget,
} from './todo-import-target.mapper';
import { toTodoImportSelection } from './todo-import.mapper';

const NAMES = {
  fallbackName: '캘린더 일정',
  accountNames: {
    icloud: 'iCloud',
    google: 'Google',
    outlook: 'Outlook',
    device: null,
    subscribed: null,
    birthdays: null,
    other: null,
  },
} as const;

const DEFAULT_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 3 } as const;
const WORK_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 7 } as const;
const SCHOOL_TARGET = { kind: 'NEW_CATEGORY', name: '학교', color: '#339AF0' } as const;

function createFormValues(overrides: Partial<TodoImportFormValues> = {}): TodoImportFormValues {
  return {
    startDate: dateKeySchema.parse('2026-11-24'),
    endDate: dateKeySchema.parse('2026-12-23'),
    collectionKeys: null,
    collections: [],
    targets: {},
    categoryMode: 'single',
    singleTarget: null,
    timeMode: 'TIME',
    visibility: 'PRIVATE',
    ...overrides,
  };
}

describe('findNearestPaletteColor', () => {
  it.each([
    ['Google 파랑은 팔레트의 파랑', '#4285F4', '#339AF0'],
    ['읽을 수 없는 색은 팔레트 첫 색', 'blue', CATEGORY_COLORS[0]],
    ['색이 없으면 팔레트 첫 색', null, CATEGORY_COLORS[0]],
  ])('%s', (_case, color, expected) => {
    // When
    const nearest = findNearestPaletteColor(color, CATEGORY_COLORS);

    // Then
    expect(nearest).toBe(expected);
  });
});

describe('toNewCategoryTarget', () => {
  it.each([
    {
      scenario: '캘린더 하나면 캘린더 이름과 가까운 색이다',
      collection: createImportCollection({ title: 'Personal', color: '#4285F4' }),
      expected: { kind: 'NEW_CATEGORY', name: 'Personal', color: '#339AF0' },
    },
    {
      scenario: '이메일 모양 캘린더 이름은 보내지 않고 서비스 이름으로 시작한다',
      collection: createImportCollection({
        title: 'someone@gmail.com',
        accountProvider: 'google',
        color: null,
      }),
      expected: { kind: 'NEW_CATEGORY', name: 'Google', color: CATEGORY_COLORS[0] },
    },
    {
      scenario: '서비스를 모르는 이메일 이름은 기본 이름이다',
      collection: createImportCollection({
        title: 'me@example.com',
        accountProvider: 'device',
        color: null,
      }),
      expected: { kind: 'NEW_CATEGORY', name: '캘린더 일정', color: CATEGORY_COLORS[0] },
    },
    {
      scenario: '여러 캘린더를 모아 넣으면 기본 이름과 팔레트 첫 색이다',
      collection: null,
      expected: { kind: 'NEW_CATEGORY', name: '캘린더 일정', color: CATEGORY_COLORS[0] },
    },
  ])('$scenario', ({ collection, expected }) => {
    // When
    const target = toNewCategoryTarget(collection, { palette: CATEGORY_COLORS, names: NAMES });

    // Then
    expect(target).toEqual(expected);
  });

  it('50자를 넘는 이름은 이모지를 반으로 자르지 않고 UTF-16 50자 안까지만 남긴다', () => {
    // Given
    const collection = createImportCollection({ title: `${'가'.repeat(49)}👩‍👩‍👧끝` });

    // When
    const name = toNewCategoryName(collection, NAMES);

    // Then
    expect(name).toBe('가'.repeat(49));
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

describe('toTodoImportSelection', () => {
  it('같은 곳을 고른 캘린더는 대상 하나를 함께 가리킨다', () => {
    // Given
    const school = createImportCollection({ collectionKey: 'a'.repeat(64), itemCount: 3 });
    const work = createImportCollection({ collectionKey: 'b'.repeat(64), itemCount: 5 });
    const shared = { kind: 'NEW_CATEGORY', name: '가져온 일정', color: '#339AF0' } as const;

    // When
    const selection = toTodoImportSelection(
      createFormValues({
        collections: [school, work],
        categoryMode: 'separate',
        targets: {
          [school.collectionKey]: shared,
          [work.collectionKey]: { ...shared, name: ' 가져온 일정' },
        },
      }),
    );

    // Then
    expect(selection.targets).toEqual([{ ...shared, targetKey: 'new-0' }]);
    expect(selection.collections).toEqual([
      { collectionKey: school.collectionKey, targetKey: 'new-0', expectedItemCount: 3 },
      { collectionKey: work.collectionKey, targetKey: 'new-0', expectedItemCount: 5 },
    ]);
  });

  it('한 곳에 넣으면 모든 캘린더가 고정한 넣을 곳 하나를 가리킨다', () => {
    // Given
    const school = createImportCollection({ collectionKey: 'a'.repeat(64), itemCount: 3 });
    const work = createImportCollection({ collectionKey: 'b'.repeat(64), itemCount: 5 });

    // When
    const selection = toTodoImportSelection(
      createFormValues({
        collections: [school, work],
        targets: { [school.collectionKey]: SCHOOL_TARGET },
        categoryMode: 'single',
        singleTarget: DEFAULT_TARGET,
      }),
    );

    // Then
    expect(selection.targets).toEqual([{ ...DEFAULT_TARGET, targetKey: 'category-3' }]);
    expect(selection.collections).toEqual([
      { collectionKey: school.collectionKey, targetKey: 'category-3', expectedItemCount: 3 },
      { collectionKey: work.collectionKey, targetKey: 'category-3', expectedItemCount: 5 },
    ]);
  });
});
