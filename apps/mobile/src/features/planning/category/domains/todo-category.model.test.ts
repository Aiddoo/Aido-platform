import {
  createTodoCategoryDeletionPreview,
  createTodoCategoryWithCount,
} from '../__tests__/todo-category.fixtures';
import { TodoCategoryPolicy } from './todo-category.model';

const CATEGORIES = [{ id: 3 }, { id: 7 }];

describe('getInitialCategoryId', () => {
  it('요청한 카테고리가 남아 있으면 그것을 고른다', () => {
    // Given
    const requestedCategoryId = 7;

    // When
    const categoryId = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, requestedCategoryId);

    // Then
    expect(categoryId).toBe(7);
  });

  it('요청한 카테고리가 지워졌거나 없으면 첫 카테고리를 고른다', () => {
    // Given
    const deletedCategoryId = 99;

    // When
    const fromDeleted = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, deletedCategoryId);
    const fromMissing = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, null);

    // Then
    expect(fromDeleted).toBe(3);
    expect(fromMissing).toBe(3);
  });

  it('카테고리가 하나도 없으면 고를 수 없다', () => {
    // When
    const categoryId = TodoCategoryPolicy.getInitialCategoryId([], 7);

    // Then
    expect(categoryId).toBeNull();
  });
});

describe('findCategory', () => {
  it('목록에 있으면 찾고 지워졌으면 null이다', () => {
    // When
    const found = TodoCategoryPolicy.findCategory(CATEGORIES, 7);
    const deleted = TodoCategoryPolicy.findCategory(CATEGORIES, 99);

    // Then
    expect(found).toEqual({ id: 7 });
    expect(deleted).toBeNull();
  });
});

describe('hasChanges', () => {
  const category = { name: '업무', color: '#EF4444' };

  it('이름과 색이 그대로면 바뀐 값이 없다', () => {
    // When
    const changed = TodoCategoryPolicy.hasChanges(category, { name: '업무', color: '#EF4444' });

    // Then
    expect(changed).toBe(false);
  });

  it('이름이나 색 하나라도 다르면 바뀐 값이 있다', () => {
    // When
    const renamed = TodoCategoryPolicy.hasChanges(category, { name: '개인', color: '#EF4444' });
    const recolored = TodoCategoryPolicy.hasChanges(category, { name: '업무', color: '#3B82F6' });

    // Then
    expect(renamed).toBe(true);
    expect(recolored).toBe(true);
  });
});

