import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import {
  NEW_TODO_COMMENT_FORM_VALUES,
  toReplyFormValues,
  toEditFormValues,
} from './../schemas/todo-comment-form.schema';
import { TodoCommentComposerPolicy } from './todo-comment-composer.model';

describe('TodoCommentComposer', () => {
  it('답글은 빈 입력으로, 수정은 원래 글로 시작한다', () => {
    // Given
    const target = createTodoComment({ content: '원래 글' });

    // When
    const reply = toReplyFormValues(target);
    const edit = toEditFormValues(target);

    // Then
    expect(reply.items).toEqual([{ content: '' }]);
    expect(edit.items).toEqual([{ content: '원래 글' }]);
  });

  it('수정은 이어 쓸 수 없고 새 글·답글은 상한까지 이어 쓴다', () => {
    // Given
    const target = createTodoComment();

    // When
    const result = [
      TodoCommentComposerPolicy.canChain({ type: 'edit', target }, 1),
      TodoCommentComposerPolicy.canChain({ type: 'reply', target }, 4),
      TodoCommentComposerPolicy.canChain({ type: 'new' }, 5),
    ];

    // Then
    expect(result).toEqual([false, true, false]);
  });

  it('답글은 누른 글에 답하고 새 댓글은 대상이 없다', () => {
    // Given
    const target = createTodoComment({ id: 'reply-target' });

    // When
    const parentIds = [
      TodoCommentComposerPolicy.getReplyParentId({ type: 'reply', target }),
      TodoCommentComposerPolicy.getReplyParentId({ type: 'new' }),
      TodoCommentComposerPolicy.getReplyParentId({ type: 'edit', target }),
    ];

    // Then
    expect(parentIds).toEqual(['reply-target', null, null]);
  });

  it('같은 글을 다시 보내면 처음 발급한 멱등 키를 다시 쓴다', () => {
    // Given
    const createId = jest.fn().mockReturnValueOnce('id-1').mockReturnValueOnce('id-2');
    const first = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: null,
      todoId: 1,
      parentId: null,
      contents: ['안녕'],
      createClientRequestId: createId,
    });

    // When
    const retried = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: first,
      todoId: 1,
      parentId: null,
      contents: ['안녕'],
      createClientRequestId: createId,
    });
    const changed = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: first,
      todoId: 1,
      parentId: null,
      contents: ['바뀐 글'],
      createClientRequestId: createId,
    });

    // Then
    expect(retried).toBe(first);
    expect(changed.input.items[0]?.clientRequestId).toBe('id-2');
  });

  it('보낼 글은 앞뒤 공백을 지운다', () => {
    // When
    const contents = TodoCommentComposerPolicy.getTrimmedContents([
      { content: '  하나 ' },
      { content: '둘\n' },
    ]);

    // Then
    expect(contents).toEqual(['하나', '둘']);
  });

  it('답글·수정을 비운 채 키보드를 내리면 작성기를 닫고 쓴 글이 있으면 남긴다', () => {
    // Given
    const target = createTodoComment();

    // When
    const result = [
      TodoCommentComposerPolicy.shouldCloseOnKeyboardHide(toReplyFormValues(target)),
      TodoCommentComposerPolicy.shouldCloseOnKeyboardHide({
        mode: { type: 'reply', target },
        items: [{ content: '쓰던 글' }],
      }),
      TodoCommentComposerPolicy.shouldCloseOnKeyboardHide(NEW_TODO_COMMENT_FORM_VALUES),
    ];

    // Then
    expect(result).toEqual([true, false, false]);
  });
});
