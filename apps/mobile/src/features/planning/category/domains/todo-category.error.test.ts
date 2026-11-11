import { createTodoCategoryApiError } from '../__tests__/todo-category.fixtures';
import { isDeletionPreviewUnsupportedError } from './todo-category.error';

describe('isDeletionPreviewUnsupportedError', () => {
  it.each([
    {
      title: '경로를 모르는 옛 서버의 404는 미리보기가 없는 것이다',
      error: createTodoCategoryApiError({ code: 'SYS_0002', status: 404 }),
      expected: true,
    },
    {
      title: '카테고리가 없다는 404는 미리보기가 없는 것이 아니다',
      error: createTodoCategoryApiError({ code: 'TODO_CATEGORY_0851', status: 404 }),
      expected: false,
    },
    {
      title: '404가 아닌 오류는 미리보기가 없는 것이 아니다',
      error: createTodoCategoryApiError({ code: 'TODO_CATEGORY_0852', status: 403 }),
      expected: false,
    },
  ])('$title', ({ error, expected }) => {
    // When
    const result = isDeletionPreviewUnsupportedError(error);

    // Then
    expect(result).toBe(expected);
  });
});
