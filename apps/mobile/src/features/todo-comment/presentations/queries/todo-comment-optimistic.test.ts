import { createTodoComment, createTodoCommentReply } from '../../__tests__/todo-comment.factories';
import {
  contentEdited,
  likeSettled,
  likeToggled,
  nestChain,
  pendingComment,
  pendingCommentChain,
  replyAdded,
  replyCounted,
  tombstoned,
} from './todo-comment-optimistic';

const NOW = new Date('2026-08-15T09:00:00.000Z');

describe('likeToggled', () => {
  test('좋아요를 누르면 카운트를 올리고 내 상태를 켠다', () => {
    // Given
    const comment = createTodoComment({ likeCount: 4 });

    // When
    const result = likeToggled(comment, true);

    // Then
    expect(result.likeCount).toBe(5);
    expect(result.viewer.isLiked).toBe(true);
  });

  test('취소하면 카운트를 내리되 0 아래로 가지 않는다', () => {
    // Given - 서버와 잠깐 어긋나 0인 상태에서 취소가 들어온 경우
    const comment = createTodoComment({ likeCount: 0 });

    // When
    const result = likeToggled(comment, false);

    // Then
    expect(result.likeCount).toBe(0);
    expect(result.viewer.isLiked).toBe(false);
  });

  test('입력을 바꾸지 않는다', () => {
    // Given
    const comment = createTodoComment({ likeCount: 1 });

    // When
    likeToggled(comment, true);

    // Then
    expect(comment.likeCount).toBe(1);
  });
});

describe('likeSettled', () => {
  test('카운트의 주인은 서버라 응답 값으로 확정한다', () => {
    // Given - 낙관적으로 5로 올려둔 상태
    const comment = createTodoComment({
      likeCount: 5,
      viewer: { ...createTodoComment().viewer, isLiked: true },
    });

    // When - 서버는 12라고 답했다
    const result = likeSettled(comment, { commentId: comment.id, isLiked: true, likeCount: 12 });

    // Then
    expect(result.likeCount).toBe(12);
    expect(result.viewer.isLiked).toBe(true);
  });
});

describe('contentEdited', () => {
  test('내용을 바꾸고 수정됨으로 표시한다', () => {
    // Given
    const comment = createTodoComment({ content: '원본' });

    // When
    const result = contentEdited(comment, '수정본');

    // Then
    expect(result.content).toBe('수정본');
    expect(result.isEdited).toBe(true);
  });
});

describe('tombstoned', () => {
  test('서버의 소프트 삭제와 같은 모양으로 비운다', () => {
    // Given
    const comment = createTodoComment({ likeCount: 3, replyCount: 2 });

    // When
    const result = tombstoned(comment);

    // Then
    expect(result.isDeleted).toBe(true);
    expect(result.content).toBeNull();
    expect(result.author).toBeNull();
    expect(result.likeCount).toBe(0);
    expect(result.viewer).toEqual({
      isLiked: false,
      canEdit: false,
      canDelete: false,
      canReply: false,
    });
  });

  test('답글 수는 보존한다', () => {
    // Given
    const comment = createTodoComment({ replyCount: 2 });

    // When
    const result = tombstoned(comment);

    // Then
    expect(result.replyCount).toBe(2);
  });
});

describe('replyCounted', () => {
  test('미리보기 자리에서는 답글 수만 올린다', () => {
    // Given - 목록에 미리보기로 그려진 답글
    const preview = createTodoCommentReply(createTodoComment(), { replyCount: 0 });

    // When
    const result = replyCounted(preview);

    // Then - 새 답글은 다음 화면에 있으므로 더 있음으로 표시된다
    expect(result.replyCount).toBe(1);
    expect(result.hasReplies).toBe(true);
    expect(result.hasMoreReplies).toBe(true);
  });
});

describe('replyAdded', () => {
  test('답글 수를 올리고 미리보기 맨 앞에 붙인다', () => {
    // Given
    const parent = createTodoComment({ replyCount: 0 });
    const reply = createTodoCommentReply(parent);

    // When
    const result = replyAdded(parent, reply);

    // Then
    expect(result.replyCount).toBe(1);
    expect(result.replyPreview).toEqual([reply]);
    expect(result.hasMoreReplies).toBe(false);
  });

  test('미리보기는 계약 개수(2개)를 넘지 않고, 넘치면 더 있음으로 표시한다', () => {
    // Given - 이미 미리보기가 꽉 찬 댓글
    const parent = createTodoComment({ replyCount: 2 });
    const filled = {
      ...parent,
      replyPreview: [
        createTodoCommentReply(parent, { id: 'reply-1' }),
        createTodoCommentReply(parent, { id: 'reply-2' }),
      ],
    };
    const reply = createTodoCommentReply(parent, { id: 'reply-3' });

    // When
    const result = replyAdded(filled, reply);

    // Then - 새 답글이 맨 앞에 들어오고 가장 오래된 미리보기가 빠진다
    expect(result.replyCount).toBe(3);
    expect(result.replyPreview.map((item) => item.id)).toEqual(['reply-3', 'reply-1']);
    expect(result.hasMoreReplies).toBe(true);
  });
});

