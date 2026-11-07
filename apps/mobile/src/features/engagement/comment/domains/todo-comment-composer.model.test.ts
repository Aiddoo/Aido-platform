import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import { TodoCommentComposerPolicy } from './todo-comment-composer.model';

describe('canChain', () => {
  it('수정은 이어 쓸 수 없다', () => {
    // Given
    const target = createTodoComment();

    // When
    const result = TodoCommentComposerPolicy.canChain({ type: 'edit', target }, 1);

    // Then
    expect(result).toBe(false);
  });

  it('답글은 상한 전까지 이어 쓴다', () => {
    // Given
    const target = createTodoComment();

    // When
    const result = TodoCommentComposerPolicy.canChain({ type: 'reply', target }, 4);

    // Then
    expect(result).toBe(true);
  });

  it('새 글도 상한(5개)에 닿으면 더 이어 쓸 수 없다', () => {
    // When
    const result = TodoCommentComposerPolicy.canChain({ type: 'new' }, 5);

    // Then
    expect(result).toBe(false);
  });
});

describe('getReplyParentId', () => {
  it('답글은 누른 글에 답한다', () => {
    // Given
    const target = createTodoComment({ id: 'reply-target' });

    // When
    const parentId = TodoCommentComposerPolicy.getReplyParentId({ type: 'reply', target });

    // Then
    expect(parentId).toBe('reply-target');
  });

  it('새 댓글은 답할 글이 없다', () => {
    // When
    const parentId = TodoCommentComposerPolicy.getReplyParentId({ type: 'new' });

    // Then
    expect(parentId).toBeNull();
  });

  it('수정은 답글이 아니므로 답할 글이 없다', () => {
    // Given
    const target = createTodoComment();

    // When
    const parentId = TodoCommentComposerPolicy.getReplyParentId({ type: 'edit', target });

    // Then
    expect(parentId).toBeNull();
  });
});

describe('prepareSubmission', () => {
  function createIdSequence() {
    let count = 0;

    return () => {
      count += 1;
      return `id-${count}`;
    };
  }

  it('같은 글을 다시 보내면 처음 발급한 멱등 키를 다시 쓴다', () => {
    // Given
    const createClientRequestId = createIdSequence();
    const first = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: null,
      todoId: 1,
      parentId: null,
      contents: ['안녕'],
      createClientRequestId,
    });

    // When
    const retried = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: first,
      todoId: 1,
      parentId: null,
      contents: ['안녕'],
      createClientRequestId,
    });

    // Then
    expect(retried).toBe(first);
  });

  it('글이 바뀌면 새 멱등 키를 발급한다', () => {
    // Given
    const createClientRequestId = createIdSequence();
    const first = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: null,
      todoId: 1,
      parentId: null,
      contents: ['안녕'],
      createClientRequestId,
    });

    // When
    const changed = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: first,
      todoId: 1,
      parentId: null,
      contents: ['바뀐 글'],
      createClientRequestId,
    });

    // Then
    expect(changed.input.items[0]?.clientRequestId).toBe('id-2');
  });

  it('이어 쓴 글마다 서로 다른 멱등 키를 발급한다', () => {
    // Given
    const createClientRequestId = createIdSequence();

    // When
    const submission = TodoCommentComposerPolicy.prepareSubmission({
      previousSubmission: null,
      todoId: 1,
      parentId: null,
      contents: ['하나', '둘'],
      createClientRequestId,
    });

    // Then
    expect(submission.input.items.map((item) => item.clientRequestId)).toEqual(['id-1', 'id-2']);
  });
});

describe('isSameAsOriginal', () => {
  it('공백을 지운 글이 원래 글과 같으면 수정할 것이 없다', () => {
    // Given
    const target = createTodoComment({ content: '원래 글' });

    // When
    const result = TodoCommentComposerPolicy.isSameAsOriginal(target, '원래 글');

    // Then
    expect(result).toBe(true);
  });

  it('글이 바뀌었으면 수정할 것이 있다', () => {
    // Given
    const target = createTodoComment({ content: '원래 글' });

    // When
    const result = TodoCommentComposerPolicy.isSameAsOriginal(target, '바뀐 글');

    // Then
    expect(result).toBe(false);
  });
});
