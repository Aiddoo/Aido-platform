import { prepareTodoCommentSubmission } from './todo-comment-submission';

describe('prepareTodoCommentSubmission', () => {
  test('같은 logical submission의 재시도는 최초 idempotency key를 재사용한다', () => {
    const createClientRequestId = jest.fn().mockReturnValue('request-1');
    const first = prepareTodoCommentSubmission({
      previousSubmission: null,
      todoId: 1,
      parentId: 'parent-1',
      contents: ['같은 답글'],
      createClientRequestId,
    });

    const retry = prepareTodoCommentSubmission({
      previousSubmission: first,
      todoId: 1,
      parentId: 'parent-1',
      contents: ['같은 답글'],
      createClientRequestId,
    });

    expect(retry).toBe(first);
    expect(retry.input.items).toEqual([{ clientRequestId: 'request-1', content: '같은 답글' }]);
    expect(createClientRequestId).toHaveBeenCalledTimes(1);
  });

  test('대상이나 내용이 바뀌면 새 submission과 새 key를 만든다', () => {
    const createClientRequestId = jest
      .fn()
      .mockReturnValueOnce('request-1')
      .mockReturnValueOnce('request-2');
    const first = prepareTodoCommentSubmission({
      previousSubmission: null,
      todoId: 1,
      parentId: null,
      contents: ['댓글'],
      createClientRequestId,
    });

    const changed = prepareTodoCommentSubmission({
      previousSubmission: first,
      todoId: 1,
      parentId: null,
      contents: ['수정된 댓글'],
      createClientRequestId,
    });

    expect(changed).not.toBe(first);
    expect(changed.input.items).toEqual([{ clientRequestId: 'request-2', content: '수정된 댓글' }]);
  });

  test('체인의 각 댓글에 서로 다른 key를 발급한다', () => {
    const createClientRequestId = jest
      .fn()
      .mockReturnValueOnce('request-1')
      .mockReturnValueOnce('request-2');

    const submission = prepareTodoCommentSubmission({
      previousSubmission: null,
      todoId: 1,
      parentId: null,
      contents: ['첫 글', '이어지는 글'],
      createClientRequestId,
    });

    expect(submission.input).toEqual({
      parentId: null,
      items: [
        { clientRequestId: 'request-1', content: '첫 글' },
        { clientRequestId: 'request-2', content: '이어지는 글' },
      ],
    });
  });
});
