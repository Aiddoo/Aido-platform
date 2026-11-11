import {
  createTodoCategoryDeletionPreview,
  createTodoCategoryWithCount,
} from '../__tests__/todo-category.fixtures';
import {
  excludeCategory,
  findFirstInSortOrder,
  hasTodosToHandle,
  TodoCategoryDeletionPolicy,
  TodoCategoryPolicy,
} from './todo-category.model';

const PERSONAL = createTodoCategoryWithCount({ id: 1, name: '개인', sortOrder: 0 });
const WORK = createTodoCategoryWithCount({ id: 3, name: '업무', sortOrder: 2 });
const WORKOUT = createTodoCategoryWithCount({ id: 7, name: '운동', sortOrder: 1, todoCount: 12 });
const CATEGORIES = [PERSONAL, WORK, WORKOUT];

describe('TodoCategoryPolicy.findCategory', () => {
  it('목록에 있으면 찾고 지워졌으면 null이다', () => {
    // When
    const found = TodoCategoryPolicy.findCategory(CATEGORIES, WORK.id);
    const deleted = TodoCategoryPolicy.findCategory(CATEGORIES, 99);

    // Then
    expect(found).toEqual(WORK);
    expect(deleted).toBeNull();
  });
});

describe('TodoCategoryPolicy.getInitialCategoryId', () => {
  it('요청한 카테고리가 남아 있으면 그것을 고른다', () => {
    // When
    const categoryId = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, WORKOUT.id);

    // Then
    expect(categoryId).toBe(WORKOUT.id);
  });

  it('요청한 카테고리가 지워졌거나 없으면 목록의 첫 카테고리를 고른다', () => {
    // When
    const fromDeleted = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, 99);
    const fromMissing = TodoCategoryPolicy.getInitialCategoryId(CATEGORIES, null);

    // Then
    expect(fromDeleted).toBe(PERSONAL.id);
    expect(fromMissing).toBe(PERSONAL.id);
  });

  it('카테고리가 하나도 없으면 고를 수 없다', () => {
    // When
    const categoryId = TodoCategoryPolicy.getInitialCategoryId([], 7);

    // Then
    expect(categoryId).toBeNull();
  });
});

describe('TodoCategoryPolicy.hasChanges', () => {
  it('이름과 색이 그대로면 바뀐 값이 없다', () => {
    // When
    const changed = TodoCategoryPolicy.hasChanges(WORK, { name: WORK.name, color: WORK.color });

    // Then
    expect(changed).toBe(false);
  });

  it('이름이나 색 하나라도 다르면 바뀐 값이 있다', () => {
    // When
    const renamed = TodoCategoryPolicy.hasChanges(WORK, { name: '개인 일', color: WORK.color });
    const recolored = TodoCategoryPolicy.hasChanges(WORK, { name: WORK.name, color: '#51CF66' });

    // Then
    expect(renamed).toBe(true);
    expect(recolored).toBe(true);
  });
});