describe('canReorderCategories', () => {
  it.each([
    { title: '카테고리가 없으면 순서를 바꿀 수 없다', categories: [], expected: false },
    {
      title: '카테고리가 하나뿐이면 순서를 바꿀 수 없다',
      categories: [{ id: 3 }],
      expected: false,
    },
    { title: '카테고리가 둘이면 순서를 바꿀 수 있다', categories: CATEGORIES, expected: true },
  ])('$title', ({ categories, expected }) => {
    // When
    const result = TodoCategoryPolicy.canReorderCategories(categories);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isOptimisticCategory', () => {
  it.each([
    { title: '서버 응답 전 임시 id(음수)는 임시 행이다', id: -1, expected: true },
    { title: '저장된 카테고리는 임시 행이 아니다', id: 3, expected: false },
  ])('$title', ({ id, expected }) => {
    // When
    const result = TodoCategoryPolicy.isOptimisticCategory({ id });

    // Then
    expect(result).toBe(expected);
  });
});

describe('getMoveTargetCategories', () => {
  it('지우는 카테고리만 빼고 나머지를 순서대로 남긴다', () => {
    // Given
    const work = createTodoCategoryWithCount({ id: 1, name: '업무' });
    const study = createTodoCategoryWithCount({ id: 2, name: '스터디' });
    const health = createTodoCategoryWithCount({ id: 3, name: '운동' });

    // When
    const targets = TodoCategoryPolicy.getMoveTargetCategories(study, [work, study, health]);

    // Then
    expect(targets).toEqual([work, health]);
  });

  it('카테고리가 하나뿐이면 옮길 곳이 없다', () => {
    // Given
    const only = createTodoCategoryWithCount({ id: 1 });

    // When
    const targets = TodoCategoryPolicy.getMoveTargetCategories(only, [only]);

    // Then
    expect(targets).toEqual([]);
  });

  it('서버 id가 없는 임시 행으로는 옮길 수 없다', () => {
    // Given
    const deleting = createTodoCategoryWithCount({ id: 2 });
    const work = createTodoCategoryWithCount({ id: 1 });
    const optimistic = createTodoCategoryWithCount({ id: -1 });

    // When
    const targets = TodoCategoryPolicy.getMoveTargetCategories(deleting, [
      deleting,
      work,
      optimistic,
    ]);

    // Then
    expect(targets).toEqual([work]);
  });

  it('목록에 없는 카테고리를 지우면 모두 옮길 곳이다', () => {
    // Given
    const categories = [
      createTodoCategoryWithCount({ id: 1 }),
      createTodoCategoryWithCount({ id: 2 }),
    ];

    // When
    const targets = TodoCategoryPolicy.getMoveTargetCategories({ id: 99 }, categories);

    // Then
    expect(targets).toEqual(categories);
  });
});

describe('canDeleteCategory', () => {
  it.each([
    { title: '다른 카테고리가 있으면 지울 수 있다', isLastCategory: false, expected: true },
    { title: '마지막 카테고리는 지울 수 없다', isLastCategory: true, expected: false },
  ])('$title', ({ isLastCategory, expected }) => {
    // Given
    const preview = createTodoCategoryDeletionPreview({ isLastCategory });

    // When
    const result = TodoCategoryPolicy.canDeleteCategory(preview);

    // Then
    expect(result).toBe(expected);
  });
});

describe('canDeleteTodosTogether', () => {
  it.each([
    {
      title: '미리보기를 주는 서버면 함께 지울 수 있다',
      isTodoHandlingSupported: true,
      expected: true,
    },
    {
      title: '처리 방식을 모르는 옛 서버면 옮기기만 할 수 있다',
      isTodoHandlingSupported: false,
      expected: false,
    },
  ])('$title', ({ isTodoHandlingSupported, expected }) => {
    // Given
    const preview = createTodoCategoryDeletionPreview({ isTodoHandlingSupported });

    // When
    const result = TodoCategoryPolicy.canDeleteTodosTogether(preview);

    // Then
    expect(result).toBe(expected);
  });
});

describe('shouldChooseTodoHandling', () => {
  it.each([
    { title: '할 일이 있으면 처리 방식을 묻는다', preview: { todoCount: 1 }, expected: true },
    {
      title: '할 일이 없어도 진행 중 반복이 있으면 묻는다',
      preview: { todoCount: 0, activeSeriesCount: 1 },
      expected: true,
    },
    {
      title: '할 일이 모두 끝낸 것이어도 지우면 기록이 사라져 묻는다',
      preview: { todoCount: 3, completedTodoCount: 3, activeSeriesCount: 0 },
      expected: true,
    },
    {
      title: '할 일과 반복이 모두 없으면 묻지 않고 확인만 받는다',
      preview: { todoCount: 0, completedTodoCount: 0, activeSeriesCount: 0 },
      expected: false,
    },
    {
      title: '마지막 카테고리는 할 일이 있어도 묻지 않는다',
      preview: { todoCount: 5, isLastCategory: true },
      expected: false,
    },
  ])('$title', ({ preview, expected }) => {
    // Given
    const deletionPreview = createTodoCategoryDeletionPreview(preview);

    // When
    const result = TodoCategoryPolicy.shouldChooseTodoHandling(deletionPreview);

    // Then
    expect(result).toBe(expected);
  });
});

describe('createFallbackDeletionPreview', () => {
  it('옛 서버에서는 목록의 할 일 수만 쓰고 함께 삭제를 고를 수 없다', () => {
    // Given
    const category = createTodoCategoryWithCount({ id: 1, todoCount: 7 });
    const categories = [category, createTodoCategoryWithCount({ id: 2 })];

    // When
    const preview = TodoCategoryPolicy.createFallbackDeletionPreview(category, categories);

    // Then
    expect(preview).toEqual({
      todoCount: 7,
      completedTodoCount: 0,
      activeSeriesCount: 0,
      isLastCategory: false,
      isTodoHandlingSupported: false,
    });
  });

  it('목록에 카테고리가 하나뿐이면 마지막 카테고리다', () => {
    // Given
    const category = createTodoCategoryWithCount({ id: 1, todoCount: 7 });

    // When
    const preview = TodoCategoryPolicy.createFallbackDeletionPreview(category, [category]);

    // Then
    expect(preview.isLastCategory).toBe(true);
  });
});

describe('createCategoryDeletion', () => {
  it.each([
    {
      title: '옮기기를 고르면 처리 방식과 옮길 곳을 보낸다',
      preview: {},
      choice: { todoHandling: 'move', moveToCategoryId: 4 },
      expected: { todoHandling: 'move', moveToCategoryId: 4 },
    },
    {
      title: '함께 삭제를 고르면 옮길 곳 없이 보낸다',
      preview: {},
      choice: { todoHandling: 'delete', moveToCategoryId: 4 },
      expected: { todoHandling: 'delete', moveToCategoryId: null },
    },
    {
      title: '할 일 없이 진행 중 반복만 있어도 처리 방식과 옮길 곳을 보낸다',
      preview: { todoCount: 0, completedTodoCount: 0, activeSeriesCount: 1 },
      choice: { todoHandling: 'move', moveToCategoryId: 4 },
      expected: { todoHandling: 'move', moveToCategoryId: 4 },
    },
    {
      title: '옮길 곳이 없으면 옮기기를 보낼 수 없다',
      preview: {},
      choice: { todoHandling: 'move', moveToCategoryId: null },
      expected: null,
    },
    {
      title: '마지막 카테고리는 무엇을 골라도 보낼 수 없다',
      preview: { isLastCategory: true },
      choice: { todoHandling: 'delete', moveToCategoryId: null },
      expected: null,
    },
    {
      title: '옛 서버로 옮기면 처리 방식 없이 옮길 곳만 보낸다',
      preview: { isTodoHandlingSupported: false },
      choice: { todoHandling: 'move', moveToCategoryId: 4 },
      expected: { todoHandling: null, moveToCategoryId: 4 },
    },
    {
      title: '옛 서버에는 함께 삭제를 보낼 수 없다',
      preview: { isTodoHandlingSupported: false },
      choice: { todoHandling: 'delete', moveToCategoryId: null },
      expected: null,
    },
    {
      title: '할 일과 반복이 없으면 고르지 않아도 처리 방식 없이 지운다',
      preview: { todoCount: 0, completedTodoCount: 0, activeSeriesCount: 0 },
      choice: null,
      expected: { todoHandling: null, moveToCategoryId: null },
    },
    {
      title: '할 일이 있는데 고르지 않았으면 보낼 수 없다',
      preview: {},
      choice: null,
      expected: null,
    },
  ] as const)('$title', ({ preview, choice, expected }) => {
    // Given
    const deletionPreview = createTodoCategoryDeletionPreview(preview);

    // When
    const deletion = TodoCategoryPolicy.createCategoryDeletion(deletionPreview, choice);

    // Then
    expect(deletion).toEqual(expected);
  });
});

describe('findMoveTarget', () => {
  it('고른 곳이 없으면 지우는 카테고리를 뺀 정렬 순서가 가장 앞인 카테고리로 옮긴다', () => {
    // Given
    const deleting = createTodoCategoryWithCount({ id: 1, sortOrder: 0 });
    const study = createTodoCategoryWithCount({ id: 2, sortOrder: 2 });
    const work = createTodoCategoryWithCount({ id: 3, sortOrder: 1 });

    // When
    const target = TodoCategoryPolicy.findMoveTarget(deleting, [deleting, study, work], null);

    // Then
    expect(target).toEqual(work);
  });

  it('고른 곳이 아직 있으면 그곳으로 옮긴다', () => {
    // Given
    const deleting = createTodoCategoryWithCount({ id: 1, sortOrder: 0 });
    const study = createTodoCategoryWithCount({ id: 2, sortOrder: 2 });
    const work = createTodoCategoryWithCount({ id: 3, sortOrder: 1 });

    // When
    const target = TodoCategoryPolicy.findMoveTarget(deleting, [deleting, study, work], 2);

    // Then
    expect(target).toEqual(study);
  });

  it('고른 곳이 그사이 사라졌으면 남은 첫 카테고리로 돌아간다', () => {
    // Given
    const deleting = createTodoCategoryWithCount({ id: 1, sortOrder: 0 });
    const work = createTodoCategoryWithCount({ id: 3, sortOrder: 1 });

    // When
    const target = TodoCategoryPolicy.findMoveTarget(deleting, [deleting, work], 2);

    // Then
    expect(target).toEqual(work);
  });

  it('지우는 카테고리 말고 남은 곳이 없으면 옮길 곳이 없다', () => {
    // Given
    const deleting = createTodoCategoryWithCount({ id: 1 });

    // When
    const target = TodoCategoryPolicy.findMoveTarget(deleting, [deleting], null);

    // Then
    expect(target).toBeNull();
  });
});

describe('shouldWarnHistoryLoss', () => {
  it.each([
    {
      title: '완료한 할 일이 있으면 함께 지울 때 달력의 완료 기록이 사라진다고 알린다',
      completedTodoCount: 1,
      expected: true,
    },
    { title: '완료한 할 일이 없으면 사라질 기록이 없다', completedTodoCount: 0, expected: false },
  ])('$title', ({ completedTodoCount, expected }) => {
    // Given
    const preview = createTodoCategoryDeletionPreview({ completedTodoCount });

    // When
    const result = TodoCategoryPolicy.shouldWarnHistoryLoss(preview);

    // Then
    expect(result).toBe(expected);
  });
});
