import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { ServerError } from '@src/shared/errors/infra-error';
import { createHttpClientStub, createRouteParamsFake, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { View } from 'react-native';

import TodoDetailRoute from '../../../../../app/(app)/todo/[todoId]';

const TODO_ID = 42;
const USER_ID = 'clz7x5p8k0001qz0z8z8z8z8z';
const FIRST_COMMENT_ID = 'ckcomment0001';
const SECOND_COMMENT_ID = 'ckcomment0002';
const FIRST_REPLY_ID = 'ckcomment0011';
const ANCHORED_REPLY_ID = 'ckcomment0012';
const SECOND_THREAD_REPLY_ID = 'ckcomment0021';
const MISSING_COMMENT_ID = 'ckcomment0099';
const THREADS_PATH = `v2/todos/${TODO_ID}/comments`;
const FIRST_REPLIES_PATH = `${THREADS_PATH}/${FIRST_COMMENT_ID}/replies`;
const PAGINATION = {
  previousCursor: null,
  nextCursor: null,
  hasPrevious: false,
  hasNext: false,
  size: 30,
};

function createCommentDto(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    todoId: TODO_ID,
    threadCommentId: null,
    replyTo: null,
    author: {
      id: 'clz7x5p8k0002qz0z8z8z8z8z',
      name: '안드친구',
      userTag: 'FRIEND01',
      profileImage: null,
      isTodoOwner: false,
    },
    content: `댓글 ${id}`,
    likeCount: 0,
    replyCount: 0,
    isDeleted: false,
    isAuthorBlocked: false,
    isEdited: false,
    viewer: {
      isLiked: false,
      canEdit: false,
      canDelete: true,
      canReply: true,
      canReport: true,
      canBlock: true,
    },
    createdAt: '2026-08-15T09:00:00.000Z',
    editedAt: null,
    ...overrides,
  };
}

function createReplyDto(id: string, threadCommentId: string) {
  return createCommentDto(id, {
    threadCommentId,
    replyTo: { commentId: threadCommentId, authorName: '안드친구' },
    content: `답글 ${id}`,
  });
}

interface RenderTodoCommentsOptions {
  /** 알림·링크로 연 댓글 위치(`?comment=`) */
  comment?: string;
  /** 서버가 찾아 주는 위치. 여기 없는 위치는 사라진 글이라 anchor가 null이다 */
  anchors?: Record<string, { threadCommentId: string; replyId: string | null }>;
  /** 인기순 묶음 목록을 받을 때 나는 실패 */
  popularFailure?: () => Error;
}

