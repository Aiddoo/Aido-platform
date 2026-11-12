import { createTodoCategoryDeletionPreview } from '../__tests__/todo-category.fixtures';
import { hasTodosToHandle, TodoCategoryDeletionPolicy } from './todo-category-deletion.model';

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
