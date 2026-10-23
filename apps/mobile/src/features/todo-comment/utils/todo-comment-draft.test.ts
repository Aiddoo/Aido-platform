import { createTodoComment } from '../__tests__/todo-comment.factories';
import {
  createTodoCommentDraftKey,
  getTodoCommentDraftSourceUpdatedAt,
} from './todo-comment-draft';

describe('createTodoCommentDraftKey', () => {
  const target = createTodoComment({ id: 'comment-9' });

  it('새 댓글·답글·수정을 서로 다른 초안으로 나눈다', () => {
    const newKey = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      session: { type: 'new' },
    });
    const replyKey = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      session: { type: 'reply', target },
    });
    const editKey = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      session: { type: 'edit', target },
    });

    expect(newKey.id).toBe('user-1:todo-comment:3:new');
    expect(replyKey.id).toBe('user-1:todo-comment:3:reply');
    expect(editKey.id).toBe('user-1:todo-comment:3:edit:comment-9');
  });

  it('답글은 작성 중 대상을 바꿔도 같은 초안을 이어 쓴다', () => {
    const first = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      session: { type: 'reply', target },
    });
    const switched = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      session: { type: 'reply', target: createTodoComment({ id: 'comment-10' }) },
    });

    expect(switched.id).toBe(first.id);
  });

  it('같은 할 일이라도 사용자가 다르면 초안을 공유하지 않는다', () => {
    const mine = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      session: { type: 'new' },
    });
    const theirs = createTodoCommentDraftKey({
      userId: 'user-2',
      todoId: 3,
      session: { type: 'new' },
    });

    expect(mine.id).not.toBe(theirs.id);
  });

  it('이어 쓰기 한도를 넘는 옛 초안은 복원 대상이 아니다', () => {
    const { schema } = createTodoCommentDraftKey({
      userId: 'user-1',
      todoId: 3,
      session: { type: 'new' },
    });

    expect(schema.safeParse({ items: [] }).success).toBe(false);
    expect(schema.safeParse({ items: [{ content: '' }] }).success).toBe(true);
  });
});

describe('getTodoCommentDraftSourceUpdatedAt', () => {
  it('수정 초안만 댓글의 마지막 수정 시각을 기준으로 삼는다', () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z');
    const editedAt = new Date('2026-10-02T00:00:00.000Z');

    expect(getTodoCommentDraftSourceUpdatedAt({ type: 'new' })).toBeUndefined();
    expect(
      getTodoCommentDraftSourceUpdatedAt({
        type: 'reply',
        target: createTodoComment({ createdAt, editedAt }),
      }),
    ).toBeUndefined();
    expect(
      getTodoCommentDraftSourceUpdatedAt({
        type: 'edit',
        target: createTodoComment({ createdAt, editedAt: null }),
      }),
    ).toBe(createdAt.getTime());
    expect(
      getTodoCommentDraftSourceUpdatedAt({
        type: 'edit',
        target: createTodoComment({ createdAt, editedAt }),
      }),
    ).toBe(editedAt.getTime());
  });
});