/** 답글이 3개·2개 달린 묶음 둘을 가진 할 일 상세를 연다 */
async function renderTodoComments({
  comment,
  anchors = {},
  popularFailure,
}: RenderTodoCommentsOptions = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (path: string, config) => {
    if (path === 'v1/auth/me') {
      return ok(createCurrentUserDto({ userId: USER_ID }));
    }
    if (path === 'v1/auth/preference') {
      return ok(createPreferenceDto());
    }
    if (path === `v1/todos/${TODO_ID}/details`) {
      return ok({
        todo: createTodoDto({ id: TODO_ID, userId: USER_ID, title: '운동하기' }),
        owner: { id: USER_ID, name: '나', userTag: 'TEST2025', profileImage: null },
        permissions: { canEdit: true, canComment: true, canNudge: false, canThank: false },
        metrics: { viewCount: 3, commentCount: 7 },
      });
    }
    if (path === FIRST_REPLIES_PATH) {
      return ok({
        items: [
          createReplyDto(FIRST_REPLY_ID, FIRST_COMMENT_ID),
          createReplyDto(ANCHORED_REPLY_ID, FIRST_COMMENT_ID),
          createReplyDto('ckcomment0013', FIRST_COMMENT_ID),
        ],
        pagination: PAGINATION,
      });
    }
    if (popularFailure != null && config?.params?.sort === 'POPULAR') {
      throw popularFailure();
    }
    const anchorCommentId = config?.params?.anchorCommentId;
    return ok({
      items: [
        {
          comment: createCommentDto(FIRST_COMMENT_ID, { replyCount: 3 }),
          previewReply: createReplyDto(FIRST_REPLY_ID, FIRST_COMMENT_ID),
          replySummary: { totalCount: 3, hiddenCount: 2, participantAuthors: [] },
        },
        {
          comment: createCommentDto(SECOND_COMMENT_ID, { replyCount: 2 }),
          previewReply: createReplyDto(SECOND_THREAD_REPLY_ID, SECOND_COMMENT_ID),
          replySummary: { totalCount: 2, hiddenCount: 1, participantAuthors: [] },
        },
      ],
      pagination: PAGINATION,
      anchor: typeof anchorCommentId === 'string' ? (anchors[anchorCommentId] ?? null) : null,
    });
  });
  createRouteParamsFake({
    todoId: String(TODO_ID),
    ...(comment == null ? {} : { comment }),
  });
  await renderScreen(<TodoDetailRoute />, {
    di: createTestDi({ ports: { httpClient } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await screen.findByTestId(`todo-comment-thread-${SECOND_COMMENT_ID}`);

  return { httpClient };
}

describe('TodoDetailRoute 댓글 묶음', () => {
  describe('알림·링크로 연 댓글 위치', () => {
    it('답글 위치로 열면 그 묶음만 처음부터 펼쳐 답글 주변 페이지를 받고 다른 묶음은 접힌 채다', async () => {
      // When
      const { httpClient } = await renderTodoComments({
        comment: ANCHORED_REPLY_ID,
        anchors: {
          [ANCHORED_REPLY_ID]: { threadCommentId: FIRST_COMMENT_ID, replyId: ANCHORED_REPLY_ID },
        },
      });

      // Then
      expect(await screen.findByTestId(`todo-comment-body-${ANCHORED_REPLY_ID}`)).toBeOnTheScreen();
      expect(httpClient.get).toHaveBeenCalledWith(FIRST_REPLIES_PATH, {
        params: { size: 10, aroundReplyId: ANCHORED_REPLY_ID },
        signal: expect.anything(),
      });
      expect(screen.getByRole('button', { name: '답글 1개 더 보기' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '답글 숨기기' })).toBeOnTheScreen();
    });

    it('찾는 댓글이 사라졌으면 알리고 묶음을 접힌 채 보인다', async () => {
      // When
      await renderTodoComments({ comment: MISSING_COMMENT_ID });

      // Then
      expect(
        await screen.findByText('찾는 댓글이 삭제됐거나 더 이상 볼 수 없어요'),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '답글 2개 더 보기' })).toBeOnTheScreen();
    });

    it('강조하는 동안 사라진 댓글 위치로 다시 열면 앞 강조가 남은 시간을 기다리지 않고 꺼진다', async () => {
      // Given
      await renderTodoComments({
        comment: FIRST_COMMENT_ID,
        anchors: { [FIRST_COMMENT_ID]: { threadCommentId: FIRST_COMMENT_ID, replyId: null } },
      });
      expect(await screen.findByTestId('todo-comment-highlight')).toBeOnTheScreen();

      // When
      await act(async () => router.setParams({ comment: MISSING_COMMENT_ID }));

      // Then
      expect(
        await screen.findByText('찾는 댓글이 삭제됐거나 더 이상 볼 수 없어요'),
      ).toBeOnTheScreen();
      expect(screen.getByTestId(`todo-comment-thread-${FIRST_COMMENT_ID}`)).toBeOnTheScreen();
      expect(screen.queryByTestId('todo-comment-highlight')).toBeNull();
    });
  });

  describe('정렬 미리 받기 실패', () => {
    // 정렬 메뉴는 누른 자리를 재야 열린다. 테스트에는 레이아웃이 없어 자리를 준다
    beforeEach(() => {
      jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback(0, 0, 32, 24, 300, 200);
        }
      });
    });

    afterEach(() => {
      jest.mocked(View.prototype.measure).mockReset();
    });

    it('서버 장애로 새 정렬을 미리 받지 못하면 정렬을 바꾸고 목록 자리에 실패와 다시 시도를 보이며 작성 바는 남는다', async () => {
      // Given
      await renderTodoComments({ popularFailure: () => new ServerError(503) });

      // When
      await fireEvent.press(screen.getByRole('button', { name: '댓글 정렬 기준, 최신순' }));
      // 메뉴 항목은 그려진 자리를 재야 눌린다
      const popularItem = await screen.findByRole('menuitem', { name: '인기순' });
      await fireEvent(popularItem, 'layout', {
        nativeEvent: { layout: { x: 0, y: 240, width: 200, height: 44 } },
      });
      await fireEvent.press(popularItem);

      // Then
      expect(await screen.findByText('댓글을 불러오지 못했어요')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '댓글 정렬 기준, 인기순' })).toBeEnabled();
      expect(screen.getByTestId('query-error-retry')).toBeOnTheScreen();
      expect(screen.getByTestId('todo-comment-input-0')).toBeOnTheScreen();
    });
  });

  describe('답글 펼치기', () => {
    it('더 보기를 누르면 그 묶음의 답글을 받아 펼치고 숨기기를 누르면 대표 답글로 접는다', async () => {
      // Given
      const { httpClient } = await renderTodoComments();

      // When
      await fireEvent.press(screen.getByRole('button', { name: '답글 2개 더 보기' }));

      // Then
      expect(await screen.findByTestId(`todo-comment-body-${ANCHORED_REPLY_ID}`)).toBeOnTheScreen();
      expect(httpClient.get).toHaveBeenCalledWith(FIRST_REPLIES_PATH, {
        params: { size: 10 },
        signal: expect.anything(),
      });

      // When
      await fireEvent.press(screen.getByRole('button', { name: '답글 숨기기' }));

      // Then
      expect(screen.queryByTestId(`todo-comment-body-${ANCHORED_REPLY_ID}`)).toBeNull();
      expect(screen.getByTestId(`todo-comment-body-${FIRST_REPLY_ID}`)).toBeOnTheScreen();
    });
  });

  describe('본문의 스크린리더 동작', () => {
    it('길게 누르기 메뉴의 동작을 같은 이름으로 주고, 고르면 메뉴에서 누른 것과 같은 일을 한다', async () => {
      // Given
      await renderTodoComments();
      const body = screen.getByTestId(`todo-comment-body-${FIRST_COMMENT_ID}`);

      // When
      const { accessibilityActions } = body.props;
      await fireEvent(body, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });

      // Then
      expect(accessibilityActions).toEqual([
        { name: 'copy', label: '복사' },
        { name: 'delete', label: '삭제' },
        { name: 'report', label: '신고' },
        { name: 'block', label: '안드친구님 차단' },
      ]);
      expect(await screen.findByText('댓글을 삭제할까요?')).toBeOnTheScreen();
    });
  });
});
