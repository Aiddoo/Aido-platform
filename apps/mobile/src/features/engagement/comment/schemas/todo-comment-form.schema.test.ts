import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import { toEditFormValues, toReplyFormValues } from './todo-comment-form.schema';

describe('toReplyFormValues', () => {
  it('답글은 빈 입력으로 시작한다', () => {
    // Given
    const target = createTodoComment({ content: '원래 글' });

    // When
    const reply = toReplyFormValues(target);

    // Then
    expect(reply.items).toEqual([{ content: '' }]);
  });
});

describe('toEditFormValues', () => {
  it('수정은 원래 글로 시작한다', () => {
    // Given
    const target = createTodoComment({ content: '원래 글' });

    // When
    const edit = toEditFormValues(target);

    // Then
    expect(edit.items).toEqual([{ content: '원래 글' }]);
  });
});
