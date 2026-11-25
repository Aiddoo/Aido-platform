import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';

import { createTodoImportCollection } from '../__tests__/todo-import.fixtures';
import {
  createDefaultTarget,
  createNewCategoryTarget,
  getNearestPaletteColor,
  type NewCategoryDefaults,
  TodoImportTargetPolicy,
} from './todo-import-target.model';

const WORK = createTodoCategoryWithCount({ id: 7, name: ' 업무 ', sortOrder: 1 });
const DEFAULT = createTodoCategoryWithCount({ id: 3, name: '기본', sortOrder: 0 });

const DEFAULT_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 3 } as const;
const WORK_TARGET = { kind: 'EXISTING_CATEGORY', categoryId: 7 } as const;

const NEW_CATEGORY_DEFAULTS: NewCategoryDefaults = {
  naming: {
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
  },
  palette: CATEGORY_COLORS,
};
const FALLBACK_TARGET = {
  kind: 'NEW_CATEGORY',
  name: '캘린더 일정',
  color: CATEGORY_COLORS[0],
} as const;

describe('getNearestPaletteColor', () => {
  it.each([
    ['Google 파랑은 팔레트의 파랑', '#4285F4', '#339AF0'],
    ['읽을 수 없는 색은 팔레트 첫 색', 'blue', CATEGORY_COLORS[0]],
    ['색이 없으면 팔레트 첫 색', null, CATEGORY_COLORS[0]],
  ])('%s', (_case, color, expected) => {
    // When
    const nearest = getNearestPaletteColor(color, CATEGORY_COLORS);

    // Then
    expect(nearest).toBe(expected);
  });
});

describe('createNewCategoryTarget', () => {
  it.each([
    {
      scenario: '캘린더 하나면 캘린더 이름과 가까운 색이다',
      collection: createTodoImportCollection({ title: 'Personal', color: '#4285F4' }),
      expected: { kind: 'NEW_CATEGORY', name: 'Personal', color: '#339AF0' },
    },
    {
      scenario: '이메일 모양 캘린더 이름은 보내지 않고 서비스 이름으로 시작한다',
      collection: createTodoImportCollection({
        title: 'someone@gmail.com',
        accountProvider: 'google',
        color: null,
      }),
      expected: { kind: 'NEW_CATEGORY', name: 'Google', color: CATEGORY_COLORS[0] },
    },
    {
      scenario: '서비스를 모르는 이메일 이름은 기본 이름이다',
      collection: createTodoImportCollection({
        title: 'me@example.com',
        accountProvider: 'device',
        color: null,
      }),
      expected: FALLBACK_TARGET,
    },
    {
      scenario: '여러 캘린더를 모아 넣으면 기본 이름과 팔레트 첫 색이다',
      collection: null,
      expected: FALLBACK_TARGET,
    },
  ])('$scenario', ({ collection, expected }) => {
    // When
    const target = createNewCategoryTarget(collection, NEW_CATEGORY_DEFAULTS);

    // Then
    expect(target).toEqual(expected);
  });

  it('50자를 넘는 이름은 이모지를 반으로 자르지 않고 UTF-16 50자 안까지만 남긴다', () => {
    // Given
    const collection = createTodoImportCollection({ title: `${'가'.repeat(49)}👩‍👩‍👧끝` });

    // When
    const target = createNewCategoryTarget(collection, NEW_CATEGORY_DEFAULTS);

    // Then
    expect(target.name).toBe('가'.repeat(49));
  });
});

describe('createDefaultTarget', () => {
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
    {
      scenario: '카테고리가 없으면 새 카테고리를 만든다',
      categories: [],
      expected: FALLBACK_TARGET,
    },
  ])('$scenario', ({ categories, expected }) => {
    // When
    const target = createDefaultTarget(categories, NEW_CATEGORY_DEFAULTS);

    // Then
    expect(target).toEqual(expected);
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

  describe('calculateNewCategoryCount', () => {
    it('이름이 같은 새 카테고리는 하나로 센다', () => {
      // When
      const count = TodoImportTargetPolicy.calculateNewCategoryCount([
        { kind: 'NEW_CATEGORY', name: '수업', color: '#FF6B43' },
        { kind: 'NEW_CATEGORY', name: ' 수업', color: '#339AF0' },
        { kind: 'NEW_CATEGORY', name: '알바', color: '#339AF0' },
        { kind: 'EXISTING_CATEGORY', categoryId: 3 },
      ]);

      // Then
      expect(count).toBe(2);
    });
  });
});