describe('pendingComment', () => {
  test('부모가 없으면 할 일에 바로 달리고, 서버 확인 전에는 아무 권한도 열리지 않는다', () => {
    // Given & When
    const result = pendingComment({
      id: 'pending-1',
      todoId: 1,
      content: '방금 쓴 댓글',
      createdAt: NOW,
      author: { id: 'user-1', name: '김철수', profileImage: null, isTodoOwner: true },
      parent: null,
      replyTo: null,
    });

    // Then
    expect(result).toMatchObject({ parentId: null, rootId: null, depth: 0, isPending: true });
    expect(result.viewer).toEqual({
      isLiked: false,
      canEdit: false,
      canDelete: false,
      canReply: false,
    });
    expect(result.replyPreview).toEqual([]);
  });

  test('부모가 있으면 그 아래 자리를 물려받고 멘션 대상을 갖는다', () => {
    // Given - 이미 깊이 1에 있는 답글에 또 답글을 단다
    const parent = createTodoCommentReply(createTodoComment());

    // When
    const result = pendingComment({
      id: 'pending-2',
      todoId: 1,
      content: '방금 쓴 답글',
      createdAt: NOW,
      author: { id: 'user-3', name: '박민수', profileImage: null, isTodoOwner: false },
      parent,
      replyTo: { commentId: parent.id, authorName: '이영희' },
    });

    // Then
    expect(result).toMatchObject({
      parentId: parent.id,
      rootId: parent.rootId,
      depth: 2,
      isPending: true,
    });
    expect(result.replyTo).toEqual({ commentId: parent.id, authorName: '이영희' });
  });
});

describe('nestChain', () => {
  test('이어 쓴 글들을 앞 글의 답글로 겹쳐 하나로 만든다', () => {
    // Given - 한 번에 세 개를 이어 썼다
    const parent = createTodoComment();
    const first = createTodoCommentReply(parent, { id: 'chain-1' });
    const second = createTodoCommentReply(first, { id: 'chain-2' });
    const third = createTodoCommentReply(second, { id: 'chain-3' });

    // When
    const nested = nestChain([first, second, third]);

    // Then - 목록에는 첫 글만 서고 나머지는 그 아래로 접힌다
    expect(nested.id).toBe('chain-1');
    expect(nested.replyPreview.map((item) => item.id)).toEqual(['chain-2']);
    expect(nested.replyCount).toBe(1);
    expect(nested.hasMoreReplies).toBe(false);
  });

  test('하나만 썼으면 그대로 둔다', () => {
    // Given
    const only = createTodoComment({ id: 'only' });

    // When
    const nested = nestChain([only]);

    // Then
    expect(nested).toBe(only);
  });
});

describe('pendingCommentChain', () => {
  test('첫 글만 부모의 답글이고 나머지는 앞 글의 답글이 된다', () => {
    // Given
    const parent = createTodoComment();

    // When
    const pending = pendingCommentChain({
      todoId: 1,
      createdAt: NOW,
      author: { id: 'user-1', name: '김철수', profileImage: null, isTodoOwner: true },
      parent,
      items: [
        { id: 'pending-1', content: '하나' },
        { id: 'pending-2', content: '둘' },
      ],
    });

    // Then
    expect(pending).toMatchObject({
      id: 'pending-1',
      parentId: parent.id,
      depth: parent.depth + 1,
      isPending: true,
    });
    expect(pending.replyPreview[0]).toMatchObject({
      id: 'pending-2',
      parentId: 'pending-1',
      depth: parent.depth + 2,
    });
  });

  test('부모가 없으면 할 일에 바로 달리는 사슬이 된다', () => {
    // Given & When
    const pending = pendingCommentChain({
      todoId: 1,
      createdAt: NOW,
      author: { id: 'user-1', name: '김철수', profileImage: null, isTodoOwner: true },
      parent: null,
      items: [{ id: 'pending-1', content: '하나' }],
    });

    // Then
    expect(pending).toMatchObject({ parentId: null, rootId: null, depth: 0 });
  });
});
