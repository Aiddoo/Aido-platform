import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import { dateKeySchema } from '@src/shared/date/date-key';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import type { TodoImportFormValues } from '../schemas/todo-import-form.schema';
import {
  findNearestPaletteColor,
  resolveImportTargets,
  toNewCategoryName,
} from './todo-import-target.mapper';
import { toTodoImportSelection } from './todo-import.mapper';

const NAMES = {
  fallbackName: '캘린더',
  accountNames: {
    icloud: 'iCloud 캘린더',
    google: 'Google 캘린더',
    outlook: 'Outlook 캘린더',
    device: null,
    subscribed: null,
    birthdays: null,
    other: null,
  },
} as const;

const CONTEXT = {
  categories: [createTodoCategoryWithCount({ id: 3, name: '기본' })],
  remainingCategorySlots: 2,
  palette: CATEGORY_COLORS,
  names: NAMES,
};

function createFormValues(overrides: Partial<TodoImportFormValues> = {}): TodoImportFormValues {
  return {
    startDate: dateKeySchema.parse('2026-11-24'),
    endDate: dateKeySchema.parse('2026-12-23'),
    collectionKeys: null,
    collections: [],
    targets: {},
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

describe('resolveImportTargets', () => {
  it('고른 연결이 먼저이고 고르지 않은 캘린더는 캘린더 이름(50자)과 가까운 색의 새 카테고리다', () => {
    // Given
    const school = createImportCollection({
      collectionKey: 'school',
      title: '가'.repeat(60),
      color: '#4285F4',
    });
    const work = createImportCollection({ collectionKey: 'work', title: '업무' });

    // When
    const targets = resolveImportTargets(
      [school, work],
      { work: { kind: 'EXISTING_CATEGORY', categoryId: 3 } },
      CONTEXT,
    );

    // Then
    expect(targets).toEqual({
      school: { kind: 'NEW_CATEGORY', name: '가'.repeat(50), color: '#339AF0' },
      work: { kind: 'EXISTING_CATEGORY', categoryId: 3 },
    });
  });

  it('이메일 모양 캘린더 이름은 새 카테고리 이름으로 보내지 않는다', () => {
    // Given
    const google = createImportCollection({
      collectionKey: 'google',
      title: 'someone@gmail.com',
      accountProvider: 'google',
    });
    const local = createImportCollection({
      collectionKey: 'local',
      title: 'me@example.com',
      accountProvider: 'device',
    });

    // When
    const targets = resolveImportTargets([google, local], {}, CONTEXT);

    // Then
    expect(targets).toMatchObject({
      google: { kind: 'NEW_CATEGORY', name: 'Google 캘린더' },
      local: { kind: 'NEW_CATEGORY', name: '캘린더' },
    });
    expect(JSON.stringify(targets)).not.toContain('@');
  });

  it('이메일 대신 쓴 이름과 같은 카테고리가 있으면 그 카테고리에 넣는다', () => {
    // Given
    const google = createImportCollection({
      collectionKey: 'google',
      title: 'someone@gmail.com',
      accountProvider: 'google',
    });
    const existing = createTodoCategoryWithCount({ id: 9, name: 'Google 캘린더' });

    // When
    const targets = resolveImportTargets([google], {}, { ...CONTEXT, categories: [existing] });

    // Then
    expect(targets).toEqual({ google: { kind: 'EXISTING_CATEGORY', categoryId: 9 } });
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

describe('toTodoImportSelection', () => {
  it('같은 곳을 고른 캘린더는 대상 하나를 함께 가리킨다("모두 한 카테고리에")', () => {
    // Given
    const school = createImportCollection({ collectionKey: 'a'.repeat(64), itemCount: 3 });
    const work = createImportCollection({ collectionKey: 'b'.repeat(64), itemCount: 5 });
    const shared = { kind: 'NEW_CATEGORY', name: '가져온 일정', color: '#339AF0' } as const;

    // When
    const selection = toTodoImportSelection(createFormValues({ collections: [school, work] }), {
      [school.collectionKey]: shared,
      [work.collectionKey]: { ...shared, name: ' 가져온 일정' },
    });

    // Then
    expect(selection.targets).toEqual([{ ...shared, targetKey: 'new-0' }]);
    expect(selection.collections).toEqual([
      { collectionKey: school.collectionKey, targetKey: 'new-0', expectedItemCount: 3 },
      { collectionKey: work.collectionKey, targetKey: 'new-0', expectedItemCount: 5 },
    ]);
  });
});