describe('TodoCategoryPolicy.isOptimisticCategory', () => {
  it.each([
    {
      title: '서버 응답 전 임시 id(음수)는 임시 행이다',
      category: createTodoCategoryWithCount({ id: -1 }),
      expected: true,
    },
    { title: '저장된 카테고리는 임시 행이 아니다', category: WORK, expected: false },
  ])('$title', ({ category, expected }) => {
    // When
    const result = TodoCategoryPolicy.isOptimisticCategory(category);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoCategoryPolicy.canReorder', () => {
  it.each([
    { title: '카테고리가 없으면 순서를 바꿀 수 없다', categories: [], expected: false },
    { title: '카테고리가 하나뿐이면 순서를 바꿀 수 없다', categories: [WORK], expected: false },
    {
      title: '카테고리가 둘이면 순서를 바꿀 수 있다',
      categories: [WORK, PERSONAL],
      expected: true,
    },
  ])('$title', ({ categories, expected }) => {
    // When
    const result = TodoCategoryPolicy.canReorder(categories);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoCategoryPolicy.getMoveTargets', () => {
  it('지우는 카테고리만 빼고 나머지를 목록 순서대로 남긴다', () => {
    // When
    const moveTargets = TodoCategoryPolicy.getMoveTargets(WORKOUT, CATEGORIES);

    // Then
    expect(moveTargets).toEqual([PERSONAL, WORK]);
  });

  it('다른 카테고리가 없으면 옮길 곳이 없다', () => {
    // When
    const moveTargets = TodoCategoryPolicy.getMoveTargets(WORKOUT, [WORKOUT]);

    // Then
    expect(moveTargets).toEqual([]);
  });
});

describe('TodoCategoryPolicy.findMoveTarget', () => {
  it('고른 곳이 없으면 지우는 카테고리를 뺀 정렬 순서가 가장 앞인 카테고리로 옮긴다', () => {
    // Given
    // 운동(정렬 1)을 지우면 남은 개인(0)과 업무(2) 중 개인이 앞이다
    const deleting = WORKOUT;

    // When
    const moveTarget = TodoCategoryPolicy.findMoveTarget(
      deleting,
      [WORK, deleting, PERSONAL],
      null,
    );

    // Then
    expect(moveTarget).toEqual(PERSONAL);
  });

  it('고른 곳이 아직 있으면 그곳으로 옮긴다', () => {
    // When
    const moveTarget = TodoCategoryPolicy.findMoveTarget(WORKOUT, CATEGORIES, WORK.id);

    // Then
    expect(moveTarget).toEqual(WORK);
  });

  it.each([
    { title: '고른 곳이 그사이 지워졌으면 정렬이 가장 앞인 곳으로 돌아간다', pickedCategoryId: 99 },
    {
      title: '지우는 카테고리 자신을 골랐다고 와도 정렬이 가장 앞인 곳으로 돌아간다',
      pickedCategoryId: WORKOUT.id,
    },
  ])('$title', ({ pickedCategoryId }) => {
    // When
    const moveTarget = TodoCategoryPolicy.findMoveTarget(WORKOUT, CATEGORIES, pickedCategoryId);

    // Then
    expect(moveTarget).toEqual(PERSONAL);
  });

  it('다른 카테고리가 없으면 옮길 곳이 없다', () => {
    // When
    const moveTarget = TodoCategoryPolicy.findMoveTarget(WORKOUT, [WORKOUT], null);

    // Then
    expect(moveTarget).toBeNull();
  });
});

describe('TodoCategoryDeletionPolicy.canDelete', () => {
  it.each([
    { title: '다른 카테고리가 있으면 지울 수 있다', isLastCategory: false, expected: true },
    { title: '마지막 카테고리는 지울 수 없다', isLastCategory: true, expected: false },
  ])('$title', ({ isLastCategory, expected }) => {
    // Given
    const preview = createTodoCategoryDeletionPreview({ isLastCategory });

    // When
    const result = TodoCategoryDeletionPolicy.canDelete(preview);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoCategoryDeletionPolicy.shouldChooseTodoHandling', () => {
  it.each([
    {
      title: '할 일과 반복이 있으면 처리 방식을 묻는다',
      preview: { todoCount: 12, activeSeriesCount: 2 },
      expected: true,
    },
    {
      title: '할 일 없이 진행 중 반복만 있어도 묻는다',
      preview: { todoCount: 0, completedTodoCount: 0, activeSeriesCount: 1 },
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
    const result = TodoCategoryDeletionPolicy.shouldChooseTodoHandling(deletionPreview);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoCategoryDeletionPolicy.canDeleteTodosTogether', () => {
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
    const result = TodoCategoryDeletionPolicy.canDeleteTodosTogether(preview);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoCategoryDeletionPolicy.shouldWarnHistoryLoss', () => {
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
    const result = TodoCategoryDeletionPolicy.shouldWarnHistoryLoss(preview);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoCategoryDeletionPolicy.toDeletionRequest', () => {
  it.each([
    {
      title: '옮기기를 고르면 처리 방식과 옮길 곳을 보낸다',
      preview: {},
      choice: { todoHandling: 'move', moveToCategoryId: 4 },
      expected: { todoHandling: 'move', moveToCategoryId: 4 },
    },
    {
      title: '할 일 없이 진행 중 반복만 있어도 처리 방식과 옮길 곳을 보낸다',
      preview: { todoCount: 0, completedTodoCount: 0, activeSeriesCount: 1 },
      choice: { todoHandling: 'move', moveToCategoryId: 4 },
      expected: { todoHandling: 'move', moveToCategoryId: 4 },
    },
    {
      title: '함께 삭제를 고르면 남아 있던 옮길 곳은 빼고 보낸다',
      preview: {},
      choice: { todoHandling: 'delete', moveToCategoryId: 4 },
      expected: { todoHandling: 'delete', moveToCategoryId: null },
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
    const deletionRequest = TodoCategoryDeletionPolicy.toDeletionRequest(deletionPreview, choice);

    // Then
    expect(deletionRequest).toEqual(expected);
  });
});

describe('TodoCategoryDeletionPolicy.createFallbackPreview', () => {
  it('옛 서버에서는 목록의 할 일 수만 쓰고 함께 삭제를 고를 수 없다', () => {
    // When
    const preview = TodoCategoryDeletionPolicy.createFallbackPreview(WORKOUT, CATEGORIES);

    // Then
    expect(preview).toEqual({
      todoCount: 12,
      completedTodoCount: 0,
      activeSeriesCount: 0,
      isLastCategory: false,
      isTodoHandlingSupported: false,
    });
  });

  it('목록에 그 카테고리만 남았으면 마지막 카테고리다', () => {
    // When
    const preview = TodoCategoryDeletionPolicy.createFallbackPreview(WORKOUT, [WORKOUT]);

    // Then
    expect(preview.isLastCategory).toBe(true);
  });
});

describe('excludeCategory', () => {
  it('그 id만 빼고 순서를 지킨다', () => {
    // When
    const remaining = excludeCategory(CATEGORIES, WORK.id);

    // Then
    expect(remaining).toEqual([PERSONAL, WORKOUT]);
  });
});

describe('findFirstInSortOrder', () => {
  it('목록 순서와 관계없이 정렬 순서가 가장 작은 것을 찾고, 비었으면 null이다', () => {
    // When
    const first = findFirstInSortOrder([WORK, WORKOUT, PERSONAL]);
    const none = findFirstInSortOrder([]);

    // Then
    expect(first).toEqual(PERSONAL);
    expect(none).toBeNull();
  });
});

describe('hasTodosToHandle', () => {
  it.each([
    { todoCount: 1, activeSeriesCount: 0, expected: true },
    { todoCount: 0, activeSeriesCount: 1, expected: true },
    { todoCount: 0, activeSeriesCount: 0, expected: false },
  ])(
    '할 일 $todoCount개·반복 $activeSeriesCount개면 $expected다',
    ({ todoCount, activeSeriesCount, expected }) => {
      // When
      const result = hasTodosToHandle(todoCount, activeSeriesCount);

      // Then
      expect(result).toBe(expected);
    },
  );
});
