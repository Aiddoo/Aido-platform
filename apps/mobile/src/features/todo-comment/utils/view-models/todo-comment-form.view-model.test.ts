import { createTodoComment } from '../../__tests__/todo-comment.factories';
import {
  getTodoCommentFormUnavailableReason,
  getTodoCommentInputLayoutIdentity,
  toTodoCommentAuthor,
} from './todo-comment-form.view-model';

describe('toTodoCommentAuthor', () => {
  test('현재 사용자와 할 일 소유자를 비교해 작성자 badge 근거를 만든다', () => {
    expect(
      toTodoCommentAuthor(
        { id: 'user-1', name: '김철수', profileImage: 'https://example.com/profile.png' },
        'user-1',
      ),
    ).toEqual({
      id: 'user-1',
      name: '김철수',
      profileImage: 'https://example.com/profile.png',
      isTodoOwner: true,
    });
  });
});

describe('getTodoCommentFormUnavailableReason', () => {
  test('답글은 댓글 작성 권한이 없으면 댓글 비활성 사유를 우선한다', () => {
    const target = createTodoComment();

    expect(
      getTodoCommentFormUnavailableReason({ formType: 'reply', target, canComment: false }),
    ).toBe('commentingDisabled');
  });

  test('답글을 달 수 없는 댓글이면 답글 불가 사유를 돌려준다', () => {
    const target = createTodoComment({
      viewer: {
        isLiked: false,
        canEdit: true,
        canDelete: true,
        canReply: false,
        canReport: false,
        canBlock: false,
      },
    });

    expect(
      getTodoCommentFormUnavailableReason({ formType: 'reply', target, canComment: true }),
    ).toBe('replyUnavailable');
  });

  test('수정할 수 없는 댓글이면 수정 불가 사유를 돌려준다', () => {
    const target = createTodoComment({
      viewer: {
        isLiked: false,
        canEdit: false,
        canDelete: true,
        canReply: true,
        canReport: false,
        canBlock: false,
      },
    });

    expect(
      getTodoCommentFormUnavailableReason({ formType: 'edit', target, canComment: true }),
    ).toBe('editUnavailable');
  });

  test('수정은 댓글 작성 권한과 무관하게 수정 가능 여부만 본다', () => {
    const target = createTodoComment();

    expect(
      getTodoCommentFormUnavailableReason({ formType: 'edit', target, canComment: false }),
    ).toBeNull();
  });

  test('답글을 달 수 있으면 사유가 없다', () => {
    const target = createTodoComment();

    expect(
      getTodoCommentFormUnavailableReason({ formType: 'reply', target, canComment: true }),
    ).toBeNull();
  });
});

describe('getTodoCommentInputLayoutIdentity', () => {
  test('개요는 작성 중인 폼 종류까지 식별자에 담는다', () => {
    expect(getTodoCommentInputLayoutIdentity({ view: 'overview', form: null })).toBe(
      'overview:reading',
    );
    expect(getTodoCommentInputLayoutIdentity({ view: 'overview', form: { type: 'new' } })).toBe(
      'overview:new',
    );
  });

  test('대화는 선택한 댓글과 폼 종류를 식별자에 담는다', () => {
    expect(
      getTodoCommentInputLayoutIdentity({
        view: 'conversation',
        commentId: 'comment-1',
        form: { type: 'reply' },
      }),
    ).toBe('conversation:comment-1:reply');
  });
});
